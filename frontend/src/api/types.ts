// Mirrors backend/models/schemas.py.

export type Band = 'low' | 'medium' | 'high'
export type FeatureStatus = 'leaked' | 'safe' | 'unverified'

export interface LeakExample {
  decision_id: string
  prediction_time: string
  available_time: string
  delay_hours: number
}

export interface FeatureLeakage {
  feature: string
  status: FeatureStatus
  observations: number
  unverified: number
  leaked: number
  leak_rate: number
  delay_min_hours: number | null
  delay_median_hours: number | null
  delay_p90_hours: number | null
  delay_max_hours: number | null
  lead_median_hours: number | null
  reason: string
  worst_example: LeakExample | null
  delay_histogram: number[]
}

export interface TimelineEvent {
  feature: string
  offset_hours: number | null
  available_time: string | null
  leaked: boolean
}

export interface MemoryEvidence {
  incident_id: number
  feature: string
  dataset_name: string
  similarity: number
  lesson: string
}

export interface FeatureRisk {
  feature: string
  score: number
  band: Band
  label: string
  timestamp_score: number
  memory_score: number
  memory: MemoryEvidence | null
}

export interface RiskOut {
  score: number
  band: Band
  formula: string
  features: FeatureRisk[]
}

export interface DatasetOut {
  id: number
  name: string
  is_sample: boolean
  layout: 'long' | 'wide'
  total_rows: number
  invalid_rows: number
  has_target: boolean
  column_mapping: Record<string, string | null>
  ignored_columns: string[]
  model_name: string | null
  uploaded_at: string
}

export interface AgentStep {
  key: 'understand' | 'temporal' | 'memory' | 'recommend' | 'retain' | string
  title: string
  detail: string
  outcome: 'ok' | 'warning' | 'found' | string
  ms: number
  facts: Record<string, string | number | boolean | null>
}

export interface RecallEntry {
  incident_id: number
  past_feature: string
  past_dataset: string
  past_model: string | null
  learned_at: string | null
  similarity: number
  matched_feature: string
  matched_status: FeatureStatus
  lesson: string
  solution: string | null
  impact: string | null
  fix_confirmations: number
  fix_rejections: number
  fix_confidence: number | null
}

export interface Recommendation {
  feature: string
  priority: Band
  action: string
  reason: string
  memory: string | null
  confidence: number | null
}

export interface Feedback {
  successful: boolean
  note: string | null
  at: string
}

export interface AuditSummary {
  id: number
  dataset_id: number
  dataset_name: string
  model_name: string | null
  created_at: string
  risk_score: number
  risk_band: Band
  decisions: number
  features: number
  leaked_features: number
  affected_decisions: number
  has_replay: boolean
  auc_delta: number | null
  recalled: number
  feedback: Feedback | null
}

export interface AuditOut {
  id: number
  created_at: string
  dataset: DatasetOut
  decisions: number
  observations: number
  features: number
  leaked_features: string[]
  affected_decisions: number
  affected_decision_rate: number
  leaked_observations: number
  observation_leak_rate: number
  period_start: string | null
  period_end: string | null
  feature_results: FeatureLeakage[]
  delay_buckets: string[]
  delay_histogram: number[]
  timeline_decision_id: string | null
  timeline_prediction_time: string | null
  timeline: TimelineEvent[]
  risk: RiskOut
  memory_provider: string
  explanation: string
  explanation_provider: string
  hindsight_context: string[]
  new_incidents: number
  agent_trace: AgentStep[]
  memory_recall: RecallEntry[]
  recommendations: Recommendation[]
  headline: string | null
  feedback: Feedback | null
}

export interface AffectedPage {
  total: number
  offset: number
  limit: number
  decision_ids: string[]
}

export interface ModelMetrics {
  features: string[]
  accuracy: number
  auc: number
  precision: number
  recall: number
  f1: number
}

export interface ReplayResult {
  model: string
  train_size: number
  test_size: number
  train_period_end: string
  test_period_start: string
  positive_rate_test: number
  removed_features: string[]
  baseline: ModelMetrics
  leak_free: ModelMetrics
  auc_delta: number
  accuracy_delta: number
  ablation: { feature: string; auc_without: number; auc_drop: number }[]
}

