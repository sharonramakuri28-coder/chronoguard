"""API response/request models. The frontend's TypeScript types mirror these."""

from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field

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
    model_name: str | None = None
    uploaded_at: UTCDatetime


class AgentStep(BaseModel):
    key: str
    title: str
    detail: str
    outcome: str  # ok | warning | found
    ms: int
    facts: dict[str, str | int | float | bool | None]


class RecallEntry(BaseModel):
    incident_id: int
    past_feature: str
    past_dataset: str
    past_model: str | None
    learned_at: str | None
    similarity: float
    matched_feature: str
    matched_status: str
    lesson: str
    solution: str | None
    impact: str | None
    fix_confirmations: int
    fix_rejections: int
    fix_confidence: float | None


class Recommendation(BaseModel):
    feature: str
    priority: str
    action: str
    reason: str
    memory: str | None
    confidence: float | None


class Feedback(BaseModel):
    successful: bool
    note: str | None
    at: str


class AuditSummary(BaseModel):
    id: int
    dataset_id: int
    dataset_name: str
    model_name: str | None = None
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
    agent_trace: list[AgentStep]
    memory_recall: list[RecallEntry]
    recommendations: list[Recommendation]
    headline: str | None
    feedback: Feedback | None


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
    incident_type: str | None = None
    model_name: str | None = None
    cause: str | None = None
    evidence: dict[str, str | int | float | None] | None = None
    solution: str | None = None
    impact: str | None = None
    impact_auc_drop: float | None = None
    recurrence_of: int | None = None
    times_recalled: int = 0
    fix_confirmations: int = 0
    fix_rejections: int = 0
    fix_confidence: float | None = None
    hindsight_document_id: str | None = None
    updated_at: UTCDatetime | None = None


class IncidentDetail(BaseModel):
    incident: IncidentOut
    recurrence_of: IncidentOut | None
    recurrences: list[IncidentOut]
    recalled_by: list[AuditSummary]
    hindsight_record: str


class FeedbackIn(BaseModel):
    successful: bool
    note: str | None = Field(default=None, max_length=1000)


class FeedbackOut(BaseModel):
    audit_id: int
    feedback: Feedback
    updated_incidents: list[IncidentOut]
    hindsight_synced: int


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
    model: str
    group: str  # demo | history | more
    seed: bool


class HealthOut(BaseModel):
    status: str
    database: str
    embedding_provider: str
    explanation_provider: str
    # disabled | package_missing | configured | connected | connection_failed
    hindsight: str
    hindsight_detail: str | None = None


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


# ---------------------------------------------------------------- memory brain
class GraphNode(BaseModel):
    id: str
    kind: str  # incident | pattern | detection
    label: str
    sublabel: str
    weight: float
    ref: int | None  # incident id or audit id


class GraphEdge(BaseModel):
    source: str
    target: str
    kind: str  # belongs_to | recalled_by
    similarity: float | None


class MemoryGraph(BaseModel):
    provider: str
    threshold: float
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class MemoryEvent(BaseModel):
    at: UTCDatetime
    kind: str  # learned | recalled | clean | replay | fix_confirmed | fix_rejected
    title: str
    detail: str
    audit_id: int | None = None
    incident_id: int | None = None


# ---------------------------------------------------------------- hindsight
class HindsightStatus(BaseModel):
    state: str
    detail: str | None
    host: str | None
    bank_id: str | None
    retained_incidents: int
    total_incidents: int


class HindsightQuery(BaseModel):
    query: str = Field(min_length=1, max_length=500)


class HindsightRecallOut(BaseModel):
    query: str
    state: str
    memories: list[str]


class HindsightReflectOut(BaseModel):
    query: str
    state: str
    answer: str | None


# ---------------------------------------------------------------- reports
class ReportOut(BaseModel):
    audit_id: int
    title: str
    generated_at: UTCDatetime
    markdown: str


# ---------------------------------------------------------------- chat
class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    audit_id: int | None = None


class Citation(BaseModel):
    kind: str  # audit | feature | incident | replay | hindsight
    label: str
    ref: int | None = None


class ChatOut(BaseModel):
    answer: str
    intent: str
    provider: str  # grounded | hindsight-reflect
    citations: list[Citation]
    suggestions: list[str]


# ---------------------------------------------------------------- command center
class CommandCenterOut(BaseModel):
    models_protected: int
    datasets_audited: int
    decisions_audited: int
    incidents_learned: int
    repeat_failures_caught: int
    prevented_failures: int
    feedback_count: int
    memory_confidence: float | None
    patterns: int
    hindsight: str
    hindsight_retained: int
    average_risk: float | None
    mean_auc_inflation: float | None
    audits: list[AuditSummary]
