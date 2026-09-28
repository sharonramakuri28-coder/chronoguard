import { Link } from 'react-router-dom'

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="ChronoGuard home">
      <span className="relative grid size-9 place-items-center rounded-xl border border-accent/30 bg-accent/10 shadow-[0_0_24px_-6px_rgb(94_234_212_/_0.6)]">
        <svg viewBox="0 0 24 24" className="size-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" />
          <path d="M12 8v4l2.5 1.5" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight text-white">ChronoGuard</span>
        <span className="block text-[10px] uppercase tracking-[0.18em] text-muted">Temporal ML audit</span>
      </span>
    </Link>
  )
}
