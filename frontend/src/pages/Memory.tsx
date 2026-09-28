import { motion } from 'framer-motion'
import { ArrowRight, Brain, CheckCircle2, Cloud, Loader2, Network, Repeat, Search, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Markdown } from '../components/Markdown'
import { FixConfidence } from '../components/MemoryPanels'
import { MemoryGraphView } from '../components/MemoryGraphView'
import { EventList } from '../components/EventList'
import { EmptyState, ErrorState, GlassCard, PageHeader, PageSkeleton, Pill, SectionTitle, Skeleton } from '../components/ui'
import { useHealth, useHindsightReflect, useHindsightStatus, useIncidents, useMemoryGraph, useMemoryTimeline, useSearch } from '../hooks/useApi'
import { fmtDate, fmtDuration, fmtInt, fmtPct, hindsightLabel, providerLabel } from '../lib/format'

function HindsightCard() {
  const status = useHindsightStatus()
  const reflect = useHindsightReflect()
  const [q, setQ] = useState('What have we learned about fraud models using post-outcome fields?')
  const s = status.data
  const live = s && (s.state === 'connected' || s.state === 'configured')
  return (
    <GlassCard className="glass-strong flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Cloud className="size-4 text-memory" aria-hidden /> Hindsight long-term memory
          </h2>
          <p className="mt-1 text-xs text-muted">
            Every incident is retained as a structured record (cause, timeline evidence, fix, impact, feedback). Audits recall from
            it; the assistant asks it to reflect.
          </p>
        </div>
        {s && <Pill className={s.state === 'connected' ? 'text-safe' : s.state === 'connection_failed' ? 'text-leak' : ''}>{hindsightLabel(s.state)}</Pill>}
      </div>
      {s && (
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-line bg-white/[0.02] p-2">
            <dt className="text-muted">Retained</dt>
            <dd className="num mt-0.5 font-semibold text-white">
              {s.retained_incidents} / {s.total_incidents}
            </dd>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.02] p-2">
            <dt className="text-muted">Host</dt>
            <dd className="mt-0.5 truncate font-mono text-white">{s.host ?? '—'}</dd>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.02] p-2">
            <dt className="text-muted">Bank</dt>
            <dd className="mt-0.5 truncate font-mono text-white">{s.bank_id ?? '—'}</dd>
          </div>
        </dl>
      )}
      {s?.detail && <p className="text-xs text-warn">{s.detail}</p>}
      {live ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim()) reflect.mutate(q.trim())
          }}
        >
          <label htmlFor="reflect" className="sr-only">
            Ask Hindsight to reflect
          </label>
          <input
            id="reflect"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-line bg-ink-950/60 px-3 text-sm text-white focus:border-memory/50 focus:outline-none"
          />
          <button className="btn btn-ghost h-9" disabled={reflect.isPending}>
            {reflect.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-memory" />} Reflect
          </button>
        </form>
      ) : (
        <p className="rounded-lg border border-line bg-white/[0.02] p-2.5 text-xs text-muted">
          Not configured on this server, so the local incident store (SQL + vectors) is the memory. Set{' '}
          <code className="font-mono text-slate-300">CHRONOGUARD_HINDSIGHT_BASE_URL</code> and{' '}
          <code className="font-mono text-slate-300">CHRONOGUARD_HINDSIGHT_API_KEY</code> to add Hindsight.
        </p>
      )}
      {reflect.data && (
        <div className="rounded-lg border border-memory/25 bg-memory/[0.04] p-3">
          {reflect.data.answer ? <Markdown source={reflect.data.answer} compact /> : <p className="text-sm text-muted">Hindsight did not answer.</p>}
        </div>
      )}
    </GlassCard>
  )
}

