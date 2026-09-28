import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Brain, Clock, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { MemoryEvent } from '../api/types'
import { EVENT_STYLE, EventList } from '../components/EventList'
import { FixConfidence } from '../components/MemoryPanels'
import { EmptyState, ErrorState, GlassCard, PageHeader, PageSkeleton, Pill, SectionTitle, Skeleton } from '../components/ui'
import { useIncident, useMemoryTimeline } from '../hooks/useApi'
import { fmtDate, fmtDateTime, fmtDuration, fmtInt, fmtPct } from '../lib/format'

const FILTERS: (MemoryEvent['kind'] | 'all')[] = ['all', 'learned', 'recalled', 'fix_confirmed', 'fix_rejected', 'replay', 'clean']

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="label mb-1">{label}</p>
      <div className="text-sm leading-relaxed text-slate-200">{children}</div>
    </div>
  )
}

function IncidentPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading, error } = useIncident(id)
  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="glass-strong p-5 lg:sticky lg:top-6"
      aria-label="Incident detail"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <p className="label flex items-center gap-1.5 text-memory">
          <Brain className="size-3.5" aria-hidden /> Incident #{id}
        </p>
        <button className="btn btn-ghost h-8 px-2" onClick={onClose} aria-label="Close incident">
          <X className="size-4" />
        </button>
      </div>
      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} />}
      {data && (
        <div className="space-y-4">
          <div>
            <h2 className="break-all font-mono text-lg font-semibold text-white">{data.incident.feature}</h2>
            <p className="mt-1 flex flex-wrap gap-2 text-xs">
              <Pill>{data.incident.incident_type ?? 'Temporal leakage'}</Pill>
              {data.incident.model_name && <Pill>{data.incident.model_name}</Pill>}
              <Pill>{data.incident.dataset_name}</Pill>
              <Pill>{fmtDate(data.incident.created_at)}</Pill>
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-muted">Leak rate</dt>
              <dd className="num font-semibold text-leak">{fmtPct(data.incident.leak_rate)}</dd>
            </div>
            <div>
              <dt className="text-muted">Median delay</dt>
              <dd className="num font-semibold text-white">{fmtDuration(data.incident.median_delay_hours)}</dd>
            </div>
            <div>
              <dt className="text-muted">Decisions</dt>
              <dd className="num font-semibold text-white">{fmtInt(data.incident.affected_decisions)}</dd>
            </div>
          </dl>
          {data.incident.cause && <Field label="Cause">{data.incident.cause}</Field>}
          {data.incident.evidence?.example_decision_id && (
            <Field label="Timeline evidence">
              Decision <span className="font-mono">{String(data.incident.evidence.example_decision_id)}</span> was scored at{' '}
              {fmtDateTime(String(data.incident.evidence.example_prediction_time))}; the value appeared at{' '}
              {fmtDateTime(String(data.incident.evidence.example_available_time))}.
            </Field>
          )}
          {data.incident.impact && <Field label="Measured impact">{data.incident.impact}</Field>}
          {data.incident.solution && <Field label="Fix">{data.incident.solution}</Field>}
          <Field label="Fix feedback">
            <FixConfidence yes={data.incident.fix_confirmations} no={data.incident.fix_rejections} confidence={data.incident.fix_confidence} />
          </Field>
          <Field label="Lesson">{data.incident.lesson}</Field>
          {data.recurrence_of && (
            <Field label="Repeats">
              <Link to={`/timeline?incident=${data.recurrence_of.id}`} className="font-mono text-memory hover:underline">
                #{data.recurrence_of.id} {data.recurrence_of.feature}
              </Link>{' '}
              from {data.recurrence_of.dataset_name}
            </Field>
          )}
          {data.recurrences.length > 0 && (
            <Field label="Came back as">
              {data.recurrences.map((r) => (
                <Link key={r.id} to={`/timeline?incident=${r.id}`} className="mr-2 font-mono text-memory hover:underline">
                  {r.feature}
                </Link>
              ))}
            </Field>
          )}
          <Field label={`Recalled by ${data.recalled_by.length} audit${data.recalled_by.length === 1 ? '' : 's'}`}>
            {data.recalled_by.length ? (
              <ul className="space-y-1">
                {data.recalled_by.map((a) => (
                  <li key={a.id}>
                    <Link to={`/audits/${a.id}`} className="font-mono text-accent hover:underline">
                      #{a.id} {a.dataset_name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted">Not recalled yet.</span>
            )}
          </Field>
          <details className="rounded-xl border border-line bg-white/[0.02] p-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-300">Record retained in Hindsight</summary>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted">{data.hindsight_record}</pre>
            <p className="mt-2 text-[11px] text-muted">
              {data.incident.hindsight_retained
                ? `Retained as document ${data.incident.hindsight_document_id}.`
                : 'Not retained: Hindsight is not configured or was unreachable. The SQL record above is the source of truth.'}
            </p>
          </details>
        </div>
      )}
    </motion.aside>
  )
}

export function IncidentTimeline() {
  const { data, isLoading, error, refetch } = useMemoryTimeline()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const incident = params.get('incident') ? Number(params.get('incident')) : null

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  const events = (data ?? []).filter((e) => filter === 'all' || e.kind === filter)
  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === 'all' ? data!.length : data!.filter((e) => e.kind === f).length]))

  return (
    <>
      <PageHeader
        eyebrow="Incident Timeline"
        title="How the memory grew."
        subtitle="Every incident learned, every time memory recalled one, every replay that measured the damage and every fix the team confirmed or rejected, newest first."
      />
      {data!.length === 0 ? (
        <EmptyState icon={<Clock className="size-5" />} title="No history yet" action={<Link to="/" className="btn btn-primary">Run the demo</Link>}>
          Audit a dataset to start the timeline.
        </EmptyState>
      ) : (
        <div className={clsx('grid gap-4', incident !== null && 'lg:grid-cols-[1fr_420px]')}>
          <GlassCard>
            <SectionTitle hint={`${events.length} event${events.length === 1 ? '' : 's'}`}>
              <span className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={clsx(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                      filter === f ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:text-slate-200',
                    )}
                  >
                    {f === 'all' ? 'All' : EVENT_STYLE[f].label} <span className="num opacity-70">{counts[f]}</span>
                  </button>
                ))}
              </span>
            </SectionTitle>
            <EventList events={events} />
          </GlassCard>
          <AnimatePresence>
            {incident !== null && <IncidentPanel key={incident} id={incident} onClose={() => setParams({})} />}
          </AnimatePresence>
        </div>
      )}
    </>
  )
}
