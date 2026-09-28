"""One-click audit reports (JSON with Markdown, or a downloadable .md file)."""

import re

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from api.routers import get_audit_or_404
from database.session import get_db
from models import schemas
from reports.builder import build_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{audit_id}", response_model=schemas.ReportOut)
def get_report(audit_id: int, db: Session = Depends(get_db)):
    title, markdown, at = build_report(get_audit_or_404(db, audit_id))
    return schemas.ReportOut(audit_id=audit_id, title=title, generated_at=at, markdown=markdown)


@router.get("/{audit_id}/download")
def download_report(audit_id: int, db: Session = Depends(get_db)):
    audit = get_audit_or_404(db, audit_id)
    _, markdown, _ = build_report(audit)
    stem = re.sub(r"[^A-Za-z0-9_-]+", "_", audit.dataset.name.rsplit(".", 1)[0])
    return Response(
        markdown,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="chronoguard_audit_{audit_id}_{stem}.md"'},
    )
