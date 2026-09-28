"""Audit and replay pipelines shared by the upload, sample and seed entry points."""

from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.samples_info import SAMPLES
from config import get_settings
from engine.leakage_detector import detect_leakage
from engine.parsing import parse_csv
from engine.replay import ReplayUnavailable, run_replay
from engine.risk_scoring import score_dataset
from memory.explainer import Explainer
from memory.store import MemoryStore
from models.tables import Audit, Dataset, Incident, Replay

log = logging.getLogger(__name__)


def audit_file(db: Session, path: Path, name: str, is_sample: bool = False) -> Audit:
    """Parse -> detect leakage -> recall memory -> score -> explain -> remember. Commits."""
    ds = parse_csv(path.read_bytes())
    dataset = Dataset(
        name=name,
        stored_path=str(path),
        is_sample=is_sample,
        layout=ds.layout,
        total_rows=ds.total_rows,
        invalid_rows=ds.invalid_rows,
        has_target=bool(ds.has_target),
        column_mapping=ds.column_mapping,
        ignored_columns=ds.ignored_columns,
    )
    db.add(dataset)
    db.flush()

    result = detect_leakage(ds)
    store = MemoryStore(db)
    try:
        provider, matches = store.match_features(ds.features, exclude_dataset=name)
        risk = score_dataset(result, matches)
        audit_dict, risk_dict = result.to_dict(), risk.to_dict()
        explanation, explanation_provider = Explainer().explain(name, audit_dict, risk_dict)

        hindsight_context: list[str] = []
        if store.hindsight.configured and result.leaked_features:
            hindsight_context = store.hindsight.recall(
                "Previous temporal leakage incidents involving features similar to: "
                + ", ".join(result.leaked_features)
            )

        audit = Audit(
            dataset_id=dataset.id,
            result=audit_dict,
            risk=risk_dict,
            risk_score=risk.score,
            risk_band=risk.band,
            memory_provider=provider,
            explanation=explanation,
            explanation_provider=explanation_provider,
            hindsight_context=hindsight_context,
        )
        db.add(audit)
        db.flush()

        before = db.scalar(select(func.count(Incident.id)).where(Incident.dataset_name == name)) or 0
        store.record(audit.id, name, audit_dict)
    finally:
        store.close()  # release the Hindsight HTTP session
    after = db.scalar(select(func.count(Incident.id)).where(Incident.dataset_name == name)) or 0
    audit.result = {**audit_dict, "new_incidents": after - before}
    db.commit()
    db.refresh(audit)
    return audit


def replay_audit(db: Session, audit: Audit) -> Replay:
    ds = parse_csv(Path(audit.dataset.stored_path).read_bytes())
    replay = Replay(audit_id=audit.id)
    try:
        replay.result = run_replay(ds, audit.result["leaked_features"]).to_dict()
        replay.status = "completed"
    except ReplayUnavailable as exc:
        replay.status, replay.message = "unavailable", str(exc)
    db.add(replay)
    db.commit()
    db.refresh(replay)
    return replay


def seed_samples(db: Session) -> None:
    """Audit the bundled samples through the real engine so a fresh install is not empty."""
    if db.scalar(select(func.count(Dataset.id))):
        return
    samples_dir = get_settings().samples_dir
    for name in SAMPLES:  # order matters: Q1 creates incidents that Q2 later recalls
        path = samples_dir / name
        if not path.exists():
            log.warning("Sample %s missing; run `python -m scripts.generate_samples`", name)
            continue
        audit = audit_file(db, path, name, is_sample=True)
        replay_audit(db, audit)
        log.info("Seeded %s (risk %.1f)", name, audit.risk_score)
