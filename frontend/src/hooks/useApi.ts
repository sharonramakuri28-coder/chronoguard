import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export const useHealth = () => useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 30_000 })

export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })

export const useCommandCenter = () => useQuery({ queryKey: ['command-center'], queryFn: api.commandCenter })

export const useSamples = () => useQuery({ queryKey: ['samples'], queryFn: api.samples, staleTime: Infinity })

export const useAudit = (id: number | undefined) =>
  useQuery({ queryKey: ['audit', id], queryFn: () => api.audit(id!), enabled: id !== undefined })

export const useAffected = (id: number, offset: number, limit: number) =>
  useQuery({ queryKey: ['affected', id, offset, limit], queryFn: () => api.affected(id, offset, limit) })

export const useReplay = (id: number | undefined) =>
  useQuery({
    queryKey: ['replay', id],
    queryFn: () => api.replay(id!),
    enabled: id !== undefined,
  })

export const useIncidents = () => useQuery({ queryKey: ['incidents'], queryFn: api.incidents })

export const useIncident = (id: number | null) =>
  useQuery({ queryKey: ['incident', id], queryFn: () => api.incident(id!), enabled: id !== null })

export const useMemoryGraph = () => useQuery({ queryKey: ['memory-graph'], queryFn: api.graph })

export const useMemoryTimeline = () => useQuery({ queryKey: ['memory-timeline'], queryFn: api.timeline })

export const useHindsightStatus = () =>
  useQuery({ queryKey: ['hindsight-status'], queryFn: api.hindsightStatus, staleTime: 30_000 })

export const useReport = (id: number | undefined) =>
  useQuery({ queryKey: ['report', id], queryFn: () => api.report(id!), enabled: id !== undefined })

/** Everything derived from audits, incidents and memory. */
const DERIVED = ['dashboard', 'command-center', 'incidents', 'incident', 'memory-graph', 'memory-timeline', 'report', 'hindsight-status']

export function useInvalidateMemory() {
  const qc = useQueryClient()
  return () => DERIVED.forEach((key) => qc.invalidateQueries({ queryKey: [key] }))
}

export function useUpload() {
  const invalidate = useInvalidateMemory()
  return useMutation({ mutationFn: api.upload, onSuccess: invalidate })
}

export function useAuditSample() {
  const invalidate = useInvalidateMemory()
  return useMutation({ mutationFn: api.auditSample, onSuccess: invalidate })
}

export function useRunReplay(id: number) {
  const qc = useQueryClient()
  const invalidate = useInvalidateMemory()
  return useMutation({
    mutationFn: () => api.runReplay(id),
    onSuccess: (data) => {
      qc.setQueryData(['replay', id], data)
      invalidate()
    },
  })
}

export function useFeedback(id: number) {
  const qc = useQueryClient()
  const invalidate = useInvalidateMemory()
  return useMutation({
    mutationFn: ({ successful, note }: { successful: boolean; note?: string }) => api.feedback(id, successful, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit'] })
      invalidate()
    },
  })
}

export const useSearch = () => useMutation({ mutationFn: api.search })
export const useChat = () => useMutation({ mutationFn: ({ message, auditId }: { message: string; auditId?: number }) => api.chat(message, auditId) })
export const useHindsightReflect = () => useMutation({ mutationFn: api.hindsightReflect })
