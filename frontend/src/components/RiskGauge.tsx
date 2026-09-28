import { motion, useReducedMotion } from 'framer-motion'
import type { Band } from '../api/types'
import { AnimatedNumber } from './AnimatedNumber'

const bandColor: Record<Band, string> = { high: '#fb7185', medium: '#fbbf24', low: '#34d399' }
const bandText: Record<Band, string> = { high: 'High risk', medium: 'Medium risk', low: 'Low risk' }

/** 0–100 risk score as a 270° arc. The number and band label carry the meaning; color reinforces it. */
export function RiskGauge({ score, band, size = 200 }: { score: number; band: Band; size?: number }) {
  const reduce = useReducedMotion()
  const r = 80
  const circumference = 2 * Math.PI * r
  const arc = circumference * 0.75
  const filled = arc * Math.min(1, Math.max(0, score / 100))
  const color = bandColor[band]

  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`Risk score ${score.toFixed(0)} of 100, ${bandText[band]}`}>
      <svg viewBox="0 0 200 200" className="size-full -rotate-[225deg]">
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgb(148 163 184 / 0.14)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${arc} ${circumference}`} />
        <motion.circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${filled} ${circumference}` }}
          transition={{ duration: reduce ? 0 : 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 10px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-semibold text-white">
          <AnimatedNumber value={score} format={(n) => n.toFixed(0)} />
        </span>
        <span className="text-xs text-muted">of 100</span>
        <span className="mt-1 text-sm font-semibold" style={{ color }}>
          {bandText[band]}
        </span>
      </div>
    </div>
  )
}
