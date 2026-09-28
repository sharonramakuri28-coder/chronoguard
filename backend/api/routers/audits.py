"""Audits, affected decisions, model replay and fix feedback (LEARN)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from api import serializers as ser
from api.pipeline import record_feedback, replay_audit
from api.routers import get_audit_or_404
from database.session import get_db
from models import schemas
from models.tables import Audit

router = APIRouter(tags=["audits"])


@router.get("/audits", response_model=list[schemas.AuditSummary])
def list_audits(db: Session = Depends(get_db)):
    return [ser.audit_summary(a) for a in db.scalars(select(Audit).order_by(Audit.id.desc()))]


@router.get("/audits/{audit_id}", response_model=schemas.AuditOut)
def get_audit(audit_id: int, db: Session = Depends(get_db)):
    return ser.audit_out(get_audit_or_404(db, audit_id))


@router.get("/audits/{audit_id}/affected", response_model=schemas.AffectedPage)
def affected_decisions(
    audit_id: int,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    ids = get_audit_or_404(db, audit_id).result.get("affected_decision_ids", [])
    return schemas.AffectedPage(total=len(ids), offset=offset, limit=limit, decision_ids=ids[offset : offset + limit])


@router.post("/audits/{audit_id}/replay", response_model=schemas.ReplayOut, status_code=201)
def run_replay(audit_id: int, db: Session = Depends(get_db)):
    return ser.replay_out(replay_audit(db, get_audit_or_404(db, audit_id)))


@router.get("/audits/{audit_id}/replay", response_model=schemas.ReplayOut | None)
def get_replay(audit_id: int, db: Session = Depends(get_db)):
    """Latest replay for the audit, or null if none has been run yet."""
    rep = ser.latest_replay(get_audit_or_404(db, audit_id))
    return ser.replay_out(rep) if rep else None


@router.post("/audits/{audit_id}/feedback", response_model=schemas.FeedbackOut)
def submit_feedback(audit_id: int, body: schemas.FeedbackIn, db: Session = Depends(get_db)):
    """Was the recommended fix successful? Stored on the incidents and re-retained into Hindsight."""
    audit = get_audit_or_404(db, audit_id)
    updated = record_feedback(db, audit, body.successful, body.note)
    return schemas.FeedbackOut(
        audit_id=audit.id,
        feedback=audit.feedback,
        updated_incidents=[ser.incident_out(i) for i in updated],
        hindsight_synced=sum(1 for i in updated if i.hindsight_retained),
    )
