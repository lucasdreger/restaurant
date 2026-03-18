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
    setIsOnline: (online) => set((state) => (state.isOnline === online ? state : { isOnline: online })),

    // Voice state
    isListening: false,
    setIsListening: (listening) => set((state) => (state.isListening === listening ? state : { isListening: listening })),

    // Kiosk state
    kioskMode: false,
    setKioskMode: (kiosk) =>
        set((state) => {
            if (!kiosk) {
                if (!state.kioskMode && !state.kioskLocked && state.activeStaffId === null) return state
                return { kioskMode: false, kioskLocked: false, activeStaffId: null }
            }

            return state.kioskMode ? state : { kioskMode: true }
        }),
    kioskLocked: false,
    activeStaffId: null,
    lockKiosk: () =>
        set((state) => (
            state.kioskLocked && state.activeStaffId === null
                ? state
                : { kioskLocked: true, activeStaffId: null }
        )),
    unlockKiosk: (staffId) =>
        set((state) => (
            !state.kioskLocked && state.activeStaffId === staffId
                ? state
                : { kioskLocked: false, activeStaffId: staffId }
        )),
})
