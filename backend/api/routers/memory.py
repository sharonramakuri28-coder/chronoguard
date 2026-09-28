"""Memory Brain: incident list (legacy path), semantic search, graph and timeline."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from api import serializers as ser
from database.session import get_db
from memory.graph import build_graph, build_timeline
from memory.store import THRESHOLDS, MemoryStore
from models import schemas
from models.tables import Incident

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("/incidents", response_model=list[schemas.IncidentOut])
def list_incidents(db: Session = Depends(get_db)):
    return [ser.incident_out(i) for i in db.scalars(select(Incident).order_by(Incident.created_at.desc()))]


@router.post("/search", response_model=schemas.SearchOut)
def search_memory(req: schemas.SearchRequest, db: Session = Depends(get_db)):
    query = req.query.strip()
    if not query:
        raise HTTPException(422, "Query is empty.")
    store = MemoryStore(db)
    provider, results = store.search([query])
    recalled = store.hindsight.recall(f"Temporal leakage incidents related to {query}")
    store.close()
    threshold = THRESHOLDS[provider]
    hits = results[0][: max(1, min(req.limit, 20))] if results else []
    db.commit()  # persist any lazily computed Azure vectors
    return schemas.SearchOut(
        query=query,
        provider=provider,
        threshold=threshold,
        hits=[
            schemas.SearchHit(
                incident=ser.incident_out(h.incident), similarity=h.similarity, is_match=h.similarity >= threshold
            )
            for h in hits
        ],
        hindsight=recalled,
    )


@router.get("/graph", response_model=schemas.MemoryGraph)
def memory_graph(db: Session = Depends(get_db)):
    return build_graph(db)


@router.get("/timeline", response_model=list[schemas.MemoryEvent])
def memory_timeline(limit: int = Query(200, ge=1, le=1000), db: Session = Depends(get_db)):
    return build_timeline(db, limit)
