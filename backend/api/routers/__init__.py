"""HTTP routes, one module per area. Every number returned is computed by the engine and stored."""

from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session

from models.tables import Audit


def get_audit_or_404(db: Session, audit_id: int) -> Audit:
    audit = db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    return audit


def api_router() -> APIRouter:
    from api.routers import audits, chat, datasets, hindsight, incidents, memory, reports, system

    router = APIRouter(prefix="/api")
    for module in (system, datasets, audits, memory, incidents, hindsight, reports, chat):
        router.include_router(module.router)
    return router
