"""ORM rows -> API response models."""

from memory import incidents
from models import schemas
from models.tables import Audit, Dataset, Incident, Replay


def dataset_out(d: Dataset) -> schemas.DatasetOut:
    return schemas.DatasetOut.model_validate(d, from_attributes=True)


def latest_replay(a: Audit) -> Replay | None:
    return max(a.replays, key=lambda r: r.id) if a.replays else None


def audit_summary(a: Audit) -> schemas.AuditSummary:
    r = a.result
    rep = latest_replay(a)
    return schemas.AuditSummary(
        id=a.id,
        dataset_id=a.dataset_id,
        dataset_name=a.dataset.name,
        model_name=a.dataset.model_name,
        created_at=a.created_at,
        risk_score=a.risk_score,
        risk_band=a.risk_band,
        decisions=r["decisions"],
        features=r["features"],
        leaked_features=len(r["leaked_features"]),
        affected_decisions=r["affected_decisions"],
        has_replay=bool(rep and rep.status == "completed"),
        auc_delta=rep.result["auc_delta"] if rep and rep.result else None,
    )


def audit_out(a: Audit) -> schemas.AuditOut:
    return schemas.AuditOut(
        **a.result,
        id=a.id,
        created_at=a.created_at,
        dataset=dataset_out(a.dataset),
        risk=schemas.RiskOut(**a.risk),
        memory_provider=a.memory_provider,
        explanation=a.explanation,
        explanation_provider=a.explanation_provider,
        hindsight_context=a.hindsight_context or [],
        agent_trace=a.agent_trace or [],
        memory_recall=a.memory_recall or [],
        recommendations=a.recommendations or [],
        headline=incidents.headline(a.recommendations or []),
        feedback=a.feedback,
    )


def replay_out(r: Replay) -> schemas.ReplayOut:
    return schemas.ReplayOut(
        id=r.id,
        audit_id=r.audit_id,
        dataset_name=r.audit.dataset.name,
        created_at=r.created_at,
        status=r.status,
        message=r.message,
        result=schemas.ReplayResult(**r.result) if r.result else None,
    )


def incident_out(i: Incident) -> schemas.IncidentOut:
    return schemas.IncidentOut.model_validate(i, from_attributes=True)
