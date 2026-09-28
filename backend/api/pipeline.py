"""Audit, replay and feedback pipelines shared by the upload, sample and seed entry points.

An audit is the agent's loop: understand the dataset, check temporal availability, search
memory (local incident store + Hindsight), then recommend. Each step is recorded with its
timing and facts in ``Audit.agent_trace`` so the UI can show what the agent actually did.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.samples_info import SAMPLES, SEED_ORDER
from config import get_settings
from engine.leakage_detector import detect_leakage
from engine.parsing import parse_csv
from engine.replay import ReplayUnavailable, run_replay
from engine.risk_scoring import score_dataset
from memory import incidents as inc_mod
from memory.explainer import Explainer
from memory.store import LOCAL, MemoryStore
from models.tables import Audit, Dataset, Incident, Replay

log = logging.getLogger(__name__)


class _Trace:
    def __init__(self) -> None:
        self.steps: list[dict] = []
        self._t = time.perf_counter()

    def step(self, key: str, title: str, detail: str, outcome: str = "ok", **facts) -> None:
        now = time.perf_counter()
        self.steps.append(
            {
                "key": key,
                "title": title,
                "detail": detail,
                "outcome": outcome,
                "ms": round((now - self._t) * 1000),
                "facts": facts,
            }
        )
        self._t = now


def _hindsight_phrase(store: MemoryStore, recalled: list[str]) -> str:
    hs = store.hindsight
    if not hs.base_url or not hs.configured:
        return "Hindsight is not configured, so only the local incident store was searched."
    if recalled:
        return f"Hindsight recalled {len(recalled)} related memor{'y' if len(recalled) == 1 else 'ies'}."
    return "Hindsight returned no related memories."


def audit_file(db: Session, path: Path, name: str, is_sample: bool = False, model_name: str | None = None) -> Audit:
    """Parse -> detect leakage -> recall memory -> score -> recommend -> remember. Commits."""
    trace = _Trace()
    ds = parse_csv(path.read_bytes())
    model_name = model_name or SAMPLES.get(name, {}).get("model") or "Uploaded model"
    ignored = f" Ignored {len(ds.ignored_columns)} non-feature column(s)." if ds.ignored_columns else ""
    trace.step(
        "understand",
        "Understanding dataset",
        f"Read {ds.total_rows:,} rows ({ds.layout} layout): {len(ds.decisions):,} decisions, "
        f"{len(ds.features)} features{', with a target column' if ds.has_target else ''}.{ignored}",
        rows=ds.total_rows,
        decisions=len(ds.decisions),
        features=len(ds.features),
        layout=ds.layout,
    )

    dataset = Dataset(
        name=name,
        stored_path=str(path),
        is_sample=is_sample,
        layout=ds.layout,
        total_rows=ds.total_rows,
        invalid_rows=ds.invalid_rows,
        has_target=bool(ds.has_target),
        column_mapping=ds.column_mapping,
        ignored_columns=ds.ignored_columns,
        model_name=model_name,
    )
    db.add(dataset)
    db.flush()

    result = detect_leakage(ds)
    trace.step(
        "temporal",
        "Checking temporal availability",
        f"Compared {result.observations:,} feature values with their prediction times. "
        + (
            f"{len(result.leaked_features)} feature(s) became available after the prediction: "
            f"{', '.join(result.leaked_features)}."
            if result.leaked_features
            else "Every timestamped feature was available in time."
        ),
        outcome="warning" if result.leaked_features else "ok",
        observations=result.observations,
        leaked_features=len(result.leaked_features),
    )

    store = MemoryStore(db)
    try:
        searched = db.scalar(select(func.count(Incident.id)).where(Incident.dataset_name != name)) or 0
        provider, matches = store.match_features(ds.features, exclude_dataset=name)
        hindsight_context: list[str] = []
        if store.hindsight.configured and result.leaked_features:
            hindsight_context = store.hindsight.recall(
                "Previous temporal leakage incidents involving features similar to: "
                + ", ".join(result.leaked_features)
            )
        audit_dict = result.to_dict()
        recall = inc_mod.build_recall(
            audit_dict, matches, store.incidents_by_id(m.incident_id for m in matches.values())
        )
        vectors = "local vector memory" if provider == LOCAL else "Azure OpenAI embeddings"
        trace.step(
            "memory",
            "Searching memory",
            f"Searched {searched} remembered incident(s) with {vectors}. "
            + (
                f"Found {len(recall)} similar failure pattern(s)"
                + (f", closest {recall[0]['similarity']:.0%} like '{recall[0]['past_feature']}'." if recall else ".")
                if recall
                else "No similar failure pattern in memory."
            )
            + " "
            + _hindsight_phrase(store, hindsight_context),
            outcome="found" if recall else "ok",
            searched=searched,
            matches=len(recall),
            hindsight_memories=len(hindsight_context),
        )

        risk = score_dataset(result, matches)
        risk_dict = risk.to_dict()
        recommendations = inc_mod.build_recommendations(audit_dict, risk_dict, recall)
        explanation, explanation_provider = Explainer().explain(name, audit_dict, risk_dict)
        head = inc_mod.headline(recommendations)
        trace.step(
            "recommend",
            "Generating recommendation",
            (f"{head} " if head else "")
            + f"Risk score {risk.score:.0f}/100 ({risk.band}); {len(recommendations)} recommendation(s).",
            outcome="warning" if recommendations else "ok",
            recommendations=len(recommendations),
            risk_score=risk.score,
        )

        audit = Audit(
            dataset_id=dataset.id,
            result=audit_dict,
            risk=risk_dict,
            risk_score=risk.score,
            risk_band=risk.band,
            memory_provider=provider,
            explanation=explanation,
            explanation_provider=explanation_provider,
            hindsight_context=hindsight_context,
            memory_recall=recall,
            recommendations=recommendations,
        )
        db.add(audit)
        db.flush()

        before = db.scalar(select(func.count(Incident.id)).where(Incident.dataset_name == name)) or 0
        recalled = {r["matched_feature"] for r in recall}  # only matches that were shown as recalled failures
        store.record(audit.id, name, audit_dict, model_name=model_name, matches={f: matches[f] for f in recalled})
        after = db.scalar(select(func.count(Incident.id)).where(Incident.dataset_name == name)) or 0
        retained = sum(
            1 for i in db.scalars(select(Incident).where(Incident.dataset_name == name)) if i.hindsight_retained
        )
        trace.step(
            "retain",
            "Retaining lessons",
            f"Stored {after} incident(s) from this dataset in memory"
            + (f" ({after - before} new)" if after - before else "")
            + (f"; {retained} retained in Hindsight." if store.hindsight.configured else ".")
            if after
            else "Nothing to remember: no feature leaked.",
            incidents=after,
            new_incidents=after - before,
            hindsight_retained=retained,
        )
    finally:
        store.close()  # release the Hindsight HTTP session
    audit.agent_trace = trace.steps
    audit.result = {**audit_dict, "new_incidents": after - before}
    db.commit()
    db.refresh(audit)
    return audit


def replay_audit(db: Session, audit: Audit) -> Replay:
    """Measure the leak's impact; write it back into the incidents (and Hindsight)."""
    ds = parse_csv(Path(audit.dataset.stored_path).read_bytes())
    replay = Replay(audit_id=audit.id)
    try:
        replay.result = run_replay(ds, audit.result["leaked_features"]).to_dict()
        replay.status = "completed"
    except ReplayUnavailable as exc:
        replay.status, replay.message = "unavailable", str(exc)
    db.add(replay)
    if replay.result and replay.result["removed_features"]:
        drops = {a["feature"]: a["auc_drop"] for a in replay.result["ablation"]}
        store = MemoryStore(db)
        try:
            for inc in db.scalars(select(Incident).where(Incident.dataset_name == audit.dataset.name)):
                inc.impact_auc_drop = drops.get(inc.feature)
                inc.impact = inc_mod.impact_text(inc.feature, inc.impact_auc_drop, replay.result)
                store.sync_hindsight(inc)
        finally:
            store.close()
    db.commit()
    db.refresh(replay)
    return replay


