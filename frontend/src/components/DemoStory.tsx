import clsx from 'clsx'
import { motion } from 'framer-motion'
import { Brain, CheckCircle2, FileText, FlaskConical, Loader2, MessageSquareText, Play, ScanSearch } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { AuditSummary } from '../api/types'
import { useAuditSample } from '../hooks/useApi'

const V1 = 'fraud_model_v1.csv'
const V2 = 'fraud_model_v2.csv'

interface Scene {
  n: number
  title: string
  story: string
  icon: typeof Play
  done: boolean
  ready: boolean
  cta: string
  run: () => void
}

/**
 * The product demo as five scenes. Progress is read from real audits (latest audit of each
 * demo dataset, its replay and its feedback), so the story reflects what actually happened.
 */
export function DemoStory({ audits, available }: { audits: AuditSummary[]; available: boolean }) {
  const navigate = useNavigate()
  const sample = useAuditSample()
  const v1 = audits.find((a) => a.dataset_name === V1)
  const v2 = audits.find((a) => a.dataset_name === V2 && (!v1 || a.id > v1.id))

  const audit = (name: string) => sample.mutate(name, { onSuccess: (a) => navigate(`/audits/${a.id}`) })

  const scenes: Scene[] = [
    {
      n: 1,
      title: 'Model v1 ships with a hidden leak',
      story: 'A card-fraud model scores 7,200 transactions. Chargeback and investigation outcomes were joined into its training table.',
      icon: ScanSearch,
      done: !!v1,
      ready: true,
      cta: v1 ? 'Audit again' : 'Audit model v1',
      run: () => audit(V1),
    },
    {
      n: 2,
      title: 'Replay: the score was a lie',
      story: 'Retrain the same model without the fields that arrived after each prediction and compare on the same future period.',
      icon: FlaskConical,
      done: !!v1?.has_replay,
      ready: !!v1,
      cta: v1?.has_replay ? 'Open replay' : 'Run replay',
      run: () => v1 && navigate(`/audits/${v1.id}/replay${v1.has_replay ? '' : '?run=1'}`),
    },
    {
      n: 3,
      title: 'The team confirms the fix',
      story: 'They remove the fields and retrain. Answering “Was this fix successful?” stores the outcome on every incident.',
      icon: MessageSquareText,
      done: !!v1?.feedback,
      ready: !!v1,
      cta: v1?.feedback ? 'Review feedback' : 'Give feedback',
      run: () => v1 && navigate(`/audits/${v1.id}#feedback`),
    },
    {
      n: 4,
      title: 'Weeks later, model v2 arrives',
      story: 'Another team rebuilt the table and renamed every column. ChronoGuard searches memory before it scores anything.',
      icon: Brain,
      done: !!v2 && v2.recalled > 0,
      ready: !!v1,
      cta: v2 ? 'Audit again' : 'Audit model v2',
      run: () => audit(V2),
    },
    {
      n: 5,
      title: 'One-click report',
      story: 'Executive summary, evidence, timeline, memory references and the fix, ready to attach to the ticket.',
      icon: FileText,
      done: false,
      ready: !!v2,
      cta: 'Open report',
      run: () => v2 && navigate(`/reports/${v2.id}`),
    },
  ]
  const next = scenes.find((s) => !s.done && s.ready)

  if (!available) {
    return <p className="text-sm text-muted">The demo datasets are not installed on this server. Run `python -m scripts.generate_samples`.</p>
  }

  return (
    <ol className="grid gap-3 md:grid-cols-5">
      {scenes.map((s, i) => {
        const active = next?.n === s.n
        const pending = sample.isPending && ((s.n === 1 && sample.variables === V1) || (s.n === 4 && sample.variables === V2))
        return (
          <motion.li
            key={s.n}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i }}
            className={clsx(
              'relative flex flex-col gap-2 rounded-xl border p-3 transition',
              active ? 'border-accent/50 bg-accent/[0.06] shadow-[0_0_30px_-12px_rgb(94_234_212_/_0.8)]' : 'border-line bg-white/[0.02]',
              !s.ready && 'opacity-50',
            )}
          >
            <div className="flex items-center justify-between">
              <span className={clsx('grid size-7 place-items-center rounded-lg border', s.done ? 'border-safe/40 bg-safe/10 text-safe' : 'border-line text-accent')}>
                {s.done ? <CheckCircle2 className="size-4" aria-label="done" /> : <s.icon className="size-4" aria-hidden />}
              </span>
              <span className="label">Scene {s.n}</span>
            </div>
            <p className="text-sm font-semibold leading-snug text-white">{s.title}</p>
            <p className="flex-1 text-xs leading-relaxed text-muted">{s.story}</p>
            <button
              className={clsx('btn h-8 px-3 text-xs', active ? 'btn-primary' : 'btn-ghost')}
              disabled={!s.ready || sample.isPending}
              onClick={s.run}
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
              {s.cta}
            </button>
          </motion.li>
        )
      })}
      {sample.error && (
        <li role="alert" className="text-sm text-leak md:col-span-5">
          {sample.error.message}
        </li>
      )}
    </ol>
  )
}
