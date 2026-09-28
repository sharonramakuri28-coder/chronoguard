"""Health, dashboard and Command Center KPIs."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api import serializers as ser
from database.session import get_db
from memory.explainer import Explainer
from memory.graph import patterns
from memory.store import MemoryStore
from models import schemas
from models.tables import Audit, Dataset, Incident

router = APIRouter(tags=["system"])


@router.get("/health", response_model=schemas.HealthOut)
def health(db: Session = Depends(get_db)):
    try:
        db.execute(select(1))
        database = "ok"
    except Exception:  # pragma: no cover
        database = "error"
    store = MemoryStore(db)
    hindsight, hindsight_detail = store.hindsight.connection_status()
    store.close()
    return schemas.HealthOut(
        status="ok" if database == "ok" else "degraded",
        database=database,
        embedding_provider=store.provider,
        explanation_provider=Explainer().provider,
        hindsight=hindsight,
        hindsight_detail=hindsight_detail,
    )


def _recurring(audits: list[Audit]) -> int:
    return sum(1 for a in audits for f in a.risk["features"] if f.get("memory") and f["label"].startswith("Recurring"))


def _auc_inflation(summaries: list[schemas.AuditSummary]) -> float | None:
    deltas = [s.auc_delta for s in summaries if s.auc_delta is not None and s.leaked_features]
    return round(-sum(deltas) / len(deltas), 4) if deltas else None


@router.get("/dashboard", response_model=schemas.DashboardOut)
def dashboard(db: Session = Depends(get_db)):
    audits = list(db.scalars(select(Audit).order_by(Audit.id.desc())))
    summaries = [ser.audit_summary(a) for a in audits]
    return schemas.DashboardOut(
        datasets_audited=db.scalar(select(func.count(Dataset.id))) or 0,
        decisions_audited=sum(s.decisions for s in summaries),
        leaked_features=sum(s.leaked_features for s in summaries),
        affected_decisions=sum(s.affected_decisions for s in summaries),
        incidents=db.scalar(select(func.count(Incident.id))) or 0,
        recurring_matches=_recurring(audits),
        average_risk=round(sum(s.risk_score for s in summaries) / len(summaries), 1) if summaries else None,
        replays=sum(1 for s in summaries if s.has_replay),
        mean_auc_inflation=_auc_inflation(summaries),
        audits=summaries,
    )


@router.get("/command-center", response_model=schemas.CommandCenterOut)
def command_center(db: Session = Depends(get_db)):
    """KPIs, each a count over stored rows:

    * models protected      - distinct model names that have been audited
    * repeat failures caught - leaked features that memory recognised from an earlier incident
    * prevented failures    - leaked features whose recommended fix the team confirmed worked
    * memory confidence     - (confirmed + 1) / (feedback + 2) over all fix feedback; null without feedback
    """
    audits = list(db.scalars(select(Audit).order_by(Audit.id.desc())))
    summaries = [ser.audit_summary(a) for a in audits]
    incidents = list(db.scalars(select(Incident).order_by(Incident.id)))
    with_feedback = [a for a in audits if a.feedback]
    yes = sum(1 for a in with_feedback if a.feedback["successful"])
    store = MemoryStore(db)
    hindsight, _ = store.hindsight.connection_status()
    store.close()
    return schemas.CommandCenterOut(
        models_protected=len({a.dataset.model_name or a.dataset.name for a in audits}),
        datasets_audited=len({a.dataset_id for a in audits}),
        decisions_audited=sum(s.decisions for s in summaries),
        incidents_learned=len(incidents),
        repeat_failures_caught=_recurring(audits),
        prevented_failures=sum(len(a.result["leaked_features"]) for a in with_feedback if a.feedback["successful"]),
        feedback_count=len(with_feedback),
        memory_confidence=round((yes + 1) / (len(with_feedback) + 2), 3) if with_feedback else None,
        patterns=len(patterns(incidents)),
        hindsight=hindsight,
        hindsight_retained=sum(1 for i in incidents if i.hindsight_retained),
        average_risk=round(sum(s.risk_score for s in summaries) / len(summaries), 1) if summaries else None,
        mean_auc_inflation=_auc_inflation(summaries),
        audits=summaries,
    )
