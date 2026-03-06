import type { StateCreator } from 'zustand'

export interface UiSlice {
    // Connection status
    isOnline: boolean
    setIsOnline: (online: boolean) => void

    // Voice state
    isListening: boolean
    setIsListening: (listening: boolean) => void

    // Kiosk state
    kioskMode: boolean
    setKioskMode: (kiosk: boolean) => void
    kioskLocked: boolean
    activeStaffId: string | null
    lockKiosk: () => void
    unlockKiosk: (staffId: string) => void
}

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
    // Connection status
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    setIsOnline: (online) => set({ isOnline: online }),

    // Voice state
    isListening: false,
    setIsListening: (listening) => set({ isListening: listening }),

    // Kiosk state
    kioskMode: true,
    setKioskMode: (kiosk) => set({ kioskMode: kiosk }),
    kioskLocked: true, // Default to locked
    activeStaffId: null,
    lockKiosk: () => set({ kioskLocked: true, activeStaffId: null }),
    unlockKiosk: (staffId) => set({ kioskLocked: false, activeStaffId: staffId }),
})