export function Memory() {
  const incidents = useIncidents()
  const health = useHealth()
  const graph = useMemoryGraph()
  const timeline = useMemoryTimeline()
  const search = useSearch()
  const [query, setQuery] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim()) search.mutate(query.trim())
  }

  if (incidents.isLoading) return <PageSkeleton />
  if (incidents.error) return <ErrorState error={incidents.error} onRetry={() => incidents.refetch()} />
  const list = incidents.data ?? []

  return (
    <>
      <PageHeader
        eyebrow="Memory Brain"
        title={
          <>
            Every ML failure, <span className="text-memory-gradient">remembered.</span>
          </>
        }
        subtitle="Each leaked feature becomes a structured incident. Incidents that look like the same failure form a pattern; when a new dataset matches a pattern, memory fires before the model ships. Fix feedback flows back into every incident it touched."
        actions={health.data && <Pill>Vectors: {providerLabel(health.data.embedding_provider)}</Pill>}
      />

      <GlassCard className="mb-4">
        <SectionTitle hint="Hover to trace a pattern · click an incident or detection to open it">
          <span className="flex items-center gap-2">
            <Network className="size-4 text-accent" aria-hidden /> Memory graph
          </span>
        </SectionTitle>
        {graph.isLoading && <Skeleton className="h-72" />}
        {graph.error && <ErrorState error={graph.error} onRetry={() => graph.refetch()} />}
        {graph.data &&
          (graph.data.nodes.length ? (
            <>
              <MemoryGraphView graph={graph.data} />
              <p className="mt-2 text-xs text-muted">
                Patterns group incidents whose feature names are at least {Math.round(graph.data.threshold * 100)}% similar (
                {providerLabel(graph.data.provider).toLowerCase()}).
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">No incidents yet. Audit a dataset with a leak to start the graph.</p>
          ))}
      </GlassCard>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <HindsightCard />
        <GlassCard>
          <SectionTitle
            hint={
              <Link to="/timeline" className="inline-flex items-center gap-1 text-accent hover:underline">
                Full timeline <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          >
            Memory timeline
          </SectionTitle>
          {timeline.data ? <EventList events={timeline.data.slice(0, 6)} compact /> : <Skeleton className="h-48" />}
        </GlassCard>
      </div>

      <GlassCard>
        <SectionTitle hint="Try a column name you are about to use">Ask memory about a feature</SectionTitle>
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="memory-query">
            Feature name or description
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="memory-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. chargeback_status_final"
              className="h-10 w-full rounded-xl border border-line bg-ink-950/60 pl-9 pr-3 text-sm text-white placeholder:text-muted focus:border-accent/50 focus:outline-none"
            />
          </div>
          <button className="btn btn-primary" disabled={search.isPending || !query.trim()}>
            {search.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Brain className="size-4" aria-hidden />}
            Search memory
          </button>
        </form>

        {search.error && <p className="mt-3 text-sm text-leak">{search.error.message}</p>}
        {search.data && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted">
              {providerLabel(search.data.provider)} · match threshold {Math.round(search.data.threshold * 100)}%
            </p>
            {search.data.hits.length === 0 && <p className="text-sm text-muted">Memory is empty.</p>}
            {search.data.hits.map((h, i) => (
              <motion.div
                key={h.incident.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2"
              >
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                  <div className="h-full rounded-full bg-memory" style={{ width: `${Math.max(0, h.similarity) * 100}%` }} />
                </div>
                <span className="num w-10 text-right text-xs text-slate-300">{Math.round(h.similarity * 100)}%</span>
                <span className="font-mono text-sm text-white">{h.incident.feature}</span>
                <span className="truncate text-xs text-muted">{h.incident.dataset_name}</span>
                {h.is_match && (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-memory">
                    <CheckCircle2 className="size-3.5" aria-hidden /> match
                  </span>
                )}
              </motion.div>
            ))}
            {search.data.hindsight.length > 0 && (
              <div className="rounded-xl border border-memory/25 bg-memory/[0.04] p-3 text-sm text-slate-300">
                <p className="label mb-1 text-memory">Hindsight recall</p>
                {search.data.hindsight.map((t, i) => (
                  <p key={i}>“{t}”</p>
                ))}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      <div className="mt-6">
        <SectionTitle hint={`${list.length} incident${list.length === 1 ? '' : 's'}`}>Previous incidents</SectionTitle>
        {list.length === 0 ? (
          <EmptyState icon={<Brain className="size-5" />} title="No incidents yet" action={<Link to="/" className="btn btn-primary">Audit a dataset</Link>}>
            When an audit finds a leaked feature, it is stored here and used to check future datasets.
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((inc, i) => (
              <GlassCard key={inc.id} delay={Math.min(i, 8) * 0.04} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold text-white">{inc.feature}</p>
                    <Link to={`/timeline?incident=${inc.id}`} className="truncate text-xs text-muted hover:text-accent">
                      {inc.dataset_name} · audit #{inc.audit_id}
                    </Link>
                  </div>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-memory/30 bg-memory/10 text-memory">
                    <Brain className="size-4" aria-hidden />
                  </span>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted">Leak rate</dt>
                    <dd className="num font-semibold text-leak">{fmtPct(inc.leak_rate)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Median delay</dt>
                    <dd className="num font-semibold text-white">{fmtDuration(inc.median_delay_hours)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Decisions</dt>
                    <dd className="num font-semibold text-white">{fmtInt(inc.affected_decisions)}</dd>
                  </div>
                </dl>
                {inc.solution ? (
                  <p className="text-sm leading-relaxed text-slate-300">
                    <span className="font-semibold text-accent">Fix: </span>
                    {inc.solution}
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-slate-300">{inc.lesson}</p>
                )}
                <FixConfidence yes={inc.fix_confirmations} no={inc.fix_rejections} confidence={inc.fix_confidence} />
                <div className="mt-auto flex flex-wrap gap-2 text-[11px]">
                  {inc.model_name && <Pill>{inc.model_name}</Pill>}
                  {inc.times_recalled > 0 && (
                    <Pill className="text-memory">
                      <Repeat className="size-3" aria-hidden /> recalled {inc.times_recalled}×
                    </Pill>
                  )}
                  {inc.hindsight_retained && <Pill className="text-memory">Retained in Hindsight</Pill>}
                  <Pill>{fmtDate(inc.created_at)}</Pill>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
