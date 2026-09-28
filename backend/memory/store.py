"""Incident memory: remember leaked features and find similar ones in new datasets.

Vectors are stored with each incident in the SQL database and searched by
cosine similarity. Azure OpenAI embeddings are used when configured;
otherwise (or if a call fails) the local hashed vectors are used.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from engine.risk_scoring import MemoryEvidence
from memory import incidents
from memory.embeddings import AzureEmbedder, cosine, local_embed
from memory.explainer import lesson_text
from memory.hindsight_adapter import HindsightAdapter
from models.tables import Incident

LOCAL = "local-vectors"
AZURE = "azure-openai"
THRESHOLDS = {LOCAL: 0.5, AZURE: 0.6}


@dataclass
class SearchHit:
    incident: Incident
    similarity: float


class MemoryStore:
    def __init__(self, db: Session, azure: AzureEmbedder | None = None, hindsight: HindsightAdapter | None = None):
        self.db = db
        self.azure = azure or AzureEmbedder()
        self.hindsight = hindsight or HindsightAdapter()
        self.provider = AZURE if self.azure.available else LOCAL

    def close(self) -> None:
        self.hindsight.close()

    # ---------------------------------------------------------------- search
    def _incidents(self, exclude_dataset: str | None = None) -> list[Incident]:
        q = select(Incident).order_by(Incident.created_at)
        if exclude_dataset:
            q = q.where(Incident.dataset_name != exclude_dataset)
        return list(self.db.scalars(q))

    def _vectors(self, names: list[str], incidents: list[Incident]) -> tuple[str, list, list]:
        """Return (provider, query vectors, incident vectors); falls back to local on any Azure failure."""
        if self.azure.available and names:
            missing = [i for i in incidents if not i.azure_embedding]
            filled = self.azure.embed([i.feature for i in missing]) if missing else []
            query = self.azure.embed(names)
            if query is not None and filled is not None:
                for inc, vec in zip(missing, filled, strict=True):
                    inc.azure_embedding = vec
                return AZURE, query, [i.azure_embedding for i in incidents]
        return LOCAL, local_embed(names), [i.local_embedding for i in incidents]

    def search(self, names: list[str], exclude_dataset: str | None = None) -> tuple[str, list[list[SearchHit]]]:
        incidents = self._incidents(exclude_dataset)
        if not incidents or not names:
            return self.provider, [[] for _ in names]
        provider, qv, iv = self._vectors(names, incidents)
        self.provider = provider
        results = []
        for q in qv:
            hits = [SearchHit(inc, round(cosine(q, v), 4)) for inc, v in zip(incidents, iv, strict=True)]
            hits.sort(key=lambda h: -h.similarity)
            results.append(hits)
        return provider, results

    def match_features(self, features: list[str], exclude_dataset: str) -> tuple[str, dict[str, MemoryEvidence]]:
        """Best past incident per feature, if above the provider's similarity threshold."""
        provider, results = self.search(features, exclude_dataset)
        threshold = THRESHOLDS[provider]
        matches: dict[str, MemoryEvidence] = {}
        for feature, hits in zip(features, results, strict=True):
            if hits and hits[0].similarity >= threshold:
                inc = hits[0].incident
                matches[feature] = MemoryEvidence(inc.id, inc.feature, inc.dataset_name, hits[0].similarity, inc.lesson)
        return provider, matches

    # ---------------------------------------------------------------- record
    def incidents_by_id(self, ids) -> dict[int, Incident]:
        ids = list(set(ids))
        if not ids:
            return {}
        return {i.id: i for i in self.db.scalars(select(Incident).where(Incident.id.in_(ids)))}

    def sync_hindsight(self, inc: Incident) -> bool:
        """Retain (or replace) the incident's full record in Hindsight. False when unavailable."""
        inc.hindsight_document_id = inc.hindsight_document_id or incidents.document_id(inc.dataset_name, inc.feature)
        ok = self.hindsight.retain(
            incidents.hindsight_content(inc),
            context=f"ChronoGuard {inc.incident_type or incidents.INCIDENT_TYPE} incident",
            document_id=inc.hindsight_document_id,
            metadata=incidents.hindsight_metadata(inc),
            tags=incidents.hindsight_tags(inc),
        )
        inc.hindsight_retained = ok or bool(inc.hindsight_retained)
        return ok

    def record(
        self,
        audit_id: int,
        dataset_name: str,
        audit: dict,
        model_name: str | None = None,
        matches: dict[str, MemoryEvidence] | None = None,
    ) -> list[Incident]:
        """Remember each leaked feature. Re-auditing the same dataset updates its incidents."""
        matches = matches or {}
        leaked = [f for f in audit["feature_results"] if f["status"] == "leaked"]
        # Count how often remembered incidents were recalled for this dataset.
        for inc in self.incidents_by_id(m.incident_id for m in matches.values()).values():
            inc.times_recalled = (inc.times_recalled or 0) + 1
        if not leaked:
            self.db.flush()
            return []
        existing = {
            i.feature: i for i in self.db.scalars(select(Incident).where(Incident.dataset_name == dataset_name))
        }
        local = local_embed([f["feature"] for f in leaked])
        azure = self.azure.embed([f["feature"] for f in leaked]) if self.azure.available else None
        out = []
        for idx, f in enumerate(leaked):
            inc = existing.get(f["feature"]) or Incident(dataset_name=dataset_name, feature=f["feature"])
            inc.audit_id = audit_id
            inc.leak_rate = f["leak_rate"]
            inc.median_delay_hours = f["delay_median_hours"]
            inc.max_delay_hours = f["delay_max_hours"]
            inc.affected_decisions = f["leaked"]
            inc.lesson = lesson_text(dataset_name, f)
            inc.lesson_provider = "template"
            inc.local_embedding = local[idx]
            inc.azure_embedding = azure[idx] if azure else inc.azure_embedding
            inc.incident_type = incidents.INCIDENT_TYPE
            inc.model_name = model_name or inc.model_name
            inc.cause = incidents.cause_text(f)
            inc.evidence = incidents.evidence(f)
            inc.solution = incidents.solution_text(f)
            if f["feature"] in matches:
                inc.recurrence_of = matches[f["feature"]].incident_id
            inc.fix_confirmations = inc.fix_confirmations or 0
            inc.fix_rejections = inc.fix_rejections or 0
            inc.times_recalled = inc.times_recalled or 0
            inc.updated_at = datetime.now(UTC)
            self.db.add(inc)
            self.db.flush()
            self.sync_hindsight(inc)
            out.append(inc)
        self.db.flush()
        return out
