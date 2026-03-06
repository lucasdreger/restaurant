import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface VenueStats {
    venueId: string
    activeSessions: number
    complianceScore: number
    staffCount: number
    alerts: number
    lastActivity: string | null
}

export const VENUE_STATS_KEYS = {
    all: ['venueStats'] as const,
    list: (venueIds: string[]) => [...VENUE_STATS_KEYS.all, 'list', venueIds] as const,
}

export function useVenueStats(venueIds: string[]) {
    const queryClient = useQueryClient()
    const venueIdsKey = useMemo(() => [...venueIds].sort().join(','), [venueIds])
    const trackedVenueIds = useMemo(() => (venueIdsKey ? venueIdsKey.split(',') : []), [venueIdsKey])

    useEffect(() => {
        if (!trackedVenueIds.length || !isSupabaseConfigured()) return

        const trackedVenueIdSet = new Set(trackedVenueIds)
        const shouldInvalidate = (payload: any): boolean => {
            const newSiteId = payload?.new?.site_id as string | undefined
            const oldSiteId = payload?.old?.site_id as string | undefined
            return Boolean(
                (newSiteId && trackedVenueIdSet.has(newSiteId)) ||
                (oldSiteId && trackedVenueIdSet.has(oldSiteId))
            )
        }

        const channel = supabase
            .channel(`venue-stats-live:${venueIdsKey}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cooling_sessions' },
                (payload) => {
                    if (shouldInvalidate(payload)) {
                        queryClient.invalidateQueries({ queryKey: VENUE_STATS_KEYS.list(trackedVenueIds) })
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'staff_members' },
                (payload) => {
                    if (shouldInvalidate(payload)) {
                        queryClient.invalidateQueries({ queryKey: VENUE_STATS_KEYS.list(trackedVenueIds) })
                    }
                }
            )
            .subscribe()

        return () => {
            void supabase.removeChannel(channel)
        }
    }, [queryClient, trackedVenueIds, venueIdsKey])

    return useQuery({
        queryKey: VENUE_STATS_KEYS.list(trackedVenueIds),
        queryFn: async (): Promise<Record<string, VenueStats>> => {
            if (!trackedVenueIds.length) return {}

            // 1. Get Active Sessions Count per venue
            const { data: activeData, error: activeError } = await supabase
                .from('cooling_sessions')
                .select('site_id')
                .in('site_id', trackedVenueIds)
                .is('end_time', null)

            if (activeError) throw activeError

            // Group active sessions by site_id
            const activeCountBySite: Record<string, number> = {}
            if (activeData) {
                (activeData as any[]).forEach(item => {
                    const siteId = item.site_id
                    if (siteId) {
                        activeCountBySite[siteId] = (activeCountBySite[siteId] || 0) + 1
                    }
                })
            }

            // 2. Get Staff Count per venue
            const { data: staffData, error: staffError } = await supabase
                .from('staff_members')
                .select('site_id')
                .in('site_id', trackedVenueIds)
                .eq('active', true)

            if (staffError) throw staffError

            const staffCountBySite: Record<string, number> = {}
            if (staffData) {
                (staffData as any[]).forEach(item => {
                    const siteId = item.site_id
                    if (siteId) {
                        staffCountBySite[siteId] = (staffCountBySite[siteId] || 0) + 1
                    }
                })
            }

            // 3. Get Recent Compliance (Last 7 days)
            // const sevenDaysAgo = new Date()
            // sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

            // Note: This is a simplified compliance check.
            // In a real app, you might want a dedicated stats table or an RPC function for performance.
            // const { data: historyData, error: historyError } = await supabase
            //     .from('cooling_sessions')
            //     .select('site_id, created_at') // We just need to know they exist for now, eventually check 'status' if available
            //     .in('site_id', venueIds)
            //     .gte('created_at', sevenDaysAgo.toISOString())
            //     .not('end_time', 'is', null) // Only completed sessions

            // if (historyError) throw historyError

            // Check for last activity
            const lastActivityBySite: Record<string, string> = {}

            // Combine active + history for last activity can be complex, just use distinct queries for now or rely on what we have.
            // We'll use the specific last activity query we wrote below.

            const { data: lastActivityData, error: lastActivityError } = await supabase
                .from('cooling_sessions')
                .select('site_id, created_at')
                .in('site_id', trackedVenueIds)
                .order('created_at', { ascending: false })

            if (!lastActivityError && lastActivityData) {
                (lastActivityData as any[]).forEach(item => {
                    if (item.site_id && !lastActivityBySite[item.site_id]) {
                        lastActivityBySite[item.site_id] = item.created_at
                    }
                })
            }

            // Calculate Mock Compliance for now (random high number or based on completions)
            // Since we don't have a specific 'compliance_status' column easily accessible without analyzing logs
            // We'll default to 100% or calculate based on some metric if possible.
            // For MVP, let's return 98% as placeholder or calc simple ratio.

            const stats: Record<string, VenueStats> = {}

            trackedVenueIds.forEach(id => {
                stats[id] = {
                    venueId: id,
                    activeSessions: activeCountBySite[id] || 0,
                    complianceScore: 95 + Math.floor(Math.random() * 5), // Mock for now until we have strict compliance logic
                    staffCount: staffCountBySite[id] || 0,
                    alerts: 0, // Placeholder
                    lastActivity: lastActivityBySite[id] || null
                }
            })

            return stats
        },
        enabled: trackedVenueIds.length > 0
    })
}
