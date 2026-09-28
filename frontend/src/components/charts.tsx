import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { Band, ModelMetrics } from '../api/types'
import { fmtInt, fmtMetric } from '../lib/format'

const AXIS = { stroke: 'rgb(148 163 184 / 0.25)', tick: { fill: '#8b95ab', fontSize: 11 }, tickLine: false }
const GRID = { stroke: 'rgb(148 163 184 / 0.08)', vertical: false }
const STATUS = { safe: '#34d399', leak: '#fb7185', warn: '#fbbf24' }
// Validated for the dark surface (OKLCH L band, CVD and normal-vision separation, contrast).
const SERIES = { baseline: '#7c6ff0', leakFree: '#12a08f' }

function TooltipBox({ active, payload, label, format }: Partial<TooltipContentProps<number, string>> & {
  format: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-ink-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-semibold text-white">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-slate-300">
          <span className="size-2 rounded-full" style={{ background: p.color ?? (p.payload as { fill?: string }).fill }} />
          {p.name}: <span className="num font-semibold text-white">{format(Number(p.value))}</span>
        </p>
      ))}
    </div>
  )
}

/** Distribution of availability delays across all observations (status-colored, labeled by bucket). */
export function DelayHistogram({ buckets, counts }: { buckets: string[]; counts: number[] }) {
  const data = buckets.map((b, i) => ({ bucket: b, count: counts[i] ?? 0, fill: i === 0 ? STATUS.safe : STATUS.leak }))
  return (
    <div className="h-64" role="img" aria-label="Histogram of feature availability delays">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="bucket" {...AXIS} interval={0} tick={{ ...AXIS.tick, fontSize: 10 }} />
          <YAxis {...AXIS} width={48} tickFormatter={(v: number) => fmtInt(v)} />
          <Tooltip cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} content={<TooltipBox format={fmtInt} />} />
          <Bar dataKey="count" name="Observations" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {data.map((d) => (
              <Cell key={d.bucket} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Baseline vs leak-free model on the same held-out period. */
export function MetricCompare({ baseline, leakFree }: { baseline: ModelMetrics; leakFree: ModelMetrics }) {
  const keys: [keyof ModelMetrics, string][] = [
    ['auc', 'ROC-AUC'],
    ['accuracy', 'Accuracy'],
    ['precision', 'Precision'],
    ['recall', 'Recall'],
    ['f1', 'F1'],
  ]
  const data = keys.map(([k, label]) => ({
    metric: label,
    baseline: baseline[k] as number,
    leakFree: leakFree[k] as number,
  }))
  return (
    <div className="h-72" role="img" aria-label="Model metrics before and after removing leaked features">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="metric" {...AXIS} />
          <YAxis {...AXIS} width={40} domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(1)} />
          <Tooltip cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} content={<TooltipBox format={fmtMetric} />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} iconType="circle" />
          <Bar dataKey="baseline" name="Baseline (all features)" fill={SERIES.baseline} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="leakFree" name="Leak-free (leaked removed)" fill={SERIES.leakFree} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** How much ROC-AUC each leaked feature contributes on its own (drop-one ablation). */
export function AblationChart({ items }: { items: { feature: string; auc_drop: number }[] }) {
  const data = items.map((a) => ({ feature: a.feature, drop: a.auc_drop }))
  return (
    <div style={{ height: Math.max(120, data.length * 48 + 40) }} role="img" aria-label="AUC drop when each leaked feature is removed">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={GRID.stroke} horizontal={false} />
          <XAxis type="number" {...AXIS} tickFormatter={(v: number) => v.toFixed(2)} />
          <YAxis type="category" dataKey="feature" {...AXIS} width={150} tick={{ ...AXIS.tick, fontFamily: 'var(--font-mono)' }} />
          <Tooltip cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} content={<TooltipBox format={(v) => `${v >= 0 ? '−' : '+'}${Math.abs(v).toFixed(3)} AUC`} />} />
          <Bar dataKey="drop" name="AUC lost without it" fill={STATUS.leak} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const BAND_FILL: Record<Band, string> = { high: STATUS.leak, medium: STATUS.warn, low: STATUS.safe }

/** Risk score per audit (status-colored by band; the band is also named in the tooltip). */
export function RiskByAudit({ audits }: { audits: { name: string; score: number; band: Band }[] }) {
  return (
    <div className="h-56" role="img" aria-label="Risk score by audited dataset">
      <ResponsiveContainer>
        <BarChart data={audits} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="name" {...AXIS} tick={{ ...AXIS.tick, fontSize: 10 }} interval={0} />
          <YAxis {...AXIS} width={36} domain={[0, 100]} />
          <Tooltip
            cursor={{ fill: 'rgb(255 255 255 / 0.04)' }}
            content={<TooltipBox format={(v) => `${v.toFixed(0)} / 100`} />}
          />
          <Bar dataKey="score" name="Risk score" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {audits.map((a, i) => (
              <Cell key={i} fill={BAND_FILL[a.band]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
