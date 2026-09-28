"""Structured incident records: what ChronoGuard remembers, recalls and learns from.

Every field is generated from measured facts (timestamps, replay metrics, team feedback);
nothing here is invented. The same record is stored in SQL (source of truth, drives scoring)
and retained into Hindsight (long-term organizational memory).
"""

from __future__ import annotations

import re
from datetime import UTC, datetime

from engine.leakage_detector import format_duration
from engine.risk_scoring import MemoryEvidence

INCIDENT_TYPE = "Temporal leakage"
PARTIAL_LEAK_RATE = 0.5  # below this, a leak is usually a late batch job rather than a post-outcome field


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _pct(x: float) -> str:
    return f"{x:.0%}" if x >= 0.01 else f"{x:.1%}"


# ---------------------------------------------------------------------------- incident fields
def cause_text(f: dict) -> str:
    return (
        f"'{f['feature']}' became available after the prediction in {f['leaked']:,} of {f['observations']:,} "
        f"decisions ({_pct(f['leak_rate'])}), a median of {format_duration(f['delay_median_hours'])} and up to "
        f"{format_duration(f['delay_max_hours'])} later. The training table held information that did not exist "
        "at decision time."
    )


def solution_text(f: dict) -> str:
    if f["leak_rate"] < PARTIAL_LEAK_RATE:
        return (
            f"Use the value of '{f['feature']}' as known at prediction time (e.g. the previous batch snapshot); "
            f"{_pct(f['leak_rate'])} of values arrived late."
        )
    return f"Remove '{f['feature']}' from training features; it is only known after the outcome."


def evidence(f: dict) -> dict:
    ex = f.get("worst_example") or {}
    return {
        "leak_rate": f["leak_rate"],
        "leaked": f["leaked"],
        "observations": f["observations"],
        "delay_median_hours": f["delay_median_hours"],
        "delay_p90_hours": f["delay_p90_hours"],
        "delay_max_hours": f["delay_max_hours"],
        "example_decision_id": ex.get("decision_id"),
        "example_prediction_time": ex.get("prediction_time"),
        "example_available_time": ex.get("available_time"),
    }


def impact_text(feature: str, auc_drop: float | None, replay: dict) -> str:
    base, clean = replay["baseline"], replay["leak_free"]
    overall = (
        f"With every leaked feature removed, ROC-AUC went from {base['auc']:.3f} to {clean['auc']:.3f} and "
        f"accuracy from {base['accuracy']:.1%} to {clean['accuracy']:.1%}: the original score was inflated."
    )
    if auc_drop is None:
        return overall
    own = (
        f"Removing '{feature}' alone changed ROC-AUC by {-auc_drop:+.3f}."
        if abs(auc_drop) >= 0.0005
        else f"Removing '{feature}' alone barely moved ROC-AUC; other leaked fields carried the same signal."
    )
    return f"{own} {overall}"


