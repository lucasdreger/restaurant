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
    setCurrentSite: (site) => set({ currentSite: site }),

    isDemo: false,
    setIsDemo: (isDemo) => set({ isDemo }),

    venueCache: null,
    setVenueCache: (venue) => set({ venueCache: venue }),
})
