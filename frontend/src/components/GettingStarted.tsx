import { AnimatePresence, motion } from 'framer-motion'
import { Brain, FlaskConical, ScanSearch, UploadCloud, X } from 'lucide-react'
import { useState } from 'react'

const KEY = 'chronoguard.guide.dismissed'

const STEPS = [
  {
    icon: UploadCloud,
    title: 'Upload or try the demo',
    text: 'Drop a CSV with a prediction timestamp and an availability timestamp per feature, or press “Try the demo”.',
  },
  {
    icon: ScanSearch,
    title: 'Read the audit',
    text: 'See which features arrived after the prediction was made, by how long, and how many decisions they touched.',
  },
  {
    icon: FlaskConical,
    title: 'Replay the model',
    text: 'Train the model with and without the leaked features to measure the performance that was never real.',
  },
  {
    icon: Brain,
    title: 'Let memory help',
    text: 'Every leak is remembered. When it returns under a new column name, ChronoGuard recognises it.',
  },
]

function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** First-visit guide. Dismissal is remembered in this browser only. */
export function GettingStarted() {
  const [hidden, setHidden] = useState(readDismissed)

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* storage unavailable: hide for this visit only */
    }
  }

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.section
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          className="glass relative mb-4 p-5"
          aria-labelledby="getting-started"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="getting-started" className="text-sm font-semibold text-white">
                How ChronoGuard works
              </h2>
              <p className="mt-1 text-xs text-muted">Four steps, about two minutes with the demo data.</p>
            </div>
            <button className="btn btn-ghost h-8 shrink-0 whitespace-nowrap px-2.5 text-xs" onClick={dismiss} aria-label="Dismiss guide">
              <X className="size-3.5" aria-hidden /> Got it
            </button>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-3 rounded-xl border border-line bg-white/[0.02] p-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    <span className="num mr-1 text-accent">{i + 1}.</span>
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
