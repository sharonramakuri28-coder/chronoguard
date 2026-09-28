import { motion } from 'framer-motion'
import { Brain, CheckCircle2, Loader2, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, GlassCard, PageHeader, PageSkeleton, Pill, SectionTitle } from '../components/ui'
import { useHealth, useIncidents, useSearch } from '../hooks/useApi'
import { fmtDate, fmtDuration, fmtInt, fmtPct, providerLabel } from '../lib/format'

export function Memory() {
  const incidents = useIncidents()
  const health = useHealth()
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
        eyebrow="Organizational memory"
        title="Every leak, remembered."
        subtitle="Each leaked feature becomes an incident with its evidence and a lesson. New datasets are compared against these incidents by vector similarity, so a leak that comes back under a new column name is recognised and scored higher."
        actions={health.data && <Pill>Vectors: {providerLabel(health.data.embedding_provider)}</Pill>}
      />

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
                    <Link to={`/audits/${inc.audit_id}`} className="truncate text-xs text-muted hover:text-accent">
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
                <p className="text-sm leading-relaxed text-slate-300">{inc.lesson}</p>
                <div className="mt-auto flex flex-wrap gap-2 text-[11px]">
                  <Pill>{providerLabel(inc.lesson_provider)}</Pill>
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
