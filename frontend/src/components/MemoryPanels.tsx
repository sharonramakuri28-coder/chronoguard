import clsx from 'clsx'
import { motion } from 'framer-motion'
import { ArrowRight, Brain, CheckCircle2, Loader2, MessageSquareText, ShieldCheck, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AuditOut, RecallEntry, Recommendation } from '../api/types'
import { useFeedback } from '../hooks/useApi'
import { fmtDate, fmtDateTime } from '../lib/format'
import { BandBadge } from './ui'

function SimilarityBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-memory to-accent-2"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, value) * 100}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="num text-xs font-semibold text-memory">{Math.round(value * 100)}%</span>
    </div>
  )
}

export function FixConfidence({ yes, no, confidence }: { yes: number; no: number; confidence: number | null }) {
  if (confidence === null) return <span className="text-[11px] text-muted">No fix feedback yet</span>
  const good = yes >= no
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[11px] font-semibold', good ? 'text-safe' : 'text-warn')}>
      {good ? <ShieldCheck className="size-3.5" aria-hidden /> : <XCircle className="size-3.5" aria-hidden />}
      Fix {good ? 'confirmed' : 'disputed'} · {yes}✓ {no}✗ · {Math.round(confidence * 100)}% confidence
    </span>
  )
}

function RecallCard({ m, i }: { m: RecallEntry; i: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.08 * i }}
      className="rounded-xl border border-memory/25 bg-memory/[0.04] p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 flex-wrap items-center gap-1.5 font-mono text-sm">
          <span className="text-white">{m.matched_feature}</span>
          <span className="text-muted">≈</span>
          <Link to={`/timeline?incident=${m.incident_id}`} className="text-memory hover:underline">
            {m.past_feature}
          </Link>
        </p>
        <SimilarityBar value={m.similarity} />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Learned from <span className="font-mono text-slate-300">{m.past_dataset}</span>
        {m.past_model && <> · {m.past_model}</>} · {fmtDate(m.learned_at)}
      </p>
      {m.solution && (
        <p className="mt-2 text-[13px] text-slate-200">
          <span className="font-semibold text-accent">Past fix: </span>
          {m.solution}
        </p>
      )}
      <div className="mt-2">
        <FixConfidence yes={m.fix_confirmations} no={m.fix_rejections} confidence={m.fix_confidence} />
      </div>
    </motion.li>
  )
}

