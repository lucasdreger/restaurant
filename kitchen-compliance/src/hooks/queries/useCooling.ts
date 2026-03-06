import { useQuery } from '@tanstack/react-query'
import { fetchActiveSessions, fetchCoolingSessions } from '@/services/coolingService'

export const COOLING_KEYS = {
    all: ['cooling'] as const,
    active: (siteId: string | undefined) => [...COOLING_KEYS.all, 'active', siteId] as const,
    history: (siteId: string | undefined) => [...COOLING_KEYS.all, 'history', siteId] as const,
}

export function useCoolingSessions(siteId: string | undefined) {
    return useQuery({
        queryKey: COOLING_KEYS.active(siteId),
        queryFn: async () => {
            if (!siteId) return []
            return fetchActiveSessions(siteId)
        },
        enabled: !!siteId,
        // Supabase Realtime handles live updates; keep a light fallback poll.
        refetchInterval: 1000 * 60 * 2,
    })
}

export function useCoolingHistory(siteId: string | undefined) {
    return useQuery({
        queryKey: COOLING_KEYS.history(siteId),
        queryFn: async () => {
            if (!siteId) return []
            // fetchCoolingSessions returns all sessions (active + closed)
            // Ideally we'd have a specific history endpoint, but for now filtering locally or using existing
            const allSessions = await fetchCoolingSessions(siteId)
            return allSessions.filter(s => s.status === 'closed' || s.status === 'discarded')
        },
        enabled: !!siteId,
    })
}
