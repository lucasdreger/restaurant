import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured, DEMO_SITE_ID } from '@/lib/supabase'
import type { Site } from '@/types'
import { useAuth } from '@/components/auth/auth-context'

export const SITE_KEYS = {
    current: (userId: string | undefined) => ['site', 'current', userId] as const,
}

// Fallback demo site
const FALLBACK_DEMO_SITE: Site = {
    id: DEMO_SITE_ID,
    name: 'Luma Executive Kitchen',
    address: 'Grand Canal Dock, Dublin 2, Ireland',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
}

export function useCurrentSite() {
    const { user, authState } = useAuth()

    return useQuery({
        queryKey: SITE_KEYS.current(user?.id),
        queryFn: async (): Promise<Site> => {
            // 1. If not authenticated or no user, use demo site if in demo mode
            if (authState === 'demo' || (authState === 'unauthenticated' && !user)) {
                return FALLBACK_DEMO_SITE
            }

            if (!user) return FALLBACK_DEMO_SITE

            if (!isSupabaseConfigured()) {
                return FALLBACK_DEMO_SITE
            }

            try {
                // 2. Check profile for current_venue_id
                const { data: profile } = await (supabase
                    .from('profiles') as any)
                    .select('current_venue_id')
                    .eq('id', user.id)
                    .single()

                if (profile?.current_venue_id) {
                    const { data: venue } = await (supabase
                        .from('venues') as any)
                        .select('*')
                        .eq('id', profile.current_venue_id)
                        .single()

                    if (venue) return mapVenueToSite(venue)
                }

                // 3. Fallback: Owned venue
                const { data: ownedVenue } = await (supabase
                    .from('venues') as any)
                    .select('*')
                    .eq('created_by', user.id)
                    .limit(1)
                    .single()

                if (ownedVenue) return mapVenueToSite(ownedVenue)

                // 4. Fallback: Member venue
                // Avoid relational embed here to prevent PostgREST relation-name drift issues.
                const { data: memberData } = await (supabase
                    .from('venue_members') as any)
                    .select('venue_id')
                    .eq('user_id', user.id)
                    .limit(1)
                    .single()

                if (memberData?.venue_id) {
                    const { data: memberVenue } = await (supabase
                        .from('venues') as any)
                        .select('*')
                        .eq('id', memberData.venue_id)
                        .single()

                    if (memberVenue) return mapVenueToSite(memberVenue)
                }

                // 5. No venue found
                // console.warn('No venue found for user, using demo site')
                return FALLBACK_DEMO_SITE
            } catch (err) {
                console.warn('Failed to fetch site:', err)
                return FALLBACK_DEMO_SITE
            }
        },
        enabled: authState === 'authenticated' || authState === 'demo',
        staleTime: 1000 * 60 * 5, // 5 minutes
    })
}

function mapVenueToSite(venue: any): Site {
    return {
        id: venue.id,
        name: venue.name,
        address: venue.address || undefined,
        kiosk_pin: venue.kiosk_pin || undefined,
        alert_email: venue.alert_email || undefined,
        alert_phone: venue.alert_phone || undefined,
        created_at: venue.created_at || new Date().toISOString(),
        updated_at: venue.updated_at || new Date().toISOString(),
    }
}
