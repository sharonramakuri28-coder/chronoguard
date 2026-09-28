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
  uploaded_at: string
}

export interface AuditSummary {
  id: number
  dataset_id: number
  dataset_name: string
  created_at: string
  risk_score: number
  risk_band: Band
  decisions: number
  features: number
  leaked_features: number
  affected_decisions: number
  has_replay: boolean
  auc_delta: number | null
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
}

export interface HealthOut {
  status: string
  database: string
  embedding_provider: string
  explanation_provider: string
  hindsight: string
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
