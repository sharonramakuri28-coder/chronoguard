"""HTTP routes. Every number returned is computed by the engine and stored in the database."""

from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api import serializers as ser
from api.pipeline import audit_file, replay_audit
from api.samples_info import SAMPLES
from config import get_settings
from database.session import get_db
from engine.parsing import ParseError
from memory.explainer import Explainer
from memory.hindsight_adapter import HindsightAdapter
from memory.store import THRESHOLDS, MemoryStore
from models import schemas
from models.tables import Audit, Dataset, Incident

router = APIRouter(prefix="/api")


def _get_audit(db: Session, audit_id: int) -> Audit:
    audit = db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    return audit


# ---------------------------------------------------------------- health
@router.get("/health", response_model=schemas.HealthOut)
def health(db: Session = Depends(get_db)):
    try:
        db.execute(select(1))
        database = "ok"
    except Exception:  # pragma: no cover
        database = "error"
    store = MemoryStore(db)
    hs = HindsightAdapter()
    return schemas.HealthOut(
        status="ok" if database == "ok" else "degraded",
        database=database,
        embedding_provider=store.provider,
        explanation_provider=Explainer().provider,
        hindsight="enabled" if hs.configured else ("error" if hs.error else "disabled"),
    )


# ---------------------------------------------------------------- datasets
@router.post("/datasets", response_model=schemas.AuditOut, status_code=201)
async def upload_dataset(file: UploadFile = File(...), db: Session = Depends(get_db)):
    settings = get_settings()
    name = (file.filename or "upload.csv").strip()
    if not name.lower().endswith(".csv"):
        raise HTTPException(415, "Please upload a .csv file.")
    limit = settings.max_upload_mb * 1024 * 1024
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(413, f"File is larger than {settings.max_upload_mb} MB.")
    if not content.strip():
        raise HTTPException(422, "The file is empty.")

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", name)[-120:]
    path = settings.upload_dir / f"{uuid.uuid4().hex[:12]}_{safe}"
    path.write_bytes(content)
    try:
        audit = audit_file(db, path, name)
    except ParseError as exc:
        db.rollback()
        path.unlink(missing_ok=True)
        raise HTTPException(422, str(exc)) from exc
    return ser.audit_out(audit)


@router.get("/samples", response_model=list[schemas.SampleOut])
def list_samples():
    d = get_settings().samples_dir
    return [
        schemas.SampleOut(name=n, size_bytes=(d / n).stat().st_size, **info)
        for n, info in SAMPLES.items()
        if (d / n).exists()
    ]


@router.get("/samples/{name}/download")
def download_sample(name: str):
    """Serve a bundled sample CSV so judges can inspect it or upload it themselves."""
    path = get_settings().samples_dir / name
    if name not in SAMPLES or not path.exists():
        raise HTTPException(404, "Unknown sample")
    return FileResponse(path, media_type="text/csv", filename=name)


@router.post("/samples/{name}/audit", response_model=schemas.AuditOut, status_code=201)
def audit_sample(name: str, db: Session = Depends(get_db)):
    if name not in SAMPLES:
        raise HTTPException(404, "Unknown sample")
    path = get_settings().samples_dir / name
    if not path.exists():
        raise HTTPException(404, "Sample file missing; run `python -m scripts.generate_samples`.")
    return ser.audit_out(audit_file(db, path, name, is_sample=True))


# ---------------------------------------------------------------- audits
@router.get("/audits", response_model=list[schemas.AuditSummary])
def list_audits(db: Session = Depends(get_db)):
    return [ser.audit_summary(a) for a in db.scalars(select(Audit).order_by(Audit.id.desc()))]


@router.get("/audits/{audit_id}", response_model=schemas.AuditOut)
def get_audit(audit_id: int, db: Session = Depends(get_db)):
    return ser.audit_out(_get_audit(db, audit_id))


@router.get("/audits/{audit_id}/affected", response_model=schemas.AffectedPage)
def affected_decisions(
    audit_id: int,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    ids = _get_audit(db, audit_id).result.get("affected_decision_ids", [])
    return schemas.AffectedPage(total=len(ids), offset=offset, limit=limit, decision_ids=ids[offset : offset + limit])


@router.post("/audits/{audit_id}/replay", response_model=schemas.ReplayOut, status_code=201)
def run_replay(audit_id: int, db: Session = Depends(get_db)):
    return ser.replay_out(replay_audit(db, _get_audit(db, audit_id)))


@router.get("/audits/{audit_id}/replay", response_model=schemas.ReplayOut | None)
def get_replay(audit_id: int, db: Session = Depends(get_db)):
    """Latest replay for the audit, or null if none has been run yet."""
    rep = ser.latest_replay(_get_audit(db, audit_id))
    return ser.replay_out(rep) if rep else None


# ---------------------------------------------------------------- memory
@router.get("/memory/incidents", response_model=list[schemas.IncidentOut])
def list_incidents(db: Session = Depends(get_db)):
    return [ser.incident_out(i) for i in db.scalars(select(Incident).order_by(Incident.created_at.desc()))]


@router.post("/memory/search", response_model=schemas.SearchOut)
def search_memory(req: schemas.SearchRequest, db: Session = Depends(get_db)):
    query = req.query.strip()
    if not query:
        raise HTTPException(422, "Query is empty.")
    store = MemoryStore(db)
    provider, results = store.search([query])
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
        hindsight=store.hindsight.recall(f"Temporal leakage incidents related to {query}"),
    )


# ---------------------------------------------------------------- dashboard
@router.get("/dashboard", response_model=schemas.DashboardOut)
def dashboard(db: Session = Depends(get_db)):
    audits = list(db.scalars(select(Audit).order_by(Audit.id.desc())))
    summaries = [ser.audit_summary(a) for a in audits]
    deltas = [s.auc_delta for s in summaries if s.auc_delta is not None and s.leaked_features]
    recurring = sum(
        1 for a in audits for f in a.risk["features"] if f.get("memory") and f["label"].startswith("Recurring")
    )
    return schemas.DashboardOut(
        datasets_audited=db.scalar(select(func.count(Dataset.id))) or 0,
        decisions_audited=sum(s.decisions for s in summaries),
        leaked_features=sum(s.leaked_features for s in summaries),
        affected_decisions=sum(s.affected_decisions for s in summaries),
        incidents=db.scalar(select(func.count(Incident.id))) or 0,
        recurring_matches=recurring,
        average_risk=round(sum(s.risk_score for s in summaries) / len(summaries), 1) if summaries else None,
        replays=sum(1 for s in summaries if s.has_replay),
        mean_auc_inflation=round(-sum(deltas) / len(deltas), 4) if deltas else None,
        audits=summaries,
    )
