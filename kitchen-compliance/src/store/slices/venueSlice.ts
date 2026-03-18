import type { StateCreator } from 'zustand'
import type { Site } from '@/types'

// Venue data cache
export interface VenueCache {
    id: string
    name: string
    loadedAt: number
}

export interface VenueSlice {
    // Current site
    currentSite: Site | null
    setCurrentSite: (site: Site | null) => void

    // Demo mode
    isDemo: boolean
    setIsDemo: (isDemo: boolean) => void

    // Venue cache
    venueCache: VenueCache | null
    setVenueCache: (venue: VenueCache | null) => void
}

export const createVenueSlice: StateCreator<VenueSlice> = (set) => ({
    currentSite: null,
    setCurrentSite: (site) =>
        set((state) => {
            const currentSite = state.currentSite
            const unchanged =
                currentSite?.id === site?.id &&
                currentSite?.name === site?.name &&
                currentSite?.address === site?.address &&
                currentSite?.kiosk_pin === site?.kiosk_pin &&
                currentSite?.alert_email === site?.alert_email &&
                currentSite?.alert_phone === site?.alert_phone &&
                currentSite?.updated_at === site?.updated_at

            return unchanged ? state : { currentSite: site }
        }),

    isDemo: false,
    setIsDemo: (isDemo) => set((state) => (state.isDemo === isDemo ? state : { isDemo })),

    venueCache: null,
    setVenueCache: (venue) =>
        set((state) => {
            const current = state.venueCache
            const unchanged =
                current?.id === venue?.id &&
                current?.name === venue?.name &&
                current?.loadedAt === venue?.loadedAt

            return unchanged ? state : { venueCache: venue }
        }),
})
