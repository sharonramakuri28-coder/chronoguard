import clsx from 'clsx'
import { motion } from 'framer-motion'
import { Brain, CheckCircle2, FlaskConical, Repeat, ShieldCheck, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MemoryEvent } from '../api/types'
import { fmtDateTime } from '../lib/format'

export const EVENT_STYLE: Record<MemoryEvent['kind'], { icon: typeof Brain; cls: string; label: string }> = {
  learned: { icon: Brain, cls: 'text-memory border-memory/40 bg-memory/10', label: 'Learned' },
  recalled: { icon: Repeat, cls: 'text-accent-2 border-accent-2/40 bg-accent-2/10', label: 'Recalled' },
  clean: { icon: ShieldCheck, cls: 'text-safe border-safe/40 bg-safe/10', label: 'Clean' },
  replay: { icon: FlaskConical, cls: 'text-accent border-accent/40 bg-accent/10', label: 'Replay' },
  fix_confirmed: { icon: CheckCircle2, cls: 'text-safe border-safe/40 bg-safe/10', label: 'Fix confirmed' },
  fix_rejected: { icon: XCircle, cls: 'text-warn border-warn/40 bg-warn/10', label: 'Fix rejected' },
}

export function EventList({ events, compact = false }: { events: MemoryEvent[]; compact?: boolean }) {
  if (!events.length) return <p className="text-sm text-muted">Nothing has happened in memory yet.</p>
  return (
    <ol className="relative space-y-3">
      <span className="absolute bottom-2 left-[13px] top-2 w-px bg-line" aria-hidden />
      {events.map((e, i) => {
        const st = EVENT_STYLE[e.kind]
        const to = e.incident_id ? `/timeline?incident=${e.incident_id}` : e.audit_id ? `/audits/${e.audit_id}` : null
        return (
          <motion.li
            key={`${e.kind}-${e.at}-${e.incident_id ?? e.audit_id}-${i}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 12) * 0.03 }}
            className="relative flex gap-3"
          >
            <span className={clsx('z-10 grid size-7 shrink-0 place-items-center rounded-full border', st.cls)}>
              <st.icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                {to ? (
                  <Link to={to} className="text-sm font-semibold text-white hover:text-accent">
                    {e.title}
                  </Link>
                ) : (
                  <p className="text-sm font-semibold text-white">{e.title}</p>
                )}
                <span className="text-[11px] text-muted">{fmtDateTime(e.at)}</span>
              </div>
              <p className={clsx('text-xs leading-relaxed text-muted', compact && 'line-clamp-2')}>{e.detail}</p>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