/** "Similar incidents remembered": what memory recalled before scoring this dataset. */
export function RecallPanel({ audit }: { audit: AuditOut }) {
  const recall = audit.memory_recall
  const searched = audit.agent_trace.find((s) => s.key === 'memory')?.facts.searched
  return (
    <div>
      {audit.headline && recall.length > 0 && (
        <div className="mb-3 rounded-xl border border-accent/30 bg-accent/[0.06] p-3">
          <p className="label text-accent">Recommended action</p>
          <p className="mt-1 text-sm font-semibold text-white">{audit.headline}</p>
        </div>
      )}
      {recall.length ? (
        <ul className="space-y-2">
          {recall.map((m, i) => (
            <RecallCard key={`${m.matched_feature}-${m.incident_id}`} m={m} i={i} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          No similar failure in memory
          {searched !== undefined && <> ({String(searched)} incident{searched === 1 ? '' : 's'} searched)</>}. This is the first
          time ChronoGuard has seen these features; {audit.leaked_features.length ? 'they are now remembered.' : 'nothing leaked.'}
        </p>
      )}
      {audit.hindsight_context.length > 0 && (
        <div className="mt-3 rounded-xl border border-line bg-white/[0.02] p-3">
          <p className="label mb-1.5 flex items-center gap-1.5 text-memory">
            <Brain className="size-3.5" aria-hidden /> Hindsight recalled
          </p>
          <ul className="space-y-1 text-[13px] text-slate-300">
            {audit.hindsight_context.map((t, i) => (
              <li key={i}>“{t}”</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function Recommendations({ recs }: { recs: Recommendation[] }) {
  if (!recs.length) return <p className="text-sm text-muted">Nothing to fix: every timestamped feature was available in time.</p>
  return (
    <ol className="space-y-2">
      {recs.map((r, i) => (
        <motion.li
          key={r.feature}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i }}
          className="rounded-xl border border-line bg-white/[0.02] p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white">
              <span className="num mr-1.5 text-accent">{i + 1}.</span>
              {r.action}
            </p>
            <BandBadge band={r.priority}>{r.priority}</BandBadge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">{r.reason}</p>
          {r.memory && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-memory">
              <Brain className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {r.memory}
            </p>
          )}
        </motion.li>
      ))}
    </ol>
  )
}

/** LEARN: the team reports whether the fix worked; memory stores it on every related incident. */
export function FeedbackPrompt({ audit }: { audit: AuditOut }) {
  const fb = useFeedback(audit.id)
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const current = audit.feedback
  const result = fb.data

  if (!audit.leaked_features.length) return null

  if (current && !editing) {
    return (
      <div className={clsx('rounded-xl border p-4', current.successful ? 'border-safe/30 bg-safe/[0.05]' : 'border-warn/30 bg-warn/[0.05]')}>
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          {current.successful ? <CheckCircle2 className="size-4 text-safe" /> : <XCircle className="size-4 text-warn" />}
          Fix {current.successful ? 'confirmed to work' : 'reported as not working'}
          <span className="text-xs font-normal text-muted">· {fmtDateTime(current.at)}</span>
        </p>
        {current.note && <p className="mt-1 text-sm text-slate-300">“{current.note}”</p>}
        <p className="mt-2 text-xs text-muted">
          {result
            ? `Stored on ${result.updated_incidents.length} incident${result.updated_incidents.length === 1 ? '' : 's'}${
                result.hindsight_synced ? `, ${result.hindsight_synced} re-retained in Hindsight` : ''
              }. `
            : ''}
          Future recalls of these incidents carry this feedback.
        </p>
        <button className="btn btn-ghost mt-3 h-8 px-3 text-xs" onClick={() => setEditing(true)}>
          Change answer
        </button>
      </div>
    )
  }

  const send = (successful: boolean) =>
    fb.mutate({ successful, note }, { onSuccess: () => { setEditing(false); setNote('') } })

  return (
    <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/[0.07] to-memory/[0.05] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <MessageSquareText className="size-4 text-accent" aria-hidden /> Was this fix successful?
      </p>
      <p className="mt-1 text-xs text-muted">
        After applying the recommendation and retraining, tell ChronoGuard. The answer is stored on this dataset's incidents and on
        every remembered incident it recalled, and makes future recommendations more (or less) confident.
      </p>
      <label className="sr-only" htmlFor={`note-${audit.id}`}>
        Optional note
      </label>
      <input
        id={`note-${audit.id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        placeholder="Optional note, e.g. retrained without the fields; AUC now stable in production"
        className="mt-3 h-9 w-full rounded-lg border border-line bg-ink-950/60 px-3 text-sm text-white placeholder:text-muted focus:border-accent/50 focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-primary h-9" disabled={fb.isPending} onClick={() => send(true)}>
          {fb.isPending && fb.variables?.successful ? <Loader2 className="size-4 animate-spin" /> : <ThumbsUp className="size-4" />}
          Yes, it worked
        </button>
        <button className="btn btn-ghost h-9" disabled={fb.isPending} onClick={() => send(false)}>
          {fb.isPending && fb.variables?.successful === false ? <Loader2 className="size-4 animate-spin" /> : <ThumbsDown className="size-4" />}
          No, still failing
        </button>
        {editing && (
          <button className="btn btn-ghost h-9" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
      {fb.error && <p className="mt-2 text-sm text-leak">{fb.error.message}</p>}
    </div>
  )
}

export function ReportLink({ id }: { id: number }) {
  return (
    <Link to={`/reports/${id}`} className="btn btn-ghost">
      Audit report <ArrowRight className="size-4" aria-hidden />
    </Link>
  )
}
