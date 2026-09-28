"""Structured incidents: what ChronoGuard retained, and where it was recalled."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from api import serializers as ser
from database.session import get_db
from memory import incidents as inc_mod
from models import schemas
from models.tables import Audit, Incident

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", response_model=list[schemas.IncidentOut])
def list_incidents(db: Session = Depends(get_db)):
    return [ser.incident_out(i) for i in db.scalars(select(Incident).order_by(Incident.created_at.desc()))]


@router.get("/{incident_id}", response_model=schemas.IncidentDetail)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    inc = db.get(Incident, incident_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    origin = db.get(Incident, inc.recurrence_of) if inc.recurrence_of else None
    recurrences = db.scalars(select(Incident).where(Incident.recurrence_of == inc.id).order_by(Incident.id))
    recalled_by = [
        a
        for a in db.scalars(select(Audit).order_by(Audit.id.desc()))
        if any(r["incident_id"] == inc.id for r in a.memory_recall or [])
    ]
    return schemas.IncidentDetail(
        incident=ser.incident_out(inc),
        recurrence_of=ser.incident_out(origin) if origin else None,
        recurrences=[ser.incident_out(i) for i in recurrences],
        recalled_by=[ser.audit_summary(a) for a in recalled_by],
        hindsight_record=inc_mod.hindsight_content(inc),
    )
