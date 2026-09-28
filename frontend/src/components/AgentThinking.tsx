import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Brain, CheckCircle2, Clock, Database, Lightbulb, Loader2, Save, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AgentStep } from '../api/types'

const ICONS: Record<string, typeof Brain> = {
  understand: Database,
  temporal: Clock,
  memory: Brain,
  recommend: Lightbulb,
  retain: Save,
}

/** Live label while a step "runs"; built from the step's own recorded facts. */
function runningText(s: AgentStep): string {
  if (s.key === 'understand') return 'Understanding dataset…'
  if (s.key === 'temporal') return 'Checking temporal availability…'
  if (s.key === 'memory') return `Searching ${s.facts.searched ?? 0} previous ML incident${s.facts.searched === 1 ? '' : 's'}…`
  if (s.key === 'recommend') return 'Generating recommendation…'
  return `${s.title}…`
}

/**
 * Replays the agent's recorded steps. The steps, their text and their timings come from
 * the audit (``agent_trace``); only the reveal is animated.
 */
export function AgentThinking({ steps, replayKey }: { steps: AgentStep[]; replayKey: number }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? steps.length : 0)

  useEffect(() => {
    if (reduce) {
      setShown(steps.length)
      return
    }
    setShown(0)
    let i = 0
    const tick = () => {
      i += 1
      setShown(i)
      if (i < steps.length) timer = window.setTimeout(tick, 650)
    }
    let timer = window.setTimeout(tick, 350)
    return () => window.clearTimeout(timer)
  }, [steps, reduce, replayKey])

  if (!steps.length) {
    return <p className="text-sm text-muted">This audit was created before the agent recorded its steps.</p>
  }
  const total = steps.reduce((sum, s) => sum + s.ms, 0)

  return (
    <ol className="relative space-y-3" aria-live="polite">
      <span className="absolute bottom-3 left-[15px] top-3 w-px bg-gradient-to-b from-accent/40 via-memory/40 to-transparent" aria-hidden />
      {steps.map((s, i) => {
        const Icon = ICONS[s.key] ?? CheckCircle2
        const done = i < shown
        const running = i === shown
        if (!done && !running) {
          return (
            <li key={s.key} className="relative flex gap-3 opacity-35">
              <span className="z-10 grid size-8 shrink-0 place-items-center rounded-full border border-line bg-ink-900">
                <Icon className="size-4 text-muted" aria-hidden />
              </span>
              <p className="pt-1.5 text-sm text-muted">{s.title}</p>
            </li>
          )
        }
        return (
          <motion.li key={s.key} layout className="relative flex gap-3" initial={{ opacity: 0.4 }} animate={{ opacity: 1 }}>
            <span
              className={clsx(
                'z-10 grid size-8 shrink-0 place-items-center rounded-full border bg-ink-900',
                !done && 'border-accent/50 text-accent',
                done && s.outcome === 'warning' && 'border-leak/50 text-leak',
                done && s.outcome === 'found' && 'border-memory/60 text-memory shadow-[0_0_16px_-2px_rgb(192_132_252_/_0.6)]',
                done && s.outcome === 'ok' && 'border-safe/50 text-safe',
              )}
            >
              {!done ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-white">
                  {done ? s.title : runningText(s)}
                  {done && s.outcome === 'warning' && <TriangleAlert className="ml-1.5 inline size-3.5 text-leak" aria-label="warning" />}
                </p>
                {done && <span className="num text-[11px] text-muted">{s.ms} ms</span>}
              </div>
              <AnimatePresence>
                {done && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-0.5 text-[13px] leading-relaxed text-slate-300"
                  >
                    {s.detail}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.li>
        )
      })}
      {shown >= steps.length && (
        <li className="pl-11 text-[11px] text-muted">Completed in {total.toLocaleString('en-US')} ms of recorded work.</li>
      )}
    </ol>
  )
}
