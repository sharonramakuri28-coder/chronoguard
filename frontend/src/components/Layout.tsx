import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Brain, FlaskConical, LayoutDashboard, Menu, ScanSearch, X } from 'lucide-react'
import { Suspense, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { providerLabel } from '../lib/format'
import { useHealth } from '../hooks/useApi'
import { Logo } from './Logo'
import { PageSkeleton } from './ui'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/audits', label: 'Audit Results', icon: ScanSearch },
  { to: '/replay', label: 'Model Replay', icon: FlaskConical },
  { to: '/memory', label: 'Memory', icon: Brain },
]

function StatusDot({ ok }: { ok: boolean | undefined }) {
  return (
    <span
      className={clsx('size-2 rounded-full', ok === undefined ? 'bg-slate-500' : ok ? 'bg-safe' : 'bg-leak')}
      aria-hidden
    />
  )
}

function SystemStatus() {
  const { data, isError, isLoading } = useHealth()
  const ok = isLoading ? undefined : !isError && data?.status === 'ok'
  return (
    <div className="space-y-2 rounded-xl border border-line bg-white/[0.02] p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="label">System</span>
        <span className="flex items-center gap-1.5 text-slate-300">
          <StatusDot ok={ok} /> {isLoading ? 'Checking…' : ok ? 'API online' : 'API offline'}
        </span>
      </div>
      {data && (
        <dl className="space-y-1 text-muted">
          <div className="flex justify-between gap-2">
            <dt>Memory</dt>
            <dd className="text-slate-300">{providerLabel(data.embedding_provider)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Explanations</dt>
            <dd className="text-slate-300">{providerLabel(data.explanation_provider)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Hindsight</dt>
            <dd className="capitalize text-slate-300">{data.hindsight}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive ? 'bg-white/[0.06] text-white' : 'text-muted hover:bg-white/[0.03] hover:text-slate-200',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className={clsx('size-4', isActive ? 'text-accent' : '')} aria-hidden />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-6 border-r border-line bg-ink-950/70 p-5 backdrop-blur-xl lg:flex">
        <Logo />
        <Nav />
        <div className="mt-auto">
          <SystemStatus />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ink-950/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
        <button className="btn btn-ghost h-9 px-3" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-4" />
        </button>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="absolute inset-y-0 left-0 flex w-64 flex-col gap-6 border-r border-line bg-ink-900 p-5"
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button className="btn btn-ghost h-9 px-3" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X className="size-4" />
                </button>
              </div>
              <Nav onNavigate={() => setOpen(false)} />
              <div className="mt-auto">
                <SystemStatus />
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
