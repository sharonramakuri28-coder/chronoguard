"""Memory Brain: how remembered incidents group into failure patterns and feed new detections.

* incident  - one leaked feature ChronoGuard remembered
* pattern   - incidents whose feature names are similar enough to be the same failure
              (connected components at the memory match threshold, local vectors)
* detection - an audit where memory recalled one of those incidents

Everything is derived from stored incidents and audits; nothing is laid out by hand.
"""

from __future__ import annotations

from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from memory.embeddings import GENERIC_TOKENS, cosine
from memory.store import LOCAL, THRESHOLDS
from models import schemas
from models.tables import Audit, Incident


def patterns(incidents: list[Incident]) -> list[list[Incident]]:
    """Union-find over incidents linked by local similarity >= threshold, oldest first."""
    parent = list(range(len(incidents)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    threshold = THRESHOLDS[LOCAL]
    for i, a in enumerate(incidents):
        for j in range(i + 1, len(incidents)):
            if cosine(a.local_embedding, incidents[j].local_embedding) >= threshold:
                parent[find(j)] = find(i)
    groups: dict[int, list[Incident]] = {}
    for i, inc in enumerate(incidents):
        groups.setdefault(find(i), []).append(inc)
    return sorted(groups.values(), key=lambda g: (-len(g), g[0].id))


def _pattern_label(group: list[Incident]) -> str:
    names = {inc.feature for inc in group}
    if len(names) == 1:
        return group[0].feature
    # Name the pattern by the most specific token its features share (e.g. "investigation").
    tokens = Counter(t for name in names for t in set(name.lower().split("_")) if len(t) > 2)
    top = max(tokens.values(), default=0)
    shared = sorted((t for t, c in tokens.items() if c == top), key=lambda t: (GENERIC_TOKENS.__contains__(t), -len(t)))
    return f"{shared[0]} pattern" if top > 1 and shared else group[0].feature


def build_graph(db: Session) -> schemas.MemoryGraph:
    incidents = list(db.scalars(select(Incident).order_by(Incident.id)))
    groups = patterns(incidents)
    nodes: list[schemas.GraphNode] = []
    edges: list[schemas.GraphEdge] = []
    pattern_of: dict[int, str] = {}
    for n, group in enumerate(groups, start=1):
        pid = f"pattern-{n}"
        datasets = sorted({i.dataset_name for i in group})
        nodes.append(
            schemas.GraphNode(
                id=pid,
                kind="pattern",
                label=_pattern_label(group),
                sublabel=f"{len(group)} incident(s) · {len(datasets)} dataset(s)",
                weight=len(group),
                ref=None,
            )
        )
        for inc in group:
            pattern_of[inc.id] = pid
            nodes.append(
                schemas.GraphNode(
                    id=f"incident-{inc.id}",
                    kind="incident",
                    label=inc.feature,
                    sublabel=inc.dataset_name,
                    weight=inc.leak_rate,
                    ref=inc.id,
                )
            )
            edges.append(schemas.GraphEdge(source=f"incident-{inc.id}", target=pid, kind="belongs_to", similarity=None))

    for audit in db.scalars(select(Audit).order_by(Audit.id)):
        recall = audit.memory_recall or []
        if not recall:
            continue
        aid = f"detection-{audit.id}"
        nodes.append(
            schemas.GraphNode(
                id=aid,
                kind="detection",
                label=audit.dataset.name,
                sublabel=f"audit #{audit.id} · {len(recall)} recalled",
                weight=audit.risk_score,
                ref=audit.id,
            )
        )
        best: dict[str, float] = {}
        for r in recall:
            pid = pattern_of.get(r["incident_id"])
            if pid:
                best[pid] = max(best.get(pid, 0.0), r["similarity"])
        edges += [schemas.GraphEdge(source=p, target=aid, kind="recalled_by", similarity=s) for p, s in best.items()]
    return schemas.MemoryGraph(provider=LOCAL, threshold=THRESHOLDS[LOCAL], nodes=nodes, edges=edges)


def build_timeline(db: Session, limit: int = 200) -> list[schemas.MemoryEvent]:
    events: list[schemas.MemoryEvent] = []
    for inc in db.scalars(select(Incident)):
        events.append(
            schemas.MemoryEvent(
                at=inc.created_at,
                kind="learned",
                title=f"Learned: {inc.feature}",
                detail=f"{inc.incident_type or 'Temporal leakage'} in {inc.dataset_name}"
                + (f" ({inc.model_name})" if inc.model_name else "")
                + f". {inc.solution or inc.lesson}",
                incident_id=inc.id,
                audit_id=inc.audit_id,
            )
        )
    for audit in db.scalars(select(Audit)):
        name, recall, result = audit.dataset.name, audit.memory_recall or [], audit.result
        if recall:
            pairs = ", ".join(f"{r['matched_feature']} ≈ {r['past_feature']}" for r in recall[:4])
            events.append(
                schemas.MemoryEvent(
                    at=audit.created_at,
                    kind="recalled",
                    title=f"Recalled {len(recall)} past incident(s) for {name}",
                    detail=f"{pairs}{' …' if len(recall) > 4 else ''}",
                    audit_id=audit.id,
                )
            )
        elif not result["leaked_features"]:
            events.append(
                schemas.MemoryEvent(
                    at=audit.created_at,
                    kind="clean",
                    title=f"Clean audit: {name}",
                    detail=f"All {result['features']} features were available at prediction time.",
                    audit_id=audit.id,
                )
            )
        for rep in audit.replays:
            if rep.status == "completed" and rep.result and rep.result["removed_features"]:
                r = rep.result
                events.append(
                    schemas.MemoryEvent(
                        at=rep.created_at,
                        kind="replay",
                        title=f"Replay measured inflation in {name}",
                        detail=f"ROC-AUC {r['baseline']['auc']:.3f} → {r['leak_free']['auc']:.3f} "
                        f"without the leaked features.",
                        audit_id=audit.id,
                    )
                )
        if fb := audit.feedback:
            events.append(
                schemas.MemoryEvent(
                    at=fb["at"],
                    kind="fix_confirmed" if fb["successful"] else "fix_rejected",
                    title=f"Fix {'confirmed' if fb['successful'] else 'reported as not working'} for {name}",
                    detail=fb.get("note") or "Team feedback stored in memory; future recalls carry it.",
                    audit_id=audit.id,
                )
            )
    events.sort(key=lambda e: e.at, reverse=True)
    return events[:limit]
