export const fmtInt = (n: number) => n.toLocaleString('en-US')

export const fmtPct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`

export const fmtScore = (n: number) => n.toFixed(0)

export const fmtMetric = (n: number) => n.toFixed(3)

/** Signed difference, e.g. -0.308 or +0.012; handles negatives correctly. */
export const fmtDelta = (n: number, digits = 3) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}`

export function fmtDuration(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—'
  const h = Math.abs(hours)
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`
  if (h < 48) return `${h.toFixed(1)} h`
  return `${(h / 24).toFixed(1)} days`
}

export function fmtOffset(hours: number | null): string {
  if (hours === null) return 'unknown'
  if (hours === 0) return 'at prediction'
  return hours > 0 ? `+${fmtDuration(hours)} after` : `${fmtDuration(hours)} before`
}

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—'

export const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
      })
    : '—'

export const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`

export const providerLabel = (p: string) =>
  ({
    'local-vectors': 'Local vector memory',
    'azure-openai': 'Azure OpenAI',
    template: 'Evidence template',
  })[p] ?? p
