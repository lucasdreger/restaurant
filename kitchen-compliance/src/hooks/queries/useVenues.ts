import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Site } from '@/types'

export const VENUE_KEYS = {
    all: ['venues'] as const,
    user: (userId: string | undefined) => [...VENUE_KEYS.all, 'user', userId] as const,
    detail: (venueId: string | undefined) => [...VENUE_KEYS.all, 'detail', venueId] as const,
}

// Fetch all venues the user has access to
export function useUserVenues(userId: string | undefined) {
    return useQuery({
        queryKey: VENUE_KEYS.user(userId),
        queryFn: async () => {
            if (!userId) return []

            // Get venue ids where user is a member.
            // Avoid relational embed to prevent relation-name drift issues in PostgREST.
            const { data: memberRows, error: memberError } = await (supabase
                .from('venue_members') as any)
                .select('venue_id')
                .eq('user_id', userId)

            if (memberError) throw memberError

            const memberVenueIds = Array.from(
                new Set((memberRows || []).map((row: any) => row.venue_id).filter(Boolean))
            )

            let memberVenues: any[] = []
            if (memberVenueIds.length > 0) {
                const { data: memberVenueData, error: memberVenueError } = await (supabase
                    .from('venues') as any)
                    .select('*')
                    .in('id', memberVenueIds)

                if (memberVenueError) throw memberVenueError
                memberVenues = memberVenueData || []
            }

            // Get venues created by user
            const { data: createdVenues, error: createdError } = await supabase
                .from('venues')
                .select('*')
                .eq('created_by', userId)

            if (createdError) throw createdError

            const venues: Site[] = []

            if (memberVenues) {
                memberVenues.forEach((venue: any) => {
                    venues.push(mapVenueToSite(venue))
                })
            }

            if (createdVenues) {
                createdVenues.forEach(v => {
                    const site = mapVenueToSite(v)
                    if (!venues.find(existing => existing.id === site.id)) {
                        venues.push(site)
                    }
                })
            }

            return venues
        },
        enabled: !!userId,
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
