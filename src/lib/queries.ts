import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ListResponse } from './api'
import type { ResourceKey } from './resources'

export type GostItem = {
  name: string
  status?: {
    createTime?: number
    state?: string
    events?: Array<{ time: number; msg: string }>
  }
  [k: string]: unknown
}

/** Just the names of existing items of a resource — for ref dropdowns. */
export function useExistingNames(key: ResourceKey) {
  return useQuery({
    // Distinct from useResourceList so they don't fight over staleTime/select.
    queryKey: ['resource-names', key],
    queryFn: async () => {
      const { data } = await api.get<ListResponse<GostItem>>(`/config/${key}`)
      return (data.data?.list ?? []).map((it) => it.name).filter(Boolean)
    },
    staleTime: 30_000,
  })
}

export function useResourceList(key: ResourceKey) {
  return useQuery({
    queryKey: ['resource', key],
    queryFn: async () => {
      const { data } = await api.get<ListResponse<GostItem>>(`/config/${key}`)
      return data.data
    },
  })
}

export function useResource(key: ResourceKey, name: string | undefined) {
  return useQuery({
    queryKey: ['resource', key, name],
    enabled: !!name,
    queryFn: async () => {
      const { data } = await api.get<{ data?: GostItem } | GostItem>(
        `/config/${key}/${name}`,
      )
      // gost wraps some endpoints as {data}, others not; handle both.
      const item = (data as { data?: GostItem }).data ?? (data as GostItem)
      return item
    },
  })
}

export function useFullConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const { data } = await api.get<Record<string, unknown>>(`/config`)
      return data
    },
  })
}

export function useReloadConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post('/config/reload')
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useCreateResource(key: ResourceKey) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: GostItem) => {
      await api.post(`/config/${key}`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resource', key] })
      qc.invalidateQueries({ queryKey: ['config'] })
    },
  })
}

export function useUpdateResource(key: ResourceKey) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, payload }: { name: string; payload: GostItem }) => {
      await api.put(`/config/${key}/${name}`, payload)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['resource', key] })
      qc.invalidateQueries({ queryKey: ['resource', key, vars.name] })
      qc.invalidateQueries({ queryKey: ['config'] })
    },
  })
}

export function useDeleteResource(key: ResourceKey) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      await api.delete(`/config/${key}/${name}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resource', key] })
      qc.invalidateQueries({ queryKey: ['config'] })
    },
  })
}