def record_feedback(db: Session, audit: Audit, successful: bool, note: str | None) -> list[Incident]:
    """LEARN: the team reports whether the recommended fix worked.

    Updates this dataset's incidents and every remembered incident whose fix was recommended
    again, so future recalls carry the confirmation (or the warning). Changing an answer
    replaces the previous one instead of counting twice.
    """
    affected = list(db.scalars(select(Incident).where(Incident.dataset_name == audit.dataset.name)))
    recalled_ids = {r["incident_id"] for r in (audit.memory_recall or [])}
    affected += [i for i in db.scalars(select(Incident).where(Incident.id.in_(recalled_ids))) if i not in affected]

    previous = audit.feedback
    for inc in affected:
        if previous is not None:
            if previous.get("successful"):
                inc.fix_confirmations = max(0, (inc.fix_confirmations or 0) - 1)
            else:
                inc.fix_rejections = max(0, (inc.fix_rejections or 0) - 1)
        if successful:
            inc.fix_confirmations = (inc.fix_confirmations or 0) + 1
        else:
            inc.fix_rejections = (inc.fix_rejections or 0) + 1
    store = MemoryStore(db)
    try:
        synced = sum(1 for inc in affected if store.sync_hindsight(inc))
    finally:
        store.close()
    audit.feedback = {
        "successful": successful,
        "note": (note or "").strip() or None,
        "at": inc_mod.now_iso(),
        "incidents_updated": len(affected),
        "hindsight_synced": synced,
    }
    db.commit()
    return affected


def seed_samples(db: Session) -> None:
    """Audit the history samples through the real engine so memory starts with some experience."""
    if db.scalar(select(func.count(Dataset.id))):
        return
    samples_dir = get_settings().samples_dir
    for name in SEED_ORDER:
        path = samples_dir / name
        if not path.exists():
            log.warning("Sample %s missing; run `python -m scripts.generate_samples`", name)
            continue
        audit = audit_file(db, path, name, is_sample=True)
        replay_audit(db, audit)
        log.info("Seeded %s (risk %.1f)", name, audit.risk_score)
