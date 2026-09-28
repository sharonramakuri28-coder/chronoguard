import { AnimatePresence, motion } from 'framer-motion'
import { Brain, Clock } from 'lucide-react'
import type { FeatureLeakage, FeatureRisk } from '../api/types'
import { fmtDateTime, fmtDuration, fmtInt, fmtPct } from '../lib/format'
import { BandBadge } from './ui'

/** Two sources of evidence for one feature: what the timestamps prove, and what memory recalls. */
export function EvidencePanel({ feature, risk }: { feature: FeatureLeakage; risk: FeatureRisk }) {
  const ex = feature.worst_example
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={feature.feature}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className="grid gap-4 lg:grid-cols-2"
      >
        <div className="rounded-2xl border border-leak/25 bg-leak/[0.04] p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="label flex items-center gap-2 text-leak">
              <Clock className="size-3.5" aria-hidden /> Deterministic evidence
            </p>
            <BandBadge band={risk.band}>{risk.label}</BandBadge>
          </div>
          <p className="text-sm font-semibold text-white">What was unavailable at prediction time</p>
          <p className="mt-2 text-sm text-slate-300">{feature.reason}</p>
          {feature.status === 'leaked' && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              {[
                ['Leaked', `${fmtInt(feature.leaked)} / ${fmtInt(feature.observations)}`],
                ['Leak rate', fmtPct(feature.leak_rate)],
                ['Median delay', fmtDuration(feature.delay_median_hours)],
                ['Max delay', fmtDuration(feature.delay_max_hours)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line bg-ink-950/40 p-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="num mt-0.5 font-semibold text-white">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {ex && (
            <p className="mt-4 text-xs text-muted">
              Worst case: decision <span className="font-mono text-slate-300">{ex.decision_id}</span> was scored{' '}
              {fmtDateTime(ex.prediction_time)}, but this value only appeared {fmtDateTime(ex.available_time)} (
              {fmtDuration(ex.delay_hours)} later).
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted">
            Score contribution from timestamps: <span className="num text-slate-300">{risk.timestamp_score.toFixed(1)}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-memory/25 bg-memory/[0.04] p-5">
          <p className="label mb-3 flex items-center gap-2 text-memory">
            <Brain className="size-3.5" aria-hidden /> Memory evidence
          </p>
          <p className="text-sm font-semibold text-white">What previous incidents taught us</p>
          {risk.memory ? (
            <>
              <p className="mt-2 text-sm text-slate-300">
                <span className="font-mono text-white">{feature.feature}</span> is{' '}
                <span className="num font-semibold text-memory">{Math.round(risk.memory.similarity * 100)}%</span> similar to{' '}
                <span className="font-mono text-white">{risk.memory.feature}</span>, which leaked in{' '}
                <span className="text-white">{risk.memory.dataset_name}</span>.
              </p>
              <blockquote className="mt-3 border-l-2 border-memory/50 pl-3 text-sm italic text-slate-300">
                {risk.memory.lesson}
              </blockquote>
              <p className="mt-3 text-[11px] text-muted">
                Score contribution from memory: <span className="num text-slate-300">+{risk.memory_score.toFixed(1)}</span>
                {feature.status === 'safe' && ' (none: timestamps show this feature is safe here)'}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              No similar feature has leaked in a previously audited dataset. If this feature is leaking, it is now stored
              as an incident so future datasets are checked against it.
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
