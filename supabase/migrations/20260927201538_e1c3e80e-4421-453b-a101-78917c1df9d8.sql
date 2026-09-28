-- ChronoGuard — schema + demo seed

CREATE TABLE public.experiments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  model text not null,
  dataset text not null,
  accuracy numeric not null,
  temporal_status text not null,
  leakage_risks int not null default 0,
  ran_at date not null,
  status text not null,
  features_used text[] not null default '{}',
  reaudit_flag boolean not null default false,
  created_at timestamptz not null default now()
);

CREATE TABLE public.memories (
  id uuid primary key default gen_random_uuid(),
  learned_at timestamptz not null default now(),
  experiment text not null,
  feature text not null,
  concept text not null,
  lesson text not null,
  reason text not null,
  outcome text not null,
  evidence_count int not null default 1,
  confidence numeric not null default 0.9,
  tags text[] not null default '{}',
  memory_type text not null default 'incident',
  created_at timestamptz not null default now()
);

CREATE TABLE public.patterns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  evidence_count int not null default 0,
  examples text[] not null default '{}',
  insight text not null,
  recommendation text not null,
  created_at timestamptz not null default now()
);

CREATE TABLE public.feature_concepts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aliases text[] not null default '{}',
  temporal_rule text not null,
  unsafe_for text not null,
  safe_for text not null,
  evidence_count int not null default 0,
  post_outcome boolean not null default false,
  created_at timestamptz not null default now()
);

CREATE TABLE public.leakage_incidents (
  id uuid primary key default gen_random_uuid(),
  experiment text not null,
  feature text not null,
  description text not null,
  severity text not null,
  detected_at date not null,
  created_at timestamptz not null default now()
);

CREATE TABLE public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  experiment_slug text not null,
  findings jsonb not null default '[]',
  leak_count int not null default 0,
  created_at timestamptz not null default now()
);

CREATE TABLE public.replay_results (
  id uuid primary key default gen_random_uuid(),
  experiment_slug text not null,
  original_accuracy numeric not null,
  corrected_accuracy numeric not null,
  created_at timestamptz not null default now()
);

CREATE TABLE public.dataset_scans (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  columns jsonb not null default '[]',
  findings jsonb not null default '[]',
  decision text,
  created_at timestamptz not null default now()
);

CREATE TABLE public.reaudit_events (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid,
  feature text not null,
  lesson text not null,
  affected jsonb not null default '[]',
  created_at timestamptz not null default now()
);

GRANT SELECT ON public.experiments TO anon;
GRANT ALL ON public.experiments TO service_role;
GRANT SELECT ON public.memories TO anon;
GRANT ALL ON public.memories TO service_role;
GRANT SELECT ON public.patterns TO anon;
GRANT ALL ON public.patterns TO service_role;
GRANT SELECT ON public.feature_concepts TO anon;
GRANT ALL ON public.feature_concepts TO service_role;
GRANT SELECT ON public.leakage_incidents TO anon;
GRANT ALL ON public.leakage_incidents TO service_role;
GRANT SELECT ON public.audit_runs TO anon;
GRANT ALL ON public.audit_runs TO service_role;
GRANT SELECT ON public.replay_results TO anon;
GRANT ALL ON public.replay_results TO service_role;
GRANT SELECT ON public.dataset_scans TO anon;
GRANT ALL ON public.dataset_scans TO service_role;
GRANT SELECT ON public.reaudit_events TO anon;
GRANT ALL ON public.reaudit_events TO service_role;

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leakage_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reaudit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public demo read experiments" ON public.experiments FOR SELECT TO anon USING (true);
CREATE POLICY "Public demo read memories" ON public.memories FOR SELECT TO anon USING (true);
CREATE POLICY "Public demo read patterns" ON public.patterns FOR SELECT TO anon USING (true);
CREATE POLICY "Public demo read feature_concepts" ON public.feature_concepts FOR SELECT TO anon USING (true);
CREATE POLICY "Public demo read leakage_incidents" ON public.leakage_incidents FOR SELECT TO anon USING (true);
CREATE POLICY "Public demo read audit_runs" ON public.audit_runs FOR SELECT TO anon USING (true);
CREATE POLICY "Public demo read replay_results" ON public.replay_results FOR SELECT TO anon USING (true);
CREATE POLICY "Public demo read dataset_scans" ON public.dataset_scans FOR SELECT TO anon USING (true);
CREATE POLICY "Public demo read reaudit_events" ON public.reaudit_events FOR SELECT TO anon USING (true);

