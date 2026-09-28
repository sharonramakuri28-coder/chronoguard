import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import type { TimelineEvent } from '../api/types'
import { fmtDateTime, fmtOffset } from '../lib/format'

/**
 * One real decision from the dataset: when each feature became available relative to the
 * moment the prediction was made. Log-scaled so minutes and weeks fit on the same axis.
 */
export function LeakageTimeline({ events, decisionId, predictionTime }: {
  events: TimelineEvent[]
  decisionId: string | null
  predictionTime: string | null
}) {
  const reduce = useReducedMotion()
  const known = events.filter((e) => e.offset_hours !== null)
  const maxAbs = Math.max(1, ...known.map((e) => Math.abs(e.offset_hours!)))
  const scale = (h: number) => 50 + (Math.sign(h) * Math.log1p(Math.abs(h)) / Math.log1p(maxAbs)) * 44

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          Decision <span className="font-mono text-slate-200">{decisionId ?? '—'}</span>
        </span>
        <span>Prediction made {fmtDateTime(predictionTime)}</span>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-accent/60" aria-hidden />
        <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-full border border-accent/40 bg-ink-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
          Prediction
        </div>
        <div className="grid grid-cols-2 pt-6 text-[10px] uppercase tracking-wider text-muted">
          <span>← known before</span>
          <span className="text-right">available after (leak) →</span>
        </div>

        <ul className="mt-2 space-y-2">
          {events.map((e, i) => {
            const pos = e.offset_hours === null ? null : scale(e.offset_hours)
            return (
              <li key={e.feature} className="relative h-10 rounded-lg bg-white/[0.02]">
                <span
                  className={clsx(
                    'absolute top-1/2 z-10 -translate-y-1/2 truncate text-xs font-medium',
                    pos !== null && pos > 50 ? 'left-2 text-right' : 'right-2',
                    e.leaked ? 'text-leak' : 'text-slate-300',
                  )}
                  style={{ maxWidth: '44%' }}
                >
                  <span className="font-mono">{e.feature}</span>
                </span>
                {pos !== null ? (
                  <>
                    <motion.span
                      className={clsx('absolute top-1/2 h-0.5 -translate-y-1/2', e.leaked ? 'bg-leak/50' : 'bg-safe/40')}
                      style={{ left: `${Math.min(pos, 50)}%`, width: `${Math.abs(pos - 50)}%` }}
                      initial={{ scaleX: 0, originX: pos > 50 ? 0 : 1 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.15 + i * 0.08 }}
                    />
                    <motion.span
                      className={clsx(
                        'absolute top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center',
                      )}
                      style={{ left: `${pos}%` }}
                      initial={{ opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : 0.5 + i * 0.08 }}
                      title={`${e.feature}: ${fmtOffset(e.offset_hours)}`}
                    >
                      <span
                        className={clsx(
                          'size-3 rounded-full ring-2 ring-ink-900',
                          e.leaked ? 'bg-leak shadow-[0_0_12px_rgb(251_113_133_/_0.8)]' : 'bg-safe',
                        )}
                      />
                      <span
                        className={clsx(
                          'num absolute top-3.5 whitespace-nowrap text-[10px]',
                          pos > 75 ? 'right-0' : pos < 25 ? 'left-0' : '',
                          e.leaked ? 'text-leak' : 'text-muted',
                        )}
                      >
                        {fmtOffset(e.offset_hours)}
                      </span>
                    </motion.span>
                  </>
                ) : (
                  <span className="absolute left-1/2 top-1/2 -translate-y-1/2 pl-3 text-[10px] text-muted">
                    no timestamp
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
