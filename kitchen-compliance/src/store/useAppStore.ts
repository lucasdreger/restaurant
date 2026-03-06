import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CoolingSession, Alert, FoodItemPreset } from '@/types'

// Import Slices
import { createVenueSlice, type VenueSlice } from './slices/venueSlice'
import { createDataSlice, type DataSlice } from './slices/dataSlice'
import { createUiSlice, type UiSlice } from './slices/uiSlice'
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice'

// Re-export types from settings slice for backward compatibility
export type { AppTheme, AudioModel, OCRModel, OCRProvider, WakeWordId, AppSettings, VoiceProvider } from './slices/settingsSlice'
export { OCR_MODEL_INFO, WAKE_WORD_OPTIONS } from './slices/settingsSlice'

// App state interface combining all slices
export type AppState = VenueSlice & DataSlice & UiSlice & SettingsSlice

// Create the store with persistence
export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createVenueSlice(...a),
      ...createDataSlice(...a),
      ...createUiSlice(...a),
      ...createSettingsSlice(...a),
    }),
    {
      name: 'kitchen-compliance-storage',
      partialize: (state) => ({
        // Venue Slice
        currentSite: state.currentSite,
        venueCache: state.venueCache,
        isDemo: state.isDemo, // Added isDemo to persistence explicitly

        // Data Slice
        // Data Slice
        foodPresets: state.foodPresets,
        offlineQueue: state.offlineQueue,

        // UI Slice
        kioskMode: state.kioskMode,
        activeStaffId: state.activeStaffId,
        // Don't persist kioskLocked - always start locked on refresh for security

        // Settings Slice
        settings: state.settings,
      }),
    }
  )
)

// Simple getters (not hooks) for derived data
// Only include sessions that are NOT closed (no closed_at timestamp)
export const getActiveSessions = (sessions: CoolingSession[]) =>
  sessions.filter(
    (s) => !s.closed_at && (s.status === 'active' || s.status === 'warning' || s.status === 'overdue')
  )

export const getOverdueSessions = (sessions: CoolingSession[]) =>
  sessions.filter((s) => !s.closed_at && s.status === 'overdue')

export const getWarningSessions = (sessions: CoolingSession[]) =>
  sessions.filter((s) => !s.closed_at && s.status === 'warning')

export const getUnacknowledgedAlerts = (alerts: Alert[]) =>
  alerts.filter((a) => !a.acknowledged)

// Sort food presets by usage (most used first)
export const getSortedFoodPresets = (presets: FoodItemPreset[]) =>
  [...presets].sort((a, b) => (b.use_count || 0) - (a.use_count || 0))
