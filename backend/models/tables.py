"""ORM tables. Deterministic facts (timestamps, findings, metrics) live here.

Columns added after the first release are nullable or have a server default, so
``database.session.init_db`` can add them to an existing database in place.
"""

from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.session import Base


def _now() -> datetime:
    return datetime.now(UTC)


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str] = mapped_column(String(1024))
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    layout: Mapped[str] = mapped_column(String(16))
    total_rows: Mapped[int] = mapped_column(Integer)
    invalid_rows: Mapped[int] = mapped_column(Integer)
    has_target: Mapped[bool] = mapped_column(Boolean)
    column_mapping: Mapped[dict] = mapped_column(JSON)
    ignored_columns: Mapped[list] = mapped_column(JSON)
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    audits: Mapped[list["Audit"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")


class Audit(Base):
    __tablename__ = "audits"

    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    result: Mapped[dict] = mapped_column(JSON)  # engine.leakage_detector.AuditResult
    risk: Mapped[dict] = mapped_column(JSON)  # engine.risk_scoring.RiskResult
    risk_score: Mapped[float] = mapped_column(Float)
    risk_band: Mapped[str] = mapped_column(String(16))
    memory_provider: Mapped[str] = mapped_column(String(64))
    explanation: Mapped[str] = mapped_column(Text)
    explanation_provider: Mapped[str] = mapped_column(String(64))
    hindsight_context: Mapped[list] = mapped_column(JSON, default=list)
    # The agent's work, recorded as it happened: steps with timings and facts.
    agent_trace: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # Past incidents recognised in this dataset ("similar incidents remembered").
    memory_recall: Mapped[list | None] = mapped_column(JSON, nullable=True)
    recommendations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # Team feedback on the recommended fix: {"successful": bool, "note": str | None, "at": iso}.
    feedback: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    dataset: Mapped[Dataset] = relationship(back_populates="audits")
    replays: Mapped[list["Replay"]] = relationship(back_populates="audit", cascade="all, delete-orphan")


class Replay(Base):
    __tablename__ = "replays"

    id: Mapped[int] = mapped_column(primary_key=True)
    audit_id: Mapped[int] = mapped_column(ForeignKey("audits.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    status: Mapped[str] = mapped_column(String(16))  # "completed" | "unavailable"
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # engine.replay.ReplayResult

    audit: Mapped[Audit] = relationship(back_populates="replays")


class Incident(Base):
    """A leaked feature remembered for future audits (the memory layer's unit)."""

    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    audit_id: Mapped[int] = mapped_column(ForeignKey("audits.id"))
    dataset_name: Mapped[str] = mapped_column(String(255))
    feature: Mapped[str] = mapped_column(String(255))
    leak_rate: Mapped[float] = mapped_column(Float)
    median_delay_hours: Mapped[float] = mapped_column(Float)
    max_delay_hours: Mapped[float] = mapped_column(Float)
    affected_decisions: Mapped[int] = mapped_column(Integer)
    lesson: Mapped[str] = mapped_column(Text)
    lesson_provider: Mapped[str] = mapped_column(String(64))
    local_embedding: Mapped[list] = mapped_column(JSON)
    azure_embedding: Mapped[list | None] = mapped_column(JSON, nullable=True)
    hindsight_retained: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    # Structured incident record (what is retained into Hindsight).
    incident_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    solution: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact_auc_drop: Mapped[float | None] = mapped_column(Float, nullable=True)
    # The earlier incident this one repeats, when memory recognised it at detection time.
    recurrence_of: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Learning signals.
    times_recalled: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    fix_confirmations: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    fix_rejections: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    hindsight_document_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def fix_confidence(self) -> float | None:
        """Laplace-smoothed share of confirmed fixes; None until the team gives feedback."""
        yes, no = self.fix_confirmations or 0, self.fix_rejections or 0
        return None if yes + no == 0 else round((yes + 1) / (yes + no + 2), 4)
