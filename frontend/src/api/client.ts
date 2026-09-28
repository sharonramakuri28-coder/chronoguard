import type {
  AffectedPage,
  AuditOut,
  AuditSummary,
  ChatOut,
  CommandCenterOut,
  DashboardOut,
  FeedbackOut,
  HealthOut,
  HindsightRecallOut,
  HindsightReflectOut,
  HindsightStatus,
  IncidentDetail,
  IncidentOut,
  MemoryEvent,
  MemoryGraph,
  ReplayOut,
  ReportOut,
  SampleOut,
  SearchOut,
} from './types'

// Backend base URL, set at build time (e.g. VITE_API_URL=https://chronoguard-pt4n.onrender.com).
// In development it may be left empty: the Vite dev server proxies /api to the backend.
const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '')
export const API_URL = configured ?? ''
const MISCONFIGURED = import.meta.env.PROD && !configured

const UNREACHABLE =
  'Cannot reach the ChronoGuard API. If it runs on a free hosting tier it may be waking up; this can take up to a minute.'

/** Network failures and gateway errors (e.g. a sleeping host waking up) are worth retrying. */
export const isTransientStatus = (status: number | undefined) =>
  status === 0 || status === 502 || status === 503 || status === 504

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (MISCONFIGURED) {
    throw new ApiError(-1, 'This build has no backend configured. Set VITE_API_URL to the ChronoGuard API URL and rebuild.')
  }
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new ApiError(0, UNREACHABLE)
  }
  if (isTransientStatus(res.status)) throw new ApiError(res.status, UNREACHABLE)
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
  sampleDownloadUrl: (name: string) => `${API_URL}/api/samples/${encodeURIComponent(name)}/download`,
  audits: () => request<AuditSummary[]>('/api/audits'),
  audit: (id: number) => request<AuditOut>(`/api/audits/${id}`),
  affected: (id: number, offset: number, limit: number) =>
    request<AffectedPage>(`/api/audits/${id}/affected?offset=${offset}&limit=${limit}`),
  upload: ({ file, modelName }: { file: File; modelName?: string }) => {
    const form = new FormData()
    form.append('file', file)
    if (modelName?.trim()) form.append('model_name', modelName.trim())
    return request<AuditOut>('/api/datasets', { method: 'POST', body: form })
  },
  auditSample: (name: string) => request<AuditOut>(`/api/samples/${encodeURIComponent(name)}/audit`, { method: 'POST' }),
  replay: (id: number) => request<ReplayOut | null>(`/api/audits/${id}/replay`),
  runReplay: (id: number) => request<ReplayOut>(`/api/audits/${id}/replay`, { method: 'POST' }),
  feedback: (id: number, successful: boolean, note?: string) =>
    request<FeedbackOut>(`/api/audits/${id}/feedback`, json({ successful, note: note?.trim() || null })),
  incidents: () => request<IncidentOut[]>('/api/incidents'),
  incident: (id: number) => request<IncidentDetail>(`/api/incidents/${id}`),
  search: (query: string) => request<SearchOut>('/api/memory/search', json({ query, limit: 6 })),
  graph: () => request<MemoryGraph>('/api/memory/graph'),
  timeline: () => request<MemoryEvent[]>('/api/memory/timeline'),
  commandCenter: () => request<CommandCenterOut>('/api/command-center'),
  hindsightStatus: () => request<HindsightStatus>('/api/hindsight/status'),
  hindsightRecall: (query: string) => request<HindsightRecallOut>('/api/hindsight/recall', json({ query })),
  hindsightReflect: (query: string) => request<HindsightReflectOut>('/api/hindsight/reflect', json({ query })),
  report: (id: number) => request<ReportOut>(`/api/reports/${id}`),
  reportDownloadUrl: (id: number) => `${API_URL}/api/reports/${id}/download`,
  chat: (message: string, auditId?: number) => request<ChatOut>('/api/chat', json({ message, audit_id: auditId ?? null })),
}