INSERT INTO public.experiments (slug, name, model, dataset, accuracy, temporal_status, leakage_risks, ran_at, status, features_used, reaudit_flag) VALUES
('fraud-v7', 'Fraud-v7', 'XGBoost', 'transactions_v7.csv', 97.8, 'failed', 7, CURRENT_DATE, 'Needs Review', ARRAY['transaction_amount','merchant_risk_score','chargeback_status','manual_review_outcome','customer_age'], false),
('fraud-v6', 'Fraud-v6', 'Random Forest', 'transactions_v6.csv', 84.1, 'safe', 0, CURRENT_DATE - 3, 'Clean', ARRAY['transaction_amount','merchant_risk_score','customer_age','device_fingerprint'], false),
('risk-v4', 'Risk-v4', 'Logistic Regression', 'risk_export.csv', 91.6, 'warning', 2, CURRENT_DATE - 14, 'Re-Audit', ARRAY['transaction_amount','refund_result','customer_age','session_duration'], false),
('fraud-v4', 'Fraud-v4', 'Gradient Boosting', 'transactions_v4.csv', 94.8, 'warning', 1, CURRENT_DATE - 42, 'Re-Audit', ARRAY['transaction_amount','merchant_risk_score','manual_review_outcome','customer_age'], true),
('fraud-v3', 'Fraud-v3', 'XGBoost', 'transactions_v3.csv', 96.2, 'warning', 1, CURRENT_DATE - 61, 'Re-Audit', ARRAY['transaction_amount','merchant_risk_score','manual_review_outcome','customer_age'], true),
('macro-v2', 'Macro-v2', 'LightGBM', 'macro_indicators.csv', 88.3, 'warning', 2, CURRENT_DATE - 30, 'Archived', ARRAY['gdp_final','payroll_revision','unemployment_revision','inflation_final'], false);

INSERT INTO public.feature_concepts (name, aliases, temporal_rule, unsafe_for, safe_for, evidence_count, post_outcome) VALUES
('Chargeback Outcome', ARRAY['chargeback_status','cb_resolution','dispute_outcome','chargeback_result','chargeback_flag'], 'Post-transaction only', 'Real-time fraud prediction', 'Historical reporting', 5, true),
('Manual Review Outcome', ARRAY['manual_review_outcome','review_outcome','adjudication_result','analyst_verdict'], 'Post-adjudication only', 'Real-time scoring', 'Case studies and post-hoc analysis', 4, true),
('Merchant Risk Score', ARRAY['merchant_risk_score','mcc_risk'], 'Use only the point-in-time snapshot available at prediction', 'None, if versioned correctly', 'All prediction tasks', 3, false),
('Transaction Amount', ARRAY['transaction_amount','txn_value','txn_amount','amount'], 'Known at transaction time', 'None', 'All prediction tasks', 6, false),
('Customer Age', ARRAY['customer_age','age'], 'Static attribute, known before prediction', 'None', 'All prediction tasks', 2, false);

INSERT INTO public.patterns (name, evidence_count, examples, insight, recommendation) VALUES
('Revised Indicators Pattern', 4, ARRAY['gdp_final','payroll_revision','unemployment_revision','inflation_final'], 'Revised indicators have repeatedly introduced future-information leakage.', 'Run a temporal audit before using revised economic indicators in training data.'),
('Post-Outcome Fields', 6, ARRAY['chargeback_status','refund_result','manual_review_outcome','case_resolution'], 'These fields describe outcomes that only exist after the prediction event.', 'Exclude post-outcome fields from training features, or replay with point-in-time snapshots.');

INSERT INTO public.leakage_incidents (experiment, feature, description, severity, detected_at) VALUES
('Fraud-v7', 'chargeback_status', 'Feature used information unavailable at prediction time (delay +7 days).', 'high', CURRENT_DATE),
('Fraud-v7', 'manual_review_outcome', 'Review decision was fed back as a training feature before it existed.', 'high', CURRENT_DATE),
('Macro-v2', 'gdp_final', 'Backtest used revised GDP value released 19 days after the decision date.', 'medium', CURRENT_DATE - 30),
('Macro-v2', 'payroll_revision', 'Payroll figures revised after decision were used in the March backtest.', 'medium', CURRENT_DATE - 30),
('Risk-v4', 'refund_result', 'Refund outcome recorded 12 days after the scoring event.', 'high', CURRENT_DATE - 14),
('Fraud-v5', 'case_resolution', 'Case resolution field leaked the investigator final decision.', 'high', CURRENT_DATE - 75),
('Fraud-v3', 'unemployment_revision', 'Revised unemployment figure used in place of the preliminary release.', 'medium', CURRENT_DATE - 61);

