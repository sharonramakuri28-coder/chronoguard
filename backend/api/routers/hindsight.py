"""Hindsight long-term memory: status, recall and reflect. All fail closed when unavailable."""

from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from database.session import get_db
from memory.store import MemoryStore
from models import schemas
from models.tables import Incident

router = APIRouter(prefix="/hindsight", tags=["hindsight"])


@router.get("/status", response_model=schemas.HindsightStatus)
def status(db: Session = Depends(get_db)):
    store = MemoryStore(db)
    state, detail = store.hindsight.connection_status()
    store.close()
    incidents = list(db.scalars(select(Incident.hindsight_retained)))
    base = store.hindsight.base_url
    return schemas.HindsightStatus(
        state=state,
        detail=detail,
        host=urlparse(base).netloc or None if base else None,
        bank_id=store.hindsight.bank_id if base else None,
        retained_incidents=sum(1 for r in incidents if r),
        total_incidents=len(incidents),
    )


@router.post("/recall", response_model=schemas.HindsightRecallOut)
def recall(body: schemas.HindsightQuery, db: Session = Depends(get_db)):
    store = MemoryStore(db)
    try:
        memories = store.hindsight.recall(body.query, limit=8)
        state, _ = store.hindsight.connection_status()
    finally:
        store.close()
    return schemas.HindsightRecallOut(query=body.query, state=state, memories=memories)


@router.post("/reflect", response_model=schemas.HindsightReflectOut)
def reflect(body: schemas.HindsightQuery, db: Session = Depends(get_db)):
    store = MemoryStore(db)
    try:
        answer = store.hindsight.reflect(body.query)
        state, _ = store.hindsight.connection_status()
    finally:
        store.close()
    return schemas.HindsightReflectOut(query=body.query, state=state, answer=answer)
