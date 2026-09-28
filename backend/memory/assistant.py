"""Reliability assistant: answers questions about an audit from its stored evidence and memory.

Answers are assembled from the audit, its replay and the incident memory, and every answer
cites what it used. Memory questions are also sent to Hindsight ``reflect`` when it is
configured; otherwise the local incident store answers them. Nothing is generated freely.
"""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.serializers import latest_replay
from memory import incidents as inc_mod
from memory.hindsight_adapter import HindsightAdapter
from models import schemas
from models.tables import Audit, Incident

GROUNDED = "grounded"
REFLECT = "hindsight-reflect"

SUGGESTIONS = [
    "Why was {feature} risky?",
    "Have we seen this failure before?",
    "What should I fix first?",
    "Why did the replay score drop?",
    "How was the risk score calculated?",
]

_INTENTS = [
    ("memory", r"\b(before|seen|remember|memory|past|previous|history|similar|recur|again|learn)"),
    ("replay", r"\b(replay|inflat|accura|auc|drop|perform|metric|score (drop|fell))"),
    ("fix", r"\b(fix|recommend|should i|what to do|next step|remove|action|priorit)"),
    ("risk", r"\b(risk|score|formula|calculat|band)"),
    ("summary", r"\b(summar|overview|what happened|explain|tl;?dr)"),
]


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def _find_feature(message: str, audit: Audit) -> dict | None:
    msg = f" {_norm(message)} "
    features = sorted(audit.result["feature_results"], key=lambda f: -len(f["feature"]))
    return next((f for f in features if f" {_norm(f['feature'])} " in msg), None)


def _intent(message: str) -> str:
    m = message.lower()
    return next((name for name, pattern in _INTENTS if re.search(pattern, m)), "summary")


def _suggestions(audit: Audit) -> list[str]:
    leaked = audit.result["leaked_features"]
    feature = leaked[0] if leaked else audit.result["feature_results"][0]["feature"]
    return [s.format(feature=feature) for s in SUGGESTIONS]


def _feature_answer(f: dict, audit: Audit) -> tuple[str, list[schemas.Citation]]:
    risk = next(x for x in audit.risk["features"] if x["feature"] == f["feature"])
    cites = [schemas.Citation(kind="feature", label=f["feature"], ref=audit.id)]
    if f["status"] == "leaked":
        text = inc_mod.cause_text(f)
        if ex := f.get("worst_example"):
            text += (
                f" For example, decision {ex['decision_id']} was scored at {ex['prediction_time']} but the value "
                f"only appeared at {ex['available_time']}."
            )
        text += (
            f" A model trained on it learns from the outcome itself, so its offline score looks better than it "
            f"can be in production. Risk {risk['score']:.0f}/100 ({risk['band']}, {risk['label'].lower()})."
        )
    elif f["status"] == "unverified":
        text = (
            f"'{f['feature']}' has no availability timestamp, so ChronoGuard cannot prove it existed at prediction "
            f"time. Risk {risk['score']:.0f}/100 ({risk['label'].lower()})."
        )
    else:
        text = f"'{f['feature']}' is not risky here: {f['reason']} Risk {risk['score']:.0f}/100."
    rec = next((r for r in audit.recommendations or [] if r["feature"] == f["feature"]), None)
    mem = next((m for m in audit.memory_recall or [] if m["matched_feature"] == f["feature"]), None)
    if mem:
        text += (
            f"\n\nMemory: it matches incident #{mem['incident_id']} '{mem['past_feature']}' from "
            f"{mem['past_dataset']} ({mem['similarity']:.0%} similar). {mem['lesson']}"
        )
        cites.append(schemas.Citation(kind="incident", label=mem["past_feature"], ref=mem["incident_id"]))
    if rec:
        text += f"\n\nRecommended: {rec['action']}"
    return text, cites


def _memory_answer(db: Session, audit: Audit) -> tuple[str, list[schemas.Citation]]:
    recall = audit.memory_recall or []
    if not recall:
        total = len(list(db.scalars(select(Incident.id).where(Incident.dataset_name != audit.dataset.name))))
        return (
            f"No. ChronoGuard searched {total} remembered incident(s) from other datasets and none matched "
            f"{audit.dataset.name}'s risky features. "
            + (
                "Its leaked features are now in memory, so the next dataset will be checked against them."
                if audit.result["leaked_features"]
                else ""
            ),
            [schemas.Citation(kind="audit", label=f"Audit #{audit.id}", ref=audit.id)],
        )
    lines = [f"Yes. {len(recall)} feature(s) in {audit.dataset.name} match failures ChronoGuard remembered:"]
    cites = []
    for m in recall:
        fb = ""
        if m["fix_confirmations"] or m["fix_rejections"]:
            fb = f" Fix feedback: {m['fix_confirmations']} confirmed, {m['fix_rejections']} rejected."
        lines.append(
            f"- {m['matched_feature']} ≈ {m['past_feature']} ({m['similarity']:.0%}) from {m['past_dataset']}, "
            f"learned {(m['learned_at'] or '')[:10]}. Past fix: {m['solution'] or m['lesson']}{fb}"
        )
        cites.append(schemas.Citation(kind="incident", label=m["past_feature"], ref=m["incident_id"]))
    return "\n".join(lines), cites


