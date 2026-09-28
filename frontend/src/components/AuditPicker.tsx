import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../hooks/useApi'

/** Switch the page to another audit; keeps the URL as the source of truth. */
export function AuditPicker({ current, path }: { current: number; path: (id: number) => string }) {
  const { data } = useDashboard()
  const navigate = useNavigate()
  if (!data?.audits.length) return null
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span className="sr-only sm:not-sr-only">Audit</span>
      <select
        value={current}
        onChange={(e) => navigate(path(Number(e.target.value)))}
        className="h-10 max-w-[16rem] rounded-xl border border-line bg-ink-900 px-3 text-sm text-white focus:border-accent/50 focus:outline-none"
      >
        {data.audits.map((a) => (
          <option key={a.id} value={a.id}>
            #{a.id} · {a.dataset_name} {a.leaked_features ? `· ${a.leaked_features} leaked` : '· clean'}
          </option>
        ))}
      </select>
    </label>
  )
}
