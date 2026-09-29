import { motion, useReducedMotion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GraphNode, MemoryGraph } from '../api/types'

const COL = { incident: 240, pattern: 540, detection: 790 }
const COLOR = { incident: '#c084fc', pattern: '#5eead4', detection: '#fb7185' }
const ROW = 34

/** Past incidents → failure patterns → new detections, as three linked columns. */
export function MemoryGraphView({ graph }: { graph: MemoryGraph }) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const [hover, setHover] = useState<string | null>(null)

  const layout = useMemo(() => {
    const byKind = (k: GraphNode['kind']) => graph.nodes.filter((n) => n.kind === k)
    const patterns = byKind('pattern')
    const detections = byKind('detection')
    // Incidents ordered by their pattern so links do not cross.
    const patternOf = new Map(graph.edges.filter((e) => e.kind === 'belongs_to').map((e) => [e.source, e.target]))
    const order = new Map(patterns.map((p, i) => [p.id, i]))
    const incidents = byKind('incident').sort(
      (a, b) => (order.get(patternOf.get(a.id) ?? '') ?? 0) - (order.get(patternOf.get(b.id) ?? '') ?? 0),
    )
    const rows = Math.max(incidents.length, patterns.length, detections.length, 1)
    const height = rows * ROW + 40
    const place = (list: GraphNode[], x: number) =>
      list.map((n, i) => ({ ...n, x, y: 30 + ((i + 0.5) * (height - 40)) / list.length }))
    const all = [...place(incidents, COL.incident), ...place(patterns, COL.pattern), ...place(detections, COL.detection)]
    const pos = new Map(all.map((n) => [n.id, n]))
    return { all, pos, height }
  }, [graph])

  // Hovering lights the node, its neighbours, and the other side of any pattern it touches.
  const linked = useMemo(() => {
    if (!hover) return null
    const set = new Set([hover])
    const neighbours = (id: string) =>
      graph.edges.forEach((e) => {
        if (e.source === id) set.add(e.target)
        if (e.target === id) set.add(e.source)
      })
    neighbours(hover)
    graph.nodes.filter((n) => n.kind === 'pattern' && set.has(n.id) && n.id !== hover).forEach((p) => neighbours(p.id))
    return set
  }, [hover, graph])

  const { all, pos, height } = layout
  const W = 1000

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} className="min-w-[720px]" style={{ width: '100%' }} role="img" aria-label="Memory graph">
        {(['incident', 'pattern', 'detection'] as const).map((k) => (
          <text key={k} x={COL[k]} y={14} textAnchor="middle" fontSize="11" fill="#8b95ab" letterSpacing="1.5">
            {k === 'incident' ? 'PAST INCIDENTS' : k === 'pattern' ? 'FAILURE PATTERNS' : 'NEW DETECTIONS'}
          </text>
        ))}
        {graph.edges.map((e, i) => {
          const a = pos.get(e.source)
          const b = pos.get(e.target)
          if (!a || !b) return null
          const dim = linked && !(linked.has(e.source) && linked.has(e.target))
          const mid = (a.x + b.x) / 2
          return (
            <motion.path
              key={i}
              d={`M${a.x + 8},${a.y} C${mid},${a.y} ${mid},${b.y} ${b.x - 8},${b.y}`}
              fill="none"
              stroke={e.kind === 'recalled_by' ? COLOR.detection : COLOR.incident}
              strokeWidth={e.kind === 'recalled_by' ? 1.6 + (e.similarity ?? 0) : 1}
              strokeOpacity={dim ? 0.08 : e.kind === 'recalled_by' ? 0.75 : 0.4}
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: reduce ? 0 : 0.01 * i }}
            />
          )
        })}
        {all.map((n) => {
          const dim = linked && !linked.has(n.id)
          const anchor = n.kind === 'incident' ? 'end' : n.kind === 'detection' ? 'start' : 'middle'
          const dx = n.kind === 'incident' ? -12 : n.kind === 'detection' ? 12 : 0
          const dy = n.kind === 'pattern' ? -12 : 4
          const clickable = n.ref !== null
          return (
            <g
              key={n.id}
              opacity={dim ? 0.25 : 1}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => {
                if (n.kind === 'detection' && n.ref !== null) navigate(`/audits/${n.ref}`)
                if (n.kind === 'incident' && n.ref !== null) navigate(`/timeline?incident=${n.ref}`)
              }}
              style={{ cursor: clickable ? 'pointer' : 'default', transition: 'opacity 150ms' }}
            >
              <circle cx={n.x} cy={n.y} r={n.kind === 'pattern' ? 7 : 5} fill={COLOR[n.kind]} style={{ filter: `drop-shadow(0 0 6px ${COLOR[n.kind]})` }} />
              <text x={n.x + dx} y={n.y + dy} textAnchor={anchor} fontSize="11" fill="#e2e8f0" fontFamily="JetBrains Mono, monospace">
                {n.label.length > 32 ? `${n.label.slice(0, 30)}…` : n.label}
              </text>
              {n.kind !== 'pattern' && (
                <text x={n.x + dx} y={n.y + dy + 12} textAnchor={anchor} fontSize="9.5" fill="#8b95ab">
                  {n.sublabel.length > 34 ? `${n.sublabel.slice(0, 32)}…` : n.sublabel}
                </text>
              )}
              {n.kind === 'pattern' && (
                <text x={n.x} y={n.y + 20} textAnchor="middle" fontSize="9.5" fill="#8b95ab">
                  {n.sublabel}
                </text>
              )}
              <title>{`${n.label} — ${n.sublabel}`}</title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
