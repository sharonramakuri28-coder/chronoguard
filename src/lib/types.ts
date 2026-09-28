export type TemporalStatus = "safe" | "warning" | "failed";
export type FindingStatus = "safe" | "leakage" | "warning";

export interface Experiment {
  id: string;
  slug: string;
  name: string;
  model: string;
  dataset: string;
  accuracy: number;
  temporalStatus: TemporalStatus;
  leakageRisks: number;
  ranAt: string;
  status: string;
  featuresUsed: string[];
  reauditFlag: boolean;
}

export interface Memory {
  id: string;
  learnedAt: string;
  experiment: string;
  feature: string;
  concept: string;
  lesson: string;
  reason: string;
  outcome: string;
  evidenceCount: number;
  confidence: number;
  tags: string[];
  memoryType: string;
}

export interface Pattern {
  id: string;
  name: string;
  evidenceCount: number;
  examples: string[];
  insight: string;
  recommendation: string;
}

export interface FeatureConcept {
  id: string;
  name: string;
  aliases: string[];
  temporalRule: string;
  unsafeFor: string;
  safeFor: string;
  evidenceCount: number;
  postOutcome: boolean;
}

export interface LeakageIncident {
  id: string;
  experiment: string;
  feature: string;
  description: string;
  severity: "high" | "medium" | "low";
  detectedAt: string;
}

export interface AuditFinding {
  feature: string;
  availability: string;
  status: FindingStatus;
}

export interface AuditRun {
  id: string;
  experimentSlug: string;
  findings: AuditFinding[];
  leakCount: number;
  createdAt: string;
}

export interface ReplayResult {
  id: string;
  experimentSlug: string;
  originalAccuracy: number;
  correctedAccuracy: number;
  createdAt: string;
}

export type DatasetRisk = "high" | "medium" | "low" | "safe";

export interface DatasetFinding {
  column: string;
  matchType: "exact" | "semantic" | "none";
  concept: string | null;
  lesson: string | null;
  risk: DatasetRisk;
  similarity: number;
  temporalRule: string | null;
}

export interface DatasetScan {
  id: string;
  filename: string;
  columns: string[];
  findings: DatasetFinding[];
  decision: string | null;
  createdAt: string;
}

export interface ReauditEvent {
  id: string;
  memoryId: string | null;
  feature: string;
  lesson: string;
  affected: { slug: string; name: string; accuracy: number; feature: string }[];
  createdAt: string;
}

export interface OverviewStats {
  modelAccuracy: number;
  correctedAccuracy: number;
  leakCount: number;
  memoryCount: number;
  reauditCount: number;
  hasAuditRun: boolean;
  hasReplay: boolean;
}

export const DEMO_COLUMNS = ["decision_date", "gdp_revised", "payroll_revision", "cpi_revised", "unemployment_rate"];
