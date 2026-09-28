"""API response/request models. The frontend's TypeScript types mirror these."""

from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel

# SQLite returns naive datetimes; everything is stored in UTC, so mark it explicitly.
UTCDatetime = Annotated[datetime, AfterValidator(lambda d: d if d.tzinfo else d.replace(tzinfo=UTC))]


class LeakExample(BaseModel):
    decision_id: str
    prediction_time: str
    available_time: str
    delay_hours: float


class FeatureLeakage(BaseModel):
    feature: str
    status: str
    observations: int
    unverified: int
    leaked: int
    leak_rate: float
    delay_min_hours: float | None
    delay_median_hours: float | None
    delay_p90_hours: float | None
    delay_max_hours: float | None
    lead_median_hours: float | None
    reason: str
    worst_example: LeakExample | None
    delay_histogram: list[int]


class TimelineEvent(BaseModel):
    feature: str
    offset_hours: float | None
    available_time: str | None
    leaked: bool


class MemoryEvidence(BaseModel):
    incident_id: int
    feature: str
    dataset_name: str
    similarity: float
    lesson: str


class FeatureRisk(BaseModel):
    feature: str
    score: float
    band: str
    label: str
    timestamp_score: float
    memory_score: float
    memory: MemoryEvidence | None


class RiskOut(BaseModel):
    score: float
    band: str
    formula: str
    features: list[FeatureRisk]


class DatasetOut(BaseModel):
    id: int
    name: str
    is_sample: bool
    layout: str
    total_rows: int
    invalid_rows: int
    has_target: bool
    column_mapping: dict[str, str | None]
    ignored_columns: list[str]
    uploaded_at: UTCDatetime


class AuditSummary(BaseModel):
    id: int
    dataset_id: int
    dataset_name: str
    created_at: UTCDatetime
    risk_score: float
    risk_band: str
    decisions: int
    features: int
    leaked_features: int
    affected_decisions: int
    has_replay: bool
    auc_delta: float | None


class AuditOut(BaseModel):
    id: int
    created_at: UTCDatetime
    dataset: DatasetOut
    decisions: int
    observations: int
    features: int
    leaked_features: list[str]
    affected_decisions: int
    affected_decision_rate: float
    leaked_observations: int
    observation_leak_rate: float
    period_start: str | None
    period_end: str | None
    feature_results: list[FeatureLeakage]
    delay_buckets: list[str]
    delay_histogram: list[int]
    timeline_decision_id: str | None
    timeline_prediction_time: str | None
    timeline: list[TimelineEvent]
    risk: RiskOut
    memory_provider: str
    explanation: str
    explanation_provider: str
    hindsight_context: list[str]
    new_incidents: int


class AffectedPage(BaseModel):
    total: int
    offset: int
    limit: int
    decision_ids: list[str]


class ModelMetrics(BaseModel):
    features: list[str]
    accuracy: float
    auc: float
    precision: float
    recall: float
    f1: float


class Ablation(BaseModel):
    feature: str
    auc_without: float
    auc_drop: float


class ReplayResult(BaseModel):
    model: str
    train_size: int
    test_size: int
    train_period_end: str
    test_period_start: str
    positive_rate_test: float
    removed_features: list[str]
    baseline: ModelMetrics
    leak_free: ModelMetrics
    auc_delta: float
    accuracy_delta: float
    ablation: list[Ablation]


class ReplayOut(BaseModel):
    id: int
    audit_id: int
    dataset_name: str
    created_at: UTCDatetime
    status: str
    message: str | None
    result: ReplayResult | None


class IncidentOut(BaseModel):
    id: int
    audit_id: int
    dataset_name: str
    feature: str
    leak_rate: float
    median_delay_hours: float
    max_delay_hours: float
    affected_decisions: int
    lesson: str
    lesson_provider: str
    hindsight_retained: bool
    created_at: UTCDatetime


class SearchRequest(BaseModel):
    query: str
    limit: int = 5


class SearchHit(BaseModel):
    incident: IncidentOut
    similarity: float
    is_match: bool


class SearchOut(BaseModel):
    query: str
    provider: str
    threshold: float
    hits: list[SearchHit]
    hindsight: list[str]


class SampleOut(BaseModel):
    name: str
    title: str
    description: str
    size_bytes: int


class HealthOut(BaseModel):
    status: str
    database: str
    embedding_provider: str
    explanation_provider: str
    hindsight: str


class DashboardOut(BaseModel):
    datasets_audited: int
    decisions_audited: int
    leaked_features: int
    affected_decisions: int
    incidents: int
    recurring_matches: int
    average_risk: float | None
    replays: int
    mean_auc_inflation: float | None
    audits: list[AuditSummary]