export interface ReplayOut {
  id: number
  audit_id: number
  dataset_name: string
  created_at: string
  status: 'completed' | 'unavailable'
  message: string | null
  result: ReplayResult | null
}

export interface IncidentOut {
  id: number
  audit_id: number
  dataset_name: string
  feature: string
  leak_rate: number
  median_delay_hours: number
  max_delay_hours: number
  affected_decisions: number
  lesson: string
  lesson_provider: string
  hindsight_retained: boolean
  created_at: string
  incident_type: string | null
  model_name: string | null
  cause: string | null
  evidence: Record<string, string | number | null> | null
  solution: string | null
  impact: string | null
  impact_auc_drop: number | null
  recurrence_of: number | null
  times_recalled: number
  fix_confirmations: number
  fix_rejections: number
  fix_confidence: number | null
  hindsight_document_id: string | null
  updated_at: string | null
}

export interface SearchOut {
  query: string
  provider: string
  threshold: number
  hits: { incident: IncidentOut; similarity: number; is_match: boolean }[]
  hindsight: string[]
}

export interface SampleOut {
  name: string
  title: string
  description: string
  size_bytes: number
  model: string
  group: 'demo' | 'history' | 'more'
  seed: boolean
}

export interface HealthOut {
  status: string
  database: string
  embedding_provider: string
  explanation_provider: string
  /** disabled | package_missing | configured | connected | connection_failed */
  hindsight: string
  hindsight_detail: string | null
}

export interface DashboardOut {
  datasets_audited: number
  decisions_audited: number
  leaked_features: number
  affected_decisions: number
  incidents: number
  recurring_matches: number
  average_risk: number | null
  replays: number
  mean_auc_inflation: number | null
  audits: AuditSummary[]
}

export interface IncidentDetail {
  incident: IncidentOut
  recurrence_of: IncidentOut | null
  recurrences: IncidentOut[]
  recalled_by: AuditSummary[]
  hindsight_record: string
}

export interface FeedbackOut {
  audit_id: number
  feedback: Feedback
  updated_incidents: IncidentOut[]
  hindsight_synced: number
}

export interface GraphNode {
  id: string
  kind: 'incident' | 'pattern' | 'detection'
  label: string
  sublabel: string
  weight: number
  ref: number | null
}

export interface GraphEdge {
  source: string
  target: string
  kind: 'belongs_to' | 'recalled_by'
  similarity: number | null
}

export interface MemoryGraph {
  provider: string
  threshold: number
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface MemoryEvent {
  at: string
  kind: 'learned' | 'recalled' | 'clean' | 'replay' | 'fix_confirmed' | 'fix_rejected'
  title: string
  detail: string
  audit_id: number | null
  incident_id: number | null
}

export interface HindsightStatus {
  state: string
  detail: string | null
  host: string | null
  bank_id: string | null
  retained_incidents: number
  total_incidents: number
}

export interface HindsightRecallOut {
  query: string
  state: string
  memories: string[]
}

export interface HindsightReflectOut {
  query: string
  state: string
  answer: string | null
}

export interface ReportOut {
  audit_id: number
  title: string
  generated_at: string
  markdown: string
}

export interface Citation {
  kind: 'audit' | 'feature' | 'incident' | 'replay' | 'hindsight'
  label: string
  ref: number | null
}

export interface ChatOut {
  answer: string
  intent: string
  provider: 'grounded' | 'hindsight-reflect'
  citations: Citation[]
  suggestions: string[]
}

export interface CommandCenterOut {
  models_protected: number
  datasets_audited: number
  decisions_audited: number
  incidents_learned: number
  repeat_failures_caught: number
  prevented_failures: number
  feedback_count: number
  memory_confidence: number | null
  patterns: number
  hindsight: string
  hindsight_retained: number
  average_risk: number | null
  mean_auc_inflation: number | null
  audits: AuditSummary[]
}
