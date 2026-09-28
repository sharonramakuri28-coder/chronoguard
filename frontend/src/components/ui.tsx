import clsx from 'clsx'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, CircleHelp, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Band, FeatureStatus } from '../api/types'

export function GlassCard({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={clsx('glass p-5 sm:p-6', className)}
    >
      {children}
    </motion.section>
  )
}

export function PageHeader({ eyebrow, title, subtitle, actions }: {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="label mb-2 text-accent">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold text-white">{children}</h2>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function StatTile({ label, value, sub, tone = 'default', icon }: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'default' | 'leak' | 'safe' | 'memory' | 'accent'
  icon?: ReactNode
}) {
  const toneClass = {
    default: 'text-white',
    leak: 'text-leak',
    safe: 'text-safe',
    memory: 'text-memory',
    accent: 'text-accent',
  }[tone]
  return (
    <div className="glass flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <div className={clsx('num text-2xl font-semibold', toneClass)}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  )
}

const bandStyle: Record<Band, string> = {
  high: 'border-leak/40 bg-leak/10 text-leak',
  medium: 'border-warn/40 bg-warn/10 text-warn',
  low: 'border-safe/40 bg-safe/10 text-safe',
}

export function BandBadge({ band, children }: { band: Band; children?: ReactNode }) {
  const Icon = band === 'high' ? ShieldAlert : band === 'medium' ? AlertTriangle : CheckCircle2
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', bandStyle[band])}>
      <Icon className="size-3.5" aria-hidden />
      {children ?? `${band[0].toUpperCase()}${band.slice(1)} risk`}
    </span>
  )
}

export function StatusBadge({ status }: { status: FeatureStatus }) {
  const map = {
    leaked: { cls: 'border-leak/40 bg-leak/10 text-leak', Icon: ShieldAlert, text: 'Leaked' },
    safe: { cls: 'border-safe/40 bg-safe/10 text-safe', Icon: CheckCircle2, text: 'Safe' },
    unverified: { cls: 'border-slate-500/40 bg-slate-500/10 text-slate-300', Icon: CircleHelp, text: 'Unverified' },
  }[status]
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold', map.cls)}>
      <map.Icon className="size-3" aria-hidden />
      {map.text}
    </span>
  )
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300', className)}>
      {children}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-white/[0.05]', className)} />
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  )
}

export function EmptyState({ icon, title, children, action }: {
  icon: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="glass flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-2xl border border-line bg-white/[0.04] text-accent">{icon}</div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children && <p className="max-w-md text-sm text-muted">{children}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <div role="alert" className="glass flex flex-col items-start gap-3 border-leak/30 p-5">
      <div className="flex items-center gap-2 font-semibold text-leak">
        <AlertTriangle className="size-4" aria-hidden /> Could not load data
      </div>
      <p className="text-sm text-slate-300">{message}</p>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