def document_id(dataset_name: str, feature: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", f"{dataset_name}-{feature}".lower()).strip("-")
    return f"chronoguard-incident-{slug}"[:200]


def feedback_summary(inc) -> str | None:
    yes, no = inc.fix_confirmations or 0, inc.fix_rejections or 0
    if yes + no == 0:
        return None
    return f"Team feedback: the fix was confirmed {yes} time(s) and rejected {no} time(s)."


def hindsight_content(inc) -> str:
    """Natural-language record for Hindsight, which extracts facts and entities from text."""
    lines = [
        f"ChronoGuard incident: {inc.incident_type or INCIDENT_TYPE} in {inc.model_name or 'an ML model'} "
        f"(dataset {inc.dataset_name}).",
        f"Problematic feature: {inc.feature}.",
        f"Cause: {inc.cause or inc.lesson}",
    ]
    ev = inc.evidence or {}
    if ev.get("example_decision_id"):
        lines.append(
            f"Timeline evidence: decision {ev['example_decision_id']} was scored at {ev['example_prediction_time']} "
            f"but the value only became available at {ev['example_available_time']}."
        )
    if inc.impact:
        lines.append(f"Impact: {inc.impact}")
    if inc.solution:
        lines.append(f"Fix: {inc.solution}")
    if inc.recurrence_of:
        lines.append("This repeats an earlier ChronoGuard incident with a similar feature.")
    if fb := feedback_summary(inc):
        lines.append(fb)
    lines.append(f"Lesson: {inc.lesson}")
    return "\n".join(lines)


def hindsight_metadata(inc) -> dict[str, str]:
    return {
        "source": "chronoguard",
        "incident_type": inc.incident_type or INCIDENT_TYPE,
        "dataset": inc.dataset_name,
        "model": inc.model_name or "",
        "feature": inc.feature,
        "leak_rate": f"{inc.leak_rate:.4f}",
        "median_delay_hours": f"{inc.median_delay_hours:.2f}",
        "fix_confirmations": str(inc.fix_confirmations or 0),
        "fix_rejections": str(inc.fix_rejections or 0),
    }


def hindsight_tags(inc) -> list[str]:
    tags = ["chronoguard", "incident", "temporal-leakage", f"feature:{inc.feature}"]
    if inc.model_name:
        tags.append(f"model:{inc.model_name}")
    return tags


# ---------------------------------------------------------------------------- recall + recommendations
def build_recall(audit: dict, matches: dict[str, MemoryEvidence], incidents_by_id: dict) -> list[dict]:
    """Remembered incidents that match this dataset's leaked or unverifiable features."""
    status = {f["feature"]: f["status"] for f in audit["feature_results"]}
    out = []
    for feature, m in matches.items():
        if status.get(feature) not in ("leaked", "unverified"):
            continue  # timestamps prove the feature is safe here; not a recalled failure
        inc = incidents_by_id.get(m.incident_id)
        if inc is None:
            continue
        out.append(
            {
                "incident_id": inc.id,
                "past_feature": inc.feature,
                "past_dataset": inc.dataset_name,
                "past_model": inc.model_name,
                "learned_at": inc.created_at.isoformat() if inc.created_at else None,
                "similarity": m.similarity,
                "matched_feature": feature,
                "matched_status": status[feature],
                "lesson": inc.lesson,
                "solution": inc.solution,
                "impact": inc.impact,
                "fix_confirmations": inc.fix_confirmations or 0,
                "fix_rejections": inc.fix_rejections or 0,
                "fix_confidence": inc.fix_confidence,
            }
        )
    out.sort(key=lambda r: -r["similarity"])
    return out


def build_recommendations(audit: dict, risk: dict, recall: list[dict]) -> list[dict]:
    by_feature = {f["feature"]: f for f in audit["feature_results"]}
    remembered = {r["matched_feature"]: r for r in recall}
    recs = []
    for fr in risk["features"]:  # already ordered by risk score
        f = by_feature[fr["feature"]]
        mem = remembered.get(f["feature"])
        memory_note = None
        if mem:
            memory_note = (
                f"Same failure as '{mem['past_feature']}' in {mem['past_dataset']} ({mem['similarity']:.0%} similar)."
            )
            if mem["fix_confirmations"] and mem["fix_confirmations"] >= mem["fix_rejections"]:
                memory_note += f" That fix was confirmed to work {mem['fix_confirmations']} time(s)."
            elif mem["fix_rejections"]:
                memory_note += " The previous fix was reported as not working; check the upstream pipeline too."
        if f["status"] == "leaked":
            recs.append(
                {
                    "feature": f["feature"],
                    "priority": fr["band"],
                    "action": solution_text(f),
                    "reason": cause_text(f),
                    "memory": memory_note,
                    "confidence": mem["fix_confidence"] if mem else None,
                }
            )
        elif f["status"] == "unverified" and mem:
            recs.append(
                {
                    "feature": f["feature"],
                    "priority": fr["band"],
                    "action": f"Add an availability timestamp for '{f['feature']}' before using it.",
                    "reason": "It has no availability timestamp, and it resembles a feature that leaked before.",
                    "memory": memory_note,
                    "confidence": mem["fix_confidence"],
                }
            )
    return recs


def headline(recommendations: list[dict]) -> str | None:
    remove = [r["feature"] for r in recommendations if r["action"].startswith("Remove")]
    if not remove:
        return None
    if len(remove) == 1:
        return f"Remove {remove[0]} before training."
    return f"Remove {', '.join(remove[:-1])} and {remove[-1]} before training."
