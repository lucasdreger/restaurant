import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { COOLING_KEYS } from '@/hooks/queries/useCooling'
import { HACCP_KEYS } from '@/hooks/queries/useHaccp'
import { STAFF_KEYS } from '@/hooks/queries/useStaff'
import { SETTINGS_KEYS } from '@/hooks/queries/useSiteSettings'
import { SITE_KEYS } from '@/hooks/queries/useCurrentSite'
import { VENUE_KEYS } from '@/hooks/queries/useVenues'
import { VENUE_STATS_KEYS } from '@/hooks/queries/useVenueStats'

interface UseRealtimeSyncOptions {
    siteId?: string
    userId?: string
}

export type RealtimeChannelStatus = 'idle' | 'connecting' | 'subscribed' | 'timed_out' | 'closed' | 'error'

interface RealtimeSyncState {
    siteStatus: RealtimeChannelStatus
    userStatus: RealtimeChannelStatus
    debugEnabled: boolean
}

export function useRealtimeSync({ siteId, userId }: UseRealtimeSyncOptions) {
    const queryClient = useQueryClient()
    const debugEnabled = useMemo(
        () => import.meta.env.DEV || import.meta.env.VITE_DEBUG_REALTIME === 'true',
        []
    )
    const [siteStatus, setSiteStatus] = useState<RealtimeChannelStatus>('idle')
    const [userStatus, setUserStatus] = useState<RealtimeChannelStatus>('idle')

    const mapSubscribeStatus = (status: string): RealtimeChannelStatus => {
        switch (status) {
            case 'SUBSCRIBED':
                return 'subscribed'
            case 'TIMED_OUT':
                return 'timed_out'
            case 'CLOSED':
                return 'closed'
            case 'CHANNEL_ERROR':
                return 'error'
            default:
                return 'connecting'
        }
    }

    const notifyStatus = (scope: 'site' | 'user', status: RealtimeChannelStatus) => {
        if (!debugEnabled) return

        const toastId = `realtime-${scope}`
        const label = scope === 'site' ? 'Site channel' : 'User channel'

        if (status === 'subscribed') {
            toast.success(`Realtime ${label} connected`, { id: toastId, duration: 2000 })
            return
        }

        if (status === 'connecting') {
            toast.message(`Realtime ${label} connecting...`, { id: toastId, duration: 1500 })
            return
        }

        if (status === 'timed_out' || status === 'error' || status === 'closed') {
            toast.error(`Realtime ${label} ${status.replace('_', ' ')}`, { id: toastId, duration: 4000 })
        }
    }

    useEffect(() => {
        if (!siteId || !isSupabaseConfigured()) {
            setSiteStatus('idle')
            return
        }

        setSiteStatus('connecting')
        notifyStatus('site', 'connecting')

        const channel = supabase
            .channel(`site-live:${siteId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'haccp_workflows', filter: `site_id=eq.${siteId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: HACCP_KEYS.all })
                    queryClient.invalidateQueries({ queryKey: VENUE_STATS_KEYS.all })
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'haccp_batches', filter: `site_id=eq.${siteId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: HACCP_KEYS.all })
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'haccp_workflow_events', filter: `site_id=eq.${siteId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: HACCP_KEYS.all })
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'haccp_reminders', filter: `site_id=eq.${siteId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: HACCP_KEYS.all })
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cooling_sessions', filter: `site_id=eq.${siteId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: COOLING_KEYS.active(siteId) })
                    queryClient.invalidateQueries({ queryKey: COOLING_KEYS.history(siteId) })
                    queryClient.invalidateQueries({ queryKey: VENUE_STATS_KEYS.all })
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'staff_members', filter: `site_id=eq.${siteId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: STAFF_KEYS.list(siteId) })
                    queryClient.invalidateQueries({ queryKey: VENUE_STATS_KEYS.all })
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'site_settings', filter: `site_id=eq.${siteId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS.site(siteId) })
                }
            )
            .subscribe((status) => {
                const mapped = mapSubscribeStatus(status)
                setSiteStatus(mapped)
                notifyStatus('site', mapped)
            })

        return () => {
            setSiteStatus('idle')
            void supabase.removeChannel(channel)
        }
    }, [siteId, queryClient])

    useEffect(() => {
        if (!userId || !isSupabaseConfigured()) {
            setUserStatus('idle')
            return
        }

        setUserStatus('connecting')
        notifyStatus('user', 'connecting')

        const channel = supabase
            .channel(`user-live:${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: SITE_KEYS.current(userId) })
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'venue_members', filter: `user_id=eq.${userId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: SITE_KEYS.current(userId) })
                    queryClient.invalidateQueries({ queryKey: VENUE_KEYS.user(userId) })
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'venues', filter: `created_by=eq.${userId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: SITE_KEYS.current(userId) })
                    queryClient.invalidateQueries({ queryKey: VENUE_KEYS.user(userId) })
                }
            )
            .subscribe((status) => {
                const mapped = mapSubscribeStatus(status)
                setUserStatus(mapped)
                notifyStatus('user', mapped)
            })

        return () => {
            setUserStatus('idle')
            void supabase.removeChannel(channel)
        }
    }, [userId, queryClient])

    return {
        siteStatus,
        userStatus,
        debugEnabled,
    } satisfies RealtimeSyncState
}
