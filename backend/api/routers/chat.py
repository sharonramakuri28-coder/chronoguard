"""Reliability assistant grounded in an audit and the incident memory."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.routers import get_audit_or_404
from database.session import get_db
from memory import assistant
from memory.hindsight_adapter import HindsightAdapter
from models import schemas
from models.tables import Audit

router = APIRouter(tags=["assistant"])


@router.post("/chat", response_model=schemas.ChatOut)
def chat(body: schemas.ChatIn, db: Session = Depends(get_db)):
    """Answers about the given audit (default: the latest one). Sync route: runs in a worker thread."""
    if body.audit_id is not None:
        audit = get_audit_or_404(db, body.audit_id)
    else:
        audit = db.scalars(select(Audit).order_by(Audit.id.desc()).limit(1)).first()
    hindsight = HindsightAdapter()
    try:
        return assistant.answer(db, body.message, audit, hindsight)
    finally:
        hindsight.close()
