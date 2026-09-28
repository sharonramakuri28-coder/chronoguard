import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export const useHealth = () => useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 30_000, retry: 1 })

export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })

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
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 2,
  })

export const useIncidents = () => useQuery({ queryKey: ['incidents'], queryFn: api.incidents })

function useInvalidateAll() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['incidents'] })
  }
}

export function useUpload() {
  const invalidate = useInvalidateAll()
  return useMutation({ mutationFn: api.upload, onSuccess: invalidate })
}

export function useAuditSample() {
  const invalidate = useInvalidateAll()
  return useMutation({ mutationFn: api.auditSample, onSuccess: invalidate })
}

export function useRunReplay(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.runReplay(id),
    onSuccess: (data) => {
      qc.setQueryData(['replay', id], data)
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useSearch = () => useMutation({ mutationFn: api.search })
