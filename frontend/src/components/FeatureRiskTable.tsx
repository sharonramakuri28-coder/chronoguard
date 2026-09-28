import clsx from 'clsx'
import { motion } from 'framer-motion'
import { Brain } from 'lucide-react'
import type { FeatureLeakage, FeatureRisk } from '../api/types'
import { fmtDuration, fmtPct } from '../lib/format'
import { BandBadge, StatusBadge } from './ui'

export function FeatureRiskTable({ features, risk, selected, onSelect }: {
  features: FeatureLeakage[]
  risk: FeatureRisk[]
  selected: string | null
  onSelect: (feature: string) => void
}) {
  const byName = new Map(features.map((f) => [f.feature, f]))
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-y-1.5 px-2 text-left text-sm">
        <thead>
          <tr className="label">
            <th className="px-3 py-1 font-semibold">Feature</th>
            <th className="px-3 py-1 font-semibold">Timestamp check</th>
            <th className="px-3 py-1 text-right font-semibold">Leak rate</th>
            <th className="px-3 py-1 text-right font-semibold">Median delay</th>
            <th className="px-3 py-1 font-semibold">Memory</th>
            <th className="px-3 py-1 text-right font-semibold">Risk</th>
          </tr>
        </thead>
        <tbody>
          {risk.map((r, i) => {
            const f = byName.get(r.feature)!
            const active = selected === r.feature
            return (
              <motion.tr
                key={r.feature}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                onClick={() => onSelect(r.feature)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(r.feature)}
                tabIndex={0}
                aria-selected={active}
                className={clsx(
                  'cursor-pointer transition [&>td]:border-y [&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r',
                  active
                    ? '[&>td]:border-accent/40 [&>td]:bg-accent/[0.06]'
                    : '[&>td]:border-line [&>td]:bg-white/[0.02] hover:[&>td]:bg-white/[0.05]',
                )}
              >
                <td className="px-3 py-3 font-mono text-[13px] text-white">{r.feature}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={f.status} />
                </td>
                <td className={clsx('num px-3 py-3 text-right', f.leaked ? 'text-leak' : 'text-muted')}>
                  {f.observations ? fmtPct(f.leak_rate) : '—'}
                </td>
                <td className="num px-3 py-3 text-right text-slate-300">{fmtDuration(f.delay_median_hours)}</td>
                <td className="px-3 py-3">
                  {r.memory ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-memory">
                      <Brain className="size-3.5" aria-hidden />
                      {Math.round(r.memory.similarity * 100)}% like <span className="font-mono">{r.memory.feature}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="num font-semibold text-white">{r.score.toFixed(0)}</span>
                    <BandBadge band={r.band}>{r.band}</BandBadge>
                  </div>
                </td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