INSERT INTO public.memories (learned_at, experiment, feature, concept, lesson, reason, outcome, evidence_count, confidence, tags, memory_type) VALUES
(now() - interval '2 hours', 'Fraud-v7', 'chargeback_status', 'Chargeback Outcome', 'Chargeback outcome fields are post-transaction.', 'Chargeback status populates only after the chargeback cycle completes (7-30 days).', '7 leakage findings; replay corrected accuracy 97.8% to 81.4%.', 12, 0.97, ARRAY['post-outcome','fraud','high-impact'], 'incident'),
(now() - interval '2 hours', 'Fraud-v7', 'manual_review_outcome', 'Manual Review Outcome', 'Manual-review outcome is only known after adjudication.', 'Review decisions are written after a human investigator finishes.', 'Flagged as future leakage in the Chrono Audit.', 8, 0.95, ARRAY['post-outcome','review'], 'incident'),
(now() - interval '1 day', 'Macro-v2', 'gdp_final', 'Revised Indicator', 'Revised macro indicators caused leakage in 3 previous experiments.', 'GDP is revised weeks after first release; final value did not exist at decision time.', '2 experiments re-audited and corrected.', 9, 0.93, ARRAY['macro','revision'], 'incident'),
(now() - interval '2 days', 'Macro-v2', 'payroll_revision', 'Revised Indicator', 'Payroll revision columns carry post-decision information.', 'Revisions land weeks after the reference month closes.', 'Flagged medium-risk in temporal audit.', 6, 0.9, ARRAY['macro','revision'], 'incident'),
(now() - interval '3 days', 'Risk-v4', 'refund_result', 'Post-Outcome Field', 'Refund outcomes arrive long after the scoring event.', 'Refunds settle on merchant cycles unrelated to the prediction date.', 'Feature excluded from live scoring.', 7, 0.92, ARRAY['post-outcome','payments'], 'incident'),
(now() - interval '5 days', 'Fraud-v5', 'case_resolution', 'Post-Outcome Field', 'Case resolution leaks the investigator final decision.', 'Resolution is set only when the case is closed.', 'Experiment archived with corrected metrics.', 5, 0.9, ARRAY['post-outcome','ops'], 'incident'),
(now() - interval '7 days', 'Fraud-v3', 'unemployment_revision', 'Revised Indicator', 'Use the preliminary release, never the revised figure, for historical decisions.', 'BLS revises unemployment after the decision window.', 'Backtest rebuilt with point-in-time values.', 4, 0.88, ARRAY['macro'], 'incident'),
(now() - interval '9 days', 'Fraud-v6', 'device_fingerprint', 'Point-in-Time Feature', 'Device fingerprints must be captured at transaction time.', 'Late-arriving fingerprint events were joined by customer id, not event time.', 'Join corrected to event-time snapshot.', 5, 0.86, ARRAY['telemetry'], 'incident'),
(now() - interval '12 days', 'Fraud-v6', 'merchant_risk_score', 'Merchant Risk Score', 'Merchant risk scores are versioned; always pin the version by timestamp.', 'Nightly score re-computation overwrote historical values.', 'Version pinning added to feature store.', 6, 0.91, ARRAY['feature-store'], 'incident'),
(now() - interval '15 days', 'Risk-v4', 'session_duration', 'Point-in-Time Feature', 'Session duration must be truncated at prediction time.', 'Post-prediction browsing was included in the session aggregate.', 'Recomputed with cutoff at scoring timestamp.', 4, 0.87, ARRAY['telemetry'], 'incident'),
(now() - interval '18 days', 'Fraud-v4', 'merchant_risk_score', 'Merchant Risk Score', 'Score snapshots drifted silently after backfill jobs.', 'A backfill recomputed 90 days of scores with the current model.', 'Backfill disabled; snapshots frozen.', 6, 0.9, ARRAY['feature-store','backfill'], 'incident'),
(now() - interval '21 days', 'Macro-v2', 'inflation_final', 'Revised Indicator', 'CPI final prints differ materially from first estimates.', 'CPI revisions change the label distribution retroactively.', 'Dataset rebuilt on first-release values.', 5, 0.89, ARRAY['macro','revision'], 'incident'),
(now() - interval '24 days', 'Fraud-v4', 'manual_review_outcome', 'Manual Review Outcome', 'Review outcome was joined by customer, not by decision time.', 'Historic reviews were attributed to earlier transactions.', 'Re-audit triggered for Fraud-v4.', 7, 0.93, ARRAY['review','join'], 'incident'),
(now() - interval '27 days', 'Fraud-v3', 'manual_review_outcome', 'Manual Review Outcome', 'Review outcomes are post-hoc labels, not features.', 'Investigator verdicts were used as inputs in Fraud-v3.', 'Re-audit triggered for Fraud-v3.', 7, 0.93, ARRAY['review'], 'incident'),
(now() - interval '32 days', 'Risk-v4', 'transaction_amount', 'Transaction Amount', 'Amount is safe only when taken from the transaction record, not settlement.', 'Settlement amounts can differ from authorization amounts.', 'Feature source switched to authorization stream.', 3, 0.85, ARRAY['payments'], 'incident'),
(now() - interval '38 days', 'Fraud-v6', 'transaction_amount', 'Transaction Amount', 'Currency conversion must use the rate at transaction time.', 'A daily average FX table leaked end-of-day rates.', 'FX join moved to tick-level rates.', 3, 0.84, ARRAY['fx'], 'incident'),
(now() - interval '45 days', 'Macro-v2', 'gdp_final', 'Revised Indicator', 'GDP advance estimates are the only knowable value on release day.', 'Final GDP was used for decisions made before the advance estimate.', 'Chronology table added for GDP series.', 8, 0.92, ARRAY['macro'], 'incident'),
(now() - interval '52 days', 'Fraud-v5', 'chargeback_status', 'Chargeback Outcome', 'cb_resolution is semantically related to chargeback_status.', 'Different teams name the same post-outcome field differently.', 'Alias registry created in Hindsight.', 9, 0.94, ARRAY['aliases','fraud'], 'incident'),
(now() - interval '60 days', 'Fraud-v4', 'chargeback_status', 'Chargeback Outcome', 'Chargeback-derived features require a 30-day observation window.', 'Windows shorter than the chargeback cycle import unresolved outcomes.', 'Window policy enforced in dataset builder.', 5, 0.9, ARRAY['windows','fraud'], 'incident'),
(now() - interval '3 days', 'Hindsight', 'chargeback_status', 'Post-Outcome Fields', 'Fields describing outcomes only exist after the prediction event.', 'Aggregated from 6 incidents across 4 experiments.', 'Pattern promoted with high confidence.', 6, 0.95, ARRAY['pattern','post-outcome'], 'pattern'),
(now() - interval '10 days', 'Hindsight', 'gdp_final', 'Revised Indicators Pattern', 'Revised indicators repeatedly introduce future-information leakage.', 'Aggregated from 4 incidents across macro experiments.', 'Pattern promoted; pre-audit recommended.', 4, 0.92, ARRAY['pattern','macro'], 'pattern'),
(now() - interval '20 days', 'Hindsight', 'merchant_risk_score', 'Feature Versioning', 'Recomputable features must be read from point-in-time snapshots.', 'Derived from 3 score-drift incidents.', 'Snapshot reads enforced in feature store.', 3, 0.88, ARRAY['pattern','feature-store'], 'pattern'),
(now() - interval '4 days', 'Hindsight', 'manual_review_outcome', 'Review Outcomes', 'Human-decision fields are labels, never same-time features.', 'Derived from review-outcome incidents in Fraud-v3/v4/v7.', 'Watch rule created for review columns.', 3, 0.9, ARRAY['pattern','review'], 'pattern'),
(now() - interval '1 hour', 'Hindsight', 'chargeback_status', 'Chargeback Outcome', 'Chargeback outcomes are generated after transaction time and caused temporal leakage in previous fraud models.', 'Consolidated lesson from the Chargeback Outcome concept, 5 supporting memories.', 'Applied as watch rule for new datasets.', 5, 0.96, ARRAY['lesson','fraud'], 'lesson');

INSERT INTO public.audit_runs (experiment_slug, findings, leak_count) VALUES
('fraud-v7', '[
  {"feature":"transaction_amount","availability":"Available at prediction time","status":"safe"},
  {"feature":"merchant_risk_score","availability":"Available 6 hours before prediction","status":"safe"},
  {"feature":"chargeback_status","availability":"Available 7-30 days AFTER transaction","status":"leakage"},
  {"feature":"manual_review_outcome","availability":"Available after review decision","status":"leakage"},
  {"feature":"customer_age","availability":"Available before prediction","status":"safe"}
]'::jsonb, 2);
