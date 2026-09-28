import { Bot, Brain, FileText, FlaskConical, Lightbulb, RotateCcw, ScanSearch, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AgentThinking } from '../components/AgentThinking'
import { DelayHistogram } from '../components/charts'
import { FeedbackPrompt, RecallPanel, Recommendations, ReportLink } from '../components/MemoryPanels'
import { EvidencePanel } from '../components/EvidencePanel'
import { FeatureRiskTable } from '../components/FeatureRiskTable'
import { LeakageTimeline } from '../components/LeakageTimeline'
import { RiskGauge } from '../components/RiskGauge'
import { EmptyState, ErrorState, GlassCard, PageHeader, PageSkeleton, Pill, SectionTitle, StatTile } from '../components/ui'
import { useAffected, useAudit } from '../hooks/useApi'
import { fmtDate, fmtInt, fmtPct, providerLabel } from '../lib/format'
import { LatestAuditRedirect } from './LatestAuditRedirect'

export function AuditResultsRoute() {
  const { id } = useParams()
  if (!id) return <LatestAuditRedirect to={(a) => `/audits/${a}`} />
  return <AuditResults id={Number(id)} />
}

function AffectedDecisions({ id, total }: { id: number; total: number }) {
  const limit = 24
  const [offset, setOffset] = useState(0)
  const { data } = useAffected(id, offset, limit)
  if (!total) return <p className="text-sm text-muted">No decisions used future information.</p>
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {data?.decision_ids.map((d) => (
          <span key={d} className="rounded-md border border-leak/25 bg-leak/[0.06] px-2 py-0.5 font-mono text-[11px] text-slate-200">
            {d}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span className="num">
          {fmtInt(offset + 1)}–{fmtInt(Math.min(offset + limit, total))} of {fmtInt(total)}
        </span>
        <div className="flex gap-2">
          <button className="btn btn-ghost h-8 px-3 text-xs" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
            Previous
          </button>
          <button className="btn btn-ghost h-8 px-3 text-xs" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

function AuditResults({ id }: { id: number }) {
  const { data: a, isLoading, error, refetch } = useAudit(id)
  const [selected, setSelected] = useState<string | null>(null)
  const [replayKey, setReplayKey] = useState(0)
  const { hash } = useLocation()
  const loaded = !!a

  useEffect(() => {
    if (loaded && hash) window.setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
  }, [loaded, hash])

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!a) return <EmptyState icon={<ScanSearch className="size-5" />} title="Audit not found" />

  const current = selected ?? a.risk.features[0]?.feature ?? null
  const feature = a.feature_results.find((f) => f.feature === current)
  const risk = a.risk.features.find((f) => f.feature === current)
  const recurring = a.risk.features.filter((f) => f.label.startsWith('Recurring')).length

  return (
    <>
      <PageHeader
        eyebrow={`Audit #${a.id} · ${fmtDate(a.created_at)}`}
        title={<span className="font-mono text-2xl sm:text-3xl">{a.dataset.name}</span>}
        subtitle={
          <span className="flex flex-wrap gap-2">
            {a.dataset.model_name && <Pill className="text-accent">{a.dataset.model_name}</Pill>}
            {a.dataset.is_sample && <Pill>synthetic sample</Pill>}
            <Pill>{a.dataset.layout} layout</Pill>
            <Pill>{fmtInt(a.dataset.total_rows)} rows</Pill>
            <Pill>
              {fmtDate(a.period_start)} – {fmtDate(a.period_end)}
            </Pill>
            {a.dataset.invalid_rows > 0 && <Pill className="text-warn">{fmtInt(a.dataset.invalid_rows)} rows without valid timestamps</Pill>}
            {a.dataset.ignored_columns.length > 0 && (
              <Pill>Ignored (not used as evidence): {a.dataset.ignored_columns.join(', ')}</Pill>
            )}
          </span>
        }
        actions={
          <>
            <ReportLink id={a.id} />
            <Link to={`/audits/${a.id}/replay`} className="btn btn-primary">
              <FlaskConical className="size-4" aria-hidden /> Replay model
            </Link>
          </>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <GlassCard className="glass-strong">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="size-4 text-accent" aria-hidden /> Agent reasoning
            </h2>
            <button className="btn btn-ghost h-8 px-2.5 text-xs" onClick={() => setReplayKey((k) => k + 1)} aria-label="Replay agent steps">
              <RotateCcw className="size-3.5" aria-hidden /> Replay
            </button>
          </div>
          <AgentThinking steps={a.agent_trace} replayKey={replayKey} />
        </GlassCard>
        <GlassCard className="glass-strong" delay={0.05}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Brain className="size-4 text-memory" aria-hidden /> Similar incidents remembered
            </h2>
            <span className="text-xs text-muted">{a.memory_recall.length} recalled</span>
          </div>
          <RecallPanel audit={a} />
        </GlassCard>
      </div>

      {a.leaked_features.length > 0 && (
        <div className="mb-4 grid gap-4 lg:grid-cols-5">
          <GlassCard className="lg:col-span-3" delay={0.08}>
            <SectionTitle hint="Highest risk first">
              <span className="flex items-center gap-2">
                <Lightbulb className="size-4 text-accent" aria-hidden /> Recommendations
              </span>
            </SectionTitle>
            <Recommendations recs={a.recommendations} />
          </GlassCard>
          <div className="lg:col-span-2" id="feedback">
            <FeedbackPrompt audit={a} />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <GlassCard className="flex flex-col items-center justify-center gap-2">
          <RiskGauge score={a.risk.score} band={a.risk.band} size={180} />
          <p className="max-w-[16rem] text-center text-[11px] text-muted">{a.risk.formula}</p>
        </GlassCard>
        <div className="grid grid-cols-2 gap-4 lg:col-span-3">
          <StatTile label="Decisions audited" value={fmtInt(a.decisions)} sub={`${fmtInt(a.observations)} feature values checked`} />
          <StatTile
            label="Leaked features"
            tone={a.leaked_features.length ? 'leak' : 'safe'}
            value={`${a.leaked_features.length} / ${a.features}`}
            sub={a.leaked_features.length ? a.leaked_features.join(', ') : 'none'}
          />
          <StatTile
            label="Affected decisions"
            tone={a.affected_decisions ? 'leak' : 'safe'}
            value={fmtPct(a.affected_decision_rate)}
            sub={`${fmtInt(a.affected_decisions)} decisions used future information`}
          />
          <StatTile
            label="Recurring leaks"
            tone="memory"
            value={recurring}
            sub={`${a.new_incidents} new incident${a.new_incidents === 1 ? '' : 's'} stored in memory`}
          />
        </div>
      </div>

      <GlassCard className="mt-4" delay={0.05}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="label flex items-center gap-2 text-accent">
            {a.explanation_provider === 'azure-openai' ? <Bot className="size-3.5" /> : <FileText className="size-3.5" />}
            Audit explanation
          </p>
          <Pill>{providerLabel(a.explanation_provider)}</Pill>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-200">{a.explanation}</p>
        {a.hindsight_context.length > 0 && (
          <div className="mt-4 rounded-xl border border-memory/25 bg-memory/[0.04] p-3">
            <p className="label mb-2 flex items-center gap-2 text-memory">
              <Brain className="size-3.5" /> Hindsight recall
            </p>
            <ul className="space-y-1 text-sm text-slate-300">
              {a.hindsight_context.map((t, i) => (
                <li key={i}>“{t}”</li>
              ))}
            </ul>
          </div>
        )}
      </GlassCard>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <GlassCard className="xl:col-span-3" delay={0.1}>
          <SectionTitle hint="One real decision from this dataset">Leakage timeline</SectionTitle>
          <LeakageTimeline events={a.timeline} decisionId={a.timeline_decision_id} predictionTime={a.timeline_prediction_time} />
        </GlassCard>
        <GlassCard className="xl:col-span-2" delay={0.15}>
          <SectionTitle hint="Availability delay after prediction, all feature values">When features became available</SectionTitle>
          <DelayHistogram buckets={a.delay_buckets} counts={a.delay_histogram} />
        </GlassCard>
      </div>

      <GlassCard className="mt-4" delay={0.2}>
        <SectionTitle hint="Select a feature to see its evidence">Dangerous features</SectionTitle>
        <FeatureRiskTable features={a.feature_results} risk={a.risk.features} selected={current} onSelect={setSelected} />
      </GlassCard>

      {feature && risk && (
        <div className="mt-4">
          <SectionTitle hint={`Memory: ${providerLabel(a.memory_provider)}`}>
            Evidence · <span className="font-mono">{feature.feature}</span>
          </SectionTitle>
          <EvidencePanel feature={feature} risk={risk} />
        </div>
      )}

      <GlassCard className="mt-4" delay={0.25}>
        <SectionTitle hint="Decisions where at least one feature was not yet available">Affected decisions</SectionTitle>
        <AffectedDecisions id={a.id} total={a.affected_decisions} />
      </GlassCard>
    </>
  )
}
