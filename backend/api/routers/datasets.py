"""Dataset upload and the bundled samples."""

import re
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from api import serializers as ser
from api.pipeline import audit_file
from api.samples_info import SAMPLES
from config import get_settings
from database.session import get_db
from engine.parsing import ParseError
from models import schemas

router = APIRouter(tags=["datasets"])


@router.post("/datasets", response_model=schemas.AuditOut, status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    model_name: str | None = Form(None, max_length=255),
    db: Session = Depends(get_db),
):
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
        # Off the event loop: the audit is CPU-bound and the Hindsight client's sync calls need a plain thread.
        audit = await run_in_threadpool(audit_file, db, path, name, False, (model_name or "").strip() or None)
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
    """Serve a bundled sample CSV so anyone can inspect it or upload it themselves."""
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
