import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Loader2, MessageCircle, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ChatOut } from '../api/types'
import { useChat } from '../hooks/useApi'
import { Markdown } from './Markdown'

interface Turn {
  role: 'user' | 'assistant'
  text: string
  meta?: ChatOut
}

const STARTERS = ['Why was this feature risky?', 'Have we seen this failure before?', 'What should I fix first?', 'Why did the replay score drop?']

/** The audit the user is looking at, if any (audit, replay and report pages). */
function useAuditInView(): number | undefined {
  const { pathname } = useLocation()
  const m = /^\/(?:audits|reports)\/(\d+)/.exec(pathname)
  return m ? Number(m[1]) : undefined
}

export function ChatDrawer() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const chat = useChat()
  const auditId = useAuditInView()
  const end = useRef<HTMLDivElement>(null)
  const last = [...turns].reverse().find((t) => t.meta)?.meta

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [turns, chat.isPending])

  const ask = (message: string) => {
    if (!message.trim() || chat.isPending) return
    setTurns((t) => [...t, { role: 'user', text: message }])
    setInput('')
    chat.mutate(
      { message, auditId },
      {
        onSuccess: (res) => setTurns((t) => [...t, { role: 'assistant', text: res.answer, meta: res }]),
        onError: (err) => setTurns((t) => [...t, { role: 'assistant', text: `Sorry, I could not answer: ${err.message}` }]),
      },
    )
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask(input)
  }
  const suggestions = last?.suggestions.length ? last.suggestions : STARTERS

  return (
    <div className="no-print">
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(true)}
        className={clsx(
          'fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink-950 shadow-[0_12px_40px_-8px_rgb(94_234_212_/_0.6)]',
          'bg-gradient-to-r from-accent to-accent-2',
          open && 'hidden',
        )}
        aria-label="Ask the reliability assistant"
      >
        <MessageCircle className="size-5" aria-hidden /> <span className="hidden sm:inline">Ask ChronoGuard</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className="glass-strong fixed inset-x-3 bottom-3 z-50 flex max-h-[78vh] flex-col overflow-hidden sm:inset-x-auto sm:right-5 sm:w-[420px]"
            aria-label="Reliability assistant"
          >
            <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Bot className="size-4 text-accent" aria-hidden /> Reliability assistant
                </p>
                <p className="text-[11px] text-muted">
                  {auditId ? `Answering about audit #${auditId}` : 'Answering about the latest audit'} · grounded in evidence and memory
                </p>
              </div>
              <button className="btn btn-ghost h-8 px-2" onClick={() => setOpen(false)} aria-label="Close assistant">
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
              {turns.length === 0 && (
                <p className="text-sm text-muted">
                  Ask why a feature was risky, whether ChronoGuard has seen the failure before, what to fix first, or why the replay
                  score dropped. Answers come from the audit's evidence and the incident memory, with citations.
                </p>
              )}
              {turns.map((t, i) => (
                <div key={i} className={clsx('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={clsx(
                      'max-w-[88%] rounded-2xl px-3 py-2 text-sm',
                      t.role === 'user' ? 'bg-accent/15 text-white' : 'border border-line bg-white/[0.03] text-slate-200',
                    )}
                  >
                    {t.role === 'assistant' ? <Markdown source={t.text} compact /> : t.text}
                    {t.meta && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2 text-[10.5px] text-muted">
                        <span className="rounded-full border border-line px-1.5 py-0.5">
                          {t.meta.provider === 'hindsight-reflect' ? 'Evidence + Hindsight reflect' : 'Grounded in audit + memory'}
                        </span>
                        {t.meta.citations.slice(0, 5).map((c, j) => {
                          const to =
                            c.kind === 'incident' && c.ref ? `/timeline?incident=${c.ref}` : c.kind === 'replay' && c.ref ? `/audits/${c.ref}/replay` : c.ref ? `/audits/${c.ref}` : null
                          return to ? (
                            <Link key={j} to={to} className="rounded-full border border-line px-1.5 py-0.5 text-accent hover:border-accent/40">
                              {c.label}
                            </Link>
                          ) : (
                            <span key={j} className="rounded-full border border-line px-1.5 py-0.5">
                              {c.label}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chat.isPending && (
                <p className="flex items-center gap-2 text-xs text-muted">
                  <Loader2 className="size-3.5 animate-spin" /> Checking the evidence and memory…
                </p>
              )}
              <div ref={end} />
            </div>

            <div className="border-t border-line px-3 pb-3 pt-2">
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="shrink-0 rounded-full border border-line bg-white/[0.02] px-2.5 py-1 text-[11px] text-slate-300 hover:border-accent/40 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <form onSubmit={submit} className="flex gap-2">
                <label htmlFor="chat-input" className="sr-only">
                  Question
                </label>
                <input
                  id="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={1000}
                  placeholder="Why was payment_final_state risky?"
                  className="h-10 flex-1 rounded-xl border border-line bg-ink-950/60 px-3 text-sm text-white placeholder:text-muted focus:border-accent/50 focus:outline-none"
                />
                <button className="btn btn-primary h-10 px-3" disabled={!input.trim() || chat.isPending} aria-label="Send">
                  <Send className="size-4" />
                </button>
              </form>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
