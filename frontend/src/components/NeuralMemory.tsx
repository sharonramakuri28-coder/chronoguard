import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MemoryGraph } from '../api/types'

const COLORS = { incident: '#c084fc', pattern: '#5eead4', detection: '#fb7185', core: '#818cf8' }

interface Placed {
  id: string
  kind: 'incident' | 'pattern' | 'detection'
  label: string
  x: number
  y: number
  r: number
  ref: number | null
}

/**
 * The memory as a living network: every node is a stored incident, a failure pattern
 * (incidents that look like the same failure) or a detection (an audit where memory fired).
 * Layout is radial and deterministic; nothing is drawn that is not in the graph response.
 */
export function NeuralMemory({ graph, height = 340 }: { graph: MemoryGraph | undefined; height?: number }) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const W = 520
  const H = 360
  const cx = W / 2
  const cy = H / 2

  const { nodes, links } = useMemo(() => {
    const placed = new Map<string, Placed>()
    const links: { a: Placed; b: Placed; kind: string; similarity: number | null }[] = []
    if (!graph) return { nodes: [] as Placed[], links }
    const patterns = graph.nodes.filter((n) => n.kind === 'pattern')
    const detections = graph.nodes.filter((n) => n.kind === 'detection')
    const members = new Map<string, string[]>()
    graph.edges.filter((e) => e.kind === 'belongs_to').forEach((e) => members.set(e.target, [...(members.get(e.target) ?? []), e.source]))

    patterns.forEach((p, i) => {
      const angle = (i / Math.max(1, patterns.length)) * Math.PI * 2 - Math.PI / 2
      const R = patterns.length === 1 ? 0 : 92
      const px = cx + Math.cos(angle) * R
      const py = cy + Math.sin(angle) * R * 0.82
      placed.set(p.id, { id: p.id, kind: 'pattern', label: p.label, x: px, y: py, r: 5 + Math.min(6, p.weight * 1.4), ref: null })
      const inc = members.get(p.id) ?? []
      inc.forEach((iid, j) => {
        const node = graph.nodes.find((n) => n.id === iid)!
        const a2 = angle + ((j - (inc.length - 1) / 2) * 0.42)
        const rr = 46 + (j % 2) * 14
        placed.set(iid, {
          id: iid,
          kind: 'incident',
          label: node.label,
          x: px + Math.cos(a2) * rr,
          y: py + Math.sin(a2) * rr * 0.85,
          r: 3.2,
          ref: node.ref,
        })
      })
    })
    detections.forEach((d, i) => {
      const angle = (i / Math.max(1, detections.length)) * Math.PI * 2 + Math.PI / 5
      placed.set(d.id, {
        id: d.id,
        kind: 'detection',
        label: d.label,
        x: cx + Math.cos(angle) * 205,
        y: cy + Math.sin(angle) * 150,
        r: 6,
        ref: d.ref,
      })
    })
    graph.edges.forEach((e) => {
      const a = placed.get(e.source)
      const b = placed.get(e.target)
      if (a && b) links.push({ a, b, kind: e.kind, similarity: e.similarity })
    })
    return { nodes: [...placed.values()], links }
  }, [graph, cx, cy])

  const patterns = nodes.filter((n) => n.kind === 'pattern')

  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="size-full" role="img" aria-label={`Memory network: ${nodes.filter((n) => n.kind === 'incident').length} incidents, ${patterns.length} patterns, ${nodes.filter((n) => n.kind === 'detection').length} detections`}>
        <defs>
          <radialGradient id="core-glow">
            <stop offset="0%" stopColor={COLORS.core} stopOpacity="0.55" />
            <stop offset="100%" stopColor={COLORS.core} stopOpacity="0" />
          </radialGradient>
          <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={cx} cy={cy} r={120} fill="url(#core-glow)" className={reduce ? '' : 'neural-breathe'} />
        {/* core <-> patterns: the memory's long-term structure */}
        {patterns.map((p) => (
          <line key={`core-${p.id}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={COLORS.core} strokeOpacity={0.18} strokeWidth={1} />
        ))}
        {links.map((l, i) => (
          <line
            key={i}
            x1={l.a.x}
            y1={l.a.y}
            x2={l.b.x}
            y2={l.b.y}
            stroke={l.kind === 'recalled_by' ? COLORS.detection : COLORS.incident}
            strokeOpacity={l.kind === 'recalled_by' ? 0.7 : 0.35}
            strokeWidth={l.kind === 'recalled_by' ? 1.4 : 0.9}
            className={l.kind === 'recalled_by' && !reduce ? 'neural-flow' : ''}
          />
        ))}
        <circle cx={cx} cy={cy} r={9} fill={COLORS.core} filter="url(#soft-glow)" />
        {nodes.map((n, i) => (
          <motion.g
            key={n.id}
            initial={reduce ? false : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: reduce ? 0 : 0.02 * i, duration: 0.5 }}
            style={{ transformOrigin: `${n.x}px ${n.y}px`, cursor: n.ref !== null ? 'pointer' : 'default' }}
            onClick={() => {
              if (n.kind === 'detection' && n.ref !== null) navigate(`/audits/${n.ref}`)
              if (n.kind === 'incident' && n.ref !== null) navigate(`/timeline?incident=${n.ref}`)
            }}
          >
            <g className={reduce ? '' : 'neural-float'} style={{ animationDelay: `${(i % 7) * 0.6}s` }}>
              <circle cx={n.x} cy={n.y} r={n.r} fill={COLORS[n.kind]} filter="url(#soft-glow)" />
              <title>{`${n.kind}: ${n.label}`}</title>
              {n.kind !== 'incident' && (
                <text
                  x={n.x}
                  y={n.y + n.r + 11}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill={n.kind === 'detection' ? '#fecdd3' : '#cbd5e1'}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {n.label.length > 24 ? `${n.label.slice(0, 22)}…` : n.label}
                </text>
              )}
            </g>
          </motion.g>
        ))}
        {nodes.length === 0 && (
          <text x={cx} y={cy + 34} textAnchor="middle" fontSize="12" fill="#8b95ab">
            Memory is empty: audit a dataset to teach it.
          </text>
        )}
      </svg>
      <div className="pointer-events-none absolute bottom-1 left-1 flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-memory" /> incident</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> failure pattern</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-leak" /> new detection</span>
      </div>
    </div>
  )
}