def _replay_answer(audit: Audit) -> tuple[str, list[schemas.Citation]]:
    rep = latest_replay(audit)
    if not rep:
        return "The replay has not been run for this audit yet. Run it from Model Replay to measure the impact.", []
    if rep.status != "completed":
        return f"The replay could not run: {rep.message}", []
    r = rep.result
    b, c = r["baseline"], r["leak_free"]
    cite = [schemas.Citation(kind="replay", label=f"Replay of audit #{audit.id}", ref=audit.id)]
    if not r["removed_features"]:
        return f"Nothing was removed; the model scored ROC-AUC {b['auc']:.3f} with every feature.", cite
    text = (
        f"With the leaked features the model scored ROC-AUC {b['auc']:.3f} and accuracy {b['accuracy']:.1%}. "
        f"Trained again without {', '.join(r['removed_features'])} on the same time-ordered split, it scored "
        f"{c['auc']:.3f} and {c['accuracy']:.1%}. The previous score was inflated because future information "
        "was used; the leak-free number is what the model can do in production."
    )
    if r["ablation"]:
        top = r["ablation"][0]
        text += f" Alone, removing '{top['feature']}' changed ROC-AUC by {-top['auc_drop']:+.3f}."
    return text, cite


def _fix_answer(audit: Audit) -> tuple[str, list[schemas.Citation]]:
    recs = audit.recommendations or []
    if not recs:
        return "Nothing needs fixing: no feature leaked in this audit.", []
    lines = [inc_mod.headline(recs) or "Recommended fixes, highest risk first:"]
    for i, r in enumerate(recs[:6], start=1):
        lines.append(f"{i}. {r['action']}" + (f" ({r['memory']})" if r.get("memory") else ""))
    return "\n".join(lines), [schemas.Citation(kind="feature", label=r["feature"], ref=audit.id) for r in recs[:6]]


def _risk_answer(audit: Audit) -> tuple[str, list[schemas.Citation]]:
    risk = audit.risk
    top = risk["features"][:3]
    parts = [f"Risk {risk['score']:.0f}/100 ({risk['band']}). Formula: {risk['formula']}."]
    parts += [
        f"- {f['feature']}: {f['score']:.0f} ({f['label']}; timestamp evidence {f['timestamp_score']:.0f}, "
        f"memory {f['memory_score']:.0f})"
        for f in top
    ]
    return "\n".join(parts), [schemas.Citation(kind="audit", label=f"Audit #{audit.id}", ref=audit.id)]


def answer(db: Session, message: str, audit: Audit | None, hindsight: HindsightAdapter) -> schemas.ChatOut:
    if audit is None:
        return schemas.ChatOut(
            answer="Run an audit first; I answer from an audit's evidence and ChronoGuard's incident memory.",
            intent="no_audit",
            provider=GROUNDED,
            citations=[],
            suggestions=[],
        )
    feature = _find_feature(message, audit)
    intent = _intent(message)
    provider = GROUNDED
    if feature and intent not in ("memory", "replay"):
        intent = "feature"
        text, cites = _feature_answer(feature, audit)
    elif intent == "memory":
        text, cites = _memory_answer(db, audit)
        reflection = hindsight.reflect(message + f" (context: ChronoGuard audit of {audit.dataset.name})")
        if reflection:
            text += f"\n\nHindsight reflection:\n{reflection}"
            provider = REFLECT
            cites.append(schemas.Citation(kind="hindsight", label=f"Hindsight bank {hindsight.bank_id}"))
    elif intent == "replay":
        text, cites = _replay_answer(audit)
    elif intent == "fix":
        text, cites = _fix_answer(audit)
    elif intent == "risk":
        text, cites = _risk_answer(audit)
    else:
        text, cites = audit.explanation, [schemas.Citation(kind="audit", label=f"Audit #{audit.id}", ref=audit.id)]
    return schemas.ChatOut(
        answer=text, intent=intent, provider=provider, citations=cites, suggestions=_suggestions(audit)
    )
