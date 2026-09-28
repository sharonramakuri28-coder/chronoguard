import type {
  AffectedPage,
  AuditOut,
  AuditSummary,
  DashboardOut,
  HealthOut,
  IncidentOut,
  ReplayOut,
  SampleOut,
  SearchOut,
} from './types'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://127.0.0.1:8000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new ApiError(0, `Cannot reach the ChronoGuard API at ${API_URL}. Is the backend running?`)
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  health: () => request<HealthOut>('/api/health'),
  dashboard: () => request<DashboardOut>('/api/dashboard'),
  samples: () => request<SampleOut[]>('/api/samples'),
  audits: () => request<AuditSummary[]>('/api/audits'),
  audit: (id: number) => request<AuditOut>(`/api/audits/${id}`),
  affected: (id: number, offset: number, limit: number) =>
    request<AffectedPage>(`/api/audits/${id}/affected?offset=${offset}&limit=${limit}`),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<AuditOut>('/api/datasets', { method: 'POST', body: form })
  },
  auditSample: (name: string) => request<AuditOut>(`/api/samples/${encodeURIComponent(name)}/audit`, { method: 'POST' }),
  replay: (id: number) => request<ReplayOut>(`/api/audits/${id}/replay`),
  runReplay: (id: number) => request<ReplayOut>(`/api/audits/${id}/replay`, { method: 'POST' }),
  incidents: () => request<IncidentOut[]>('/api/memory/incidents'),
  search: (query: string) => request<SearchOut>('/api/memory/search', json({ query, limit: 6 })),
}
