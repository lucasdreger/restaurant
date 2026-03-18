import { useQuery } from '@tanstack/react-query'
import { getFridges } from '@/services/fridgeService'

export const FRIDGE_KEYS = {
  all: ['fridges'] as const,
  list: (siteId: string | undefined) => [...FRIDGE_KEYS.all, 'list', siteId] as const,
} as const

export function useFridges(siteId: string | undefined) {
  return useQuery({
    queryKey: FRIDGE_KEYS.list(siteId),
    queryFn: async () => {
      if (!siteId) return []
      return getFridges(siteId)
    },
    enabled: !!siteId,
    // Fridge metadata changes rarely; keep it warm in cache for modal-heavy flows.
    staleTime: 1000 * 60 * 10,
  })
}
