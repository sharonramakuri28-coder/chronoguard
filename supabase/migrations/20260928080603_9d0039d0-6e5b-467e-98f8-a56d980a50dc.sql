CREATE TABLE public.demo_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id text NOT NULL,
  model_name text NOT NULL,
  decision_id text NOT NULL UNIQUE,
  feature_name text NOT NULL,
  decision_date date NOT NULL,
  available_date date NOT NULL,
  source text NOT NULL DEFAULT '',
  feature_status text NOT NULL,
  leakage_reason text NOT NULL DEFAULT '',
  original_backtest_return numeric NOT NULL,
  knowledge_correct_return numeric NOT NULL,
  days_of_future_leakage integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.demo_decisions TO anon, authenticated;
GRANT ALL ON public.demo_decisions TO service_role;
ALTER TABLE public.demo_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public demo read demo_decisions" ON public.demo_decisions FOR SELECT TO anon, authenticated USING (true);