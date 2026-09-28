import { motion } from 'framer-motion'
import { ArrowRight, FlaskConical, Info, Loader2, Play } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AblationChart, MetricCompare } from '../components/charts'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { EmptyState, ErrorState, GlassCard, PageHeader, PageSkeleton, Pill, SectionTitle, StatTile } from '../components/ui'
import { useAudit, useReplay, useRunReplay } from '../hooks/useApi'
import { fmtDate, fmtDelta, fmtInt, fmtMetric, fmtPct } from '../lib/format'
import type { ReplayResult } from '../api/types'
import { LatestAuditRedirect } from './LatestAuditRedirect'

export function ReplayRoute() {
  const { id } = useParams()
  if (!id) return <LatestAuditRedirect to={(a) => `/audits/${a}/replay`} />
  return <Replay id={Number(id)} />
}

function Headline({ r }: { r: ReplayResult }) {
  const leaky = r.removed_features.length > 0
  return (
    <GlassCard className="overflow-hidden">
      <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="text-center">
          <p className="label">Baseline ROC-AUC</p>
          <p className="num mt-2 text-5xl font-semibold text-accent-2">
            <AnimatedNumber value={r.baseline.auc} format={fmtMetric} />
          </p>
          <p className="mt-1 text-xs text-muted">all {r.baseline.features.length} features</p>
        </div>
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="mx-auto">
          <ArrowRight className="size-8 text-muted" aria-hidden />
        </motion.div>
        <div className="text-center">
          <p className="label">Leak-free ROC-AUC</p>
          <p className="num mt-2 text-5xl font-semibold text-accent">
            <AnimatedNumber value={r.leak_free.auc} format={fmtMetric} />
          </p>
          <p className="mt-1 text-xs text-muted">{r.leak_free.features.length} features available in time</p>
        </div>
      </div>
      <p className="mt-6 text-center text-base text-slate-200">
        {leaky ? (
          <>
            Removing <span className="font-mono text-leak">{r.removed_features.join(', ')}</span> changes ROC-AUC by{' '}
            <span className="num font-semibold text-white">{fmtDelta(r.auc_delta)}</span>. That is performance the model
            could never have had in production.
          </>
        ) : (
          <>No leaked features were found, so both models are identical: the reported performance is honest.</>
        )}
      </p>
    </GlassCard>
  )
}

function Replay({ id }: { id: number }) {
  const audit = useAudit(id)
  const replay = useReplay(id)
  const run = useRunReplay(id)

  if (audit.isLoading || replay.isLoading) return <PageSkeleton />
  if (audit.error) return <ErrorState error={audit.error} onRetry={() => audit.refetch()} />
  if (replay.error) return <ErrorState error={replay.error} onRetry={() => replay.refetch()} />

  const a = audit.data!
  const rep = replay.data
  const r = rep?.result

  return (
    <>
      <PageHeader
        eyebrow={`Model replay · audit #${a.id}`}
        title={<span className="font-mono text-2xl sm:text-3xl">{a.dataset.name}</span>}
        subtitle="Two identical models are trained on the earliest 70% of decisions and tested on the latest 30%: one with every feature, one with the leaked features removed. The gap is the performance that only existed because of the leak."
        actions={
          <>
            <Link to={`/audits/${a.id}`} className="btn btn-ghost">
              Back to audit
            </Link>
            <button className="btn btn-primary" disabled={run.isPending} onClick={() => run.mutate()}>
              {run.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {rep ? 'Re-run replay' : 'Run replay'}
            </button>
          </>
        }
      />

      {run.error && <ErrorState error={run.error} />}

      {!rep && !run.isPending && (
        <EmptyState icon={<FlaskConical className="size-5" />} title="No replay yet">
          Run the replay to train both models on this dataset and measure the real impact of the leaked features.
        </EmptyState>
      )}
      {run.isPending && !rep && (
        <EmptyState icon={<Loader2 className="size-5 animate-spin" />} title="Training models…">
          Fitting the baseline, the leak-free model and one ablation model per leaked feature.
        </EmptyState>
      )}

      {rep?.status === 'unavailable' && (
        <div className="glass flex items-start gap-3 border-warn/30 p-5">
          <Info className="mt-0.5 size-5 text-warn" aria-hidden />
          <div>
            <p className="font-semibold text-white">Replay not possible for this dataset</p>
            <p className="mt-1 text-sm text-slate-300">{rep.message}</p>
          </div>
        </div>
      )}

      {r && (
        <div className="space-y-4">
          <Headline r={r} />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="AUC change" tone={r.auc_delta < 0 ? 'leak' : 'safe'} value={fmtDelta(r.auc_delta)} sub="leak-free − baseline" />
            <StatTile label="Accuracy change" tone={r.accuracy_delta < 0 ? 'leak' : 'safe'} value={fmtDelta(r.accuracy_delta)} sub={`${fmtPct(r.baseline.accuracy)} → ${fmtPct(r.leak_free.accuracy)}`} />
            <StatTile label="Train / test" value={`${fmtInt(r.train_size)} / ${fmtInt(r.test_size)}`} sub={`test from ${fmtDate(r.test_period_start)}`} />
            <StatTile label="Positive rate (test)" value={fmtPct(r.positive_rate_test)} sub="accuracy alone can mislead at low rates" />
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <GlassCard className="xl:col-span-3">
              <SectionTitle hint="Held-out test period">Before vs after</SectionTitle>
              <MetricCompare baseline={r.baseline} leakFree={r.leak_free} />
            </GlassCard>
            <GlassCard className="xl:col-span-2">
              <SectionTitle hint="AUC lost when only that feature is removed">Leaked feature contribution</SectionTitle>
              {r.ablation.length ? (
                <>
                  <AblationChart items={r.ablation} />
                  <p className="mt-2 text-xs text-muted">
                    Leaked features can overlap: removing one alone may cost little while removing all of them costs{' '}
                    {fmtDelta(r.auc_delta)}.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">No leaked features to ablate.</p>
              )}
            </GlassCard>
          </div>

          <GlassCard>
            <SectionTitle>Measured metrics</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="label">
                  <tr>
                    <th className="py-2 font-semibold">Model</th>
                    {['ROC-AUC', 'Accuracy', 'Precision', 'Recall', 'F1'].map((h) => (
                      <th key={h} className="py-2 text-right font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="num">
                  {[
                    ['Baseline (all features)', r.baseline],
                    ['Leak-free', r.leak_free],
                  ].map(([name, m]) => {
                    const mm = m as typeof r.baseline
                    return (
                      <tr key={name as string} className="border-t border-line">
                        <td className="py-2.5 text-white">{name as string}</td>
                        {[mm.auc, mm.accuracy, mm.precision, mm.recall, mm.f1].map((v, i) => (
                          <td key={i} className="py-2.5 text-right text-slate-300">
                            {fmtMetric(v)}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Pill>{r.model}</Pill>
              <Pill>time-ordered split, no shuffling</Pill>
              <Pill>replayed {fmtDate(rep!.created_at)}</Pill>
            </div>
          </GlassCard>
        </div>
      )}
    </>
  )
}
