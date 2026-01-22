import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CoolingSession, CoolingEvent, Alert, Site, StaffMember, FoodItemPreset } from '@/types'

// Theme type
export type AppTheme = 'day' | 'night'

// Audio models available through OpenRouter
export type AudioModel = 
  | 'openai/gpt-4o-audio-preview'     // $40/M audio tokens - highest quality
  | 'openai/gpt-audio'                 // $32/M audio tokens
  | 'openai/gpt-audio-mini'            // $0.60/M audio tokens - cost efficient!

// Available wake word options
export const WAKE_WORD_OPTIONS = [
  { id: 'luma', label: 'Luma', phrases: ['luma', 'hey luma', 'hi luma', 'ok luma', 'okay luma'] },
  { id: 'chef', label: 'Chef', phrases: ['chef', 'hey chef', 'hi chef', 'ok chef', 'okay chef'] },
  { id: 'kitchen', label: 'Kitchen', phrases: ['kitchen', 'hey kitchen', 'hi kitchen', 'ok kitchen'] },
  { id: 'assistant', label: 'Assistant', phrases: ['assistant', 'hey assistant', 'hi assistant'] },
] as const

export type WakeWordId = typeof WAKE_WORD_OPTIONS[number]['id']

// Settings interface
interface AppSettings {
  restaurantName: string // Editable restaurant/venue name
  openaiApiKey: string | null
  openrouterApiKey: string | null
  voiceProvider: 'browser' | 'openai' | 'openrouter'
  audioModel: AudioModel // Model to use for OpenRouter voice
  apiProvider: 'openai' | 'openrouter' // For text/chat APIs (future use)
  language: string
  theme: AppTheme
  subscriptionTier: 'basic' | 'pro' | 'enterprise'
  ttsEnabled: boolean
  wakeWordEnabled: boolean // Always-listening mode
  activeWakeWords: WakeWordId[] // Which wake words are enabled
}

const defaultSettings: AppSettings = {
  restaurantName: 'Casa Rendezvous', // Default restaurant name
  openaiApiKey: null,
  openrouterApiKey: null,
  voiceProvider: 'browser',
  audioModel: 'openai/gpt-audio-mini', // Default to cost-efficient model
  apiProvider: 'openai',
  language: 'en',
  theme: 'day',
  subscriptionTier: 'pro',
  ttsEnabled: true,
  wakeWordEnabled: false, // Disabled by default - user must enable
  activeWakeWords: ['luma'], // Default to "Luma" wake word
}

// App state interface
interface AppState {
  // Current site
  currentSite: Site | null
  setCurrentSite: (site: Site | null) => void

  // Staff members
  staffMembers: StaffMember[]
  setStaffMembers: (members: StaffMember[]) => void
  addStaffMember: (member: StaffMember) => void
  updateStaffMember: (id: string, updates: Partial<StaffMember>) => void
  removeStaffMember: (id: string) => void

  // Food presets
  foodPresets: FoodItemPreset[]
  setFoodPresets: (presets: FoodItemPreset[]) => void
  addFoodPreset: (preset: FoodItemPreset) => void
  updateFoodPreset: (id: string, updates: Partial<FoodItemPreset>) => void
  removeFoodPreset: (id: string) => void
  incrementFoodUsage: (id: string) => void

  // Cooling sessions
  coolingSessions: CoolingSession[]
  addCoolingSession: (session: CoolingSession) => void
  updateCoolingSession: (id: string, updates: Partial<CoolingSession>) => void
  removeCoolingSession: (id: string) => void
  setCoolingSessions: (sessions: CoolingSession[]) => void

  // Active alerts
  alerts: Alert[]
  addAlert: (alert: Alert) => void
  acknowledgeAlert: (id: string, by?: string) => void
  clearAlerts: () => void

  // Offline queue
  offlineQueue: CoolingEvent[]
  addToOfflineQueue: (event: CoolingEvent) => void
  clearOfflineQueue: () => void

  // Connection status
  isOnline: boolean
  setIsOnline: (online: boolean) => void

  // Voice state
  isListening: boolean
  setIsListening: (listening: boolean) => void

  // UI state
  kioskMode: boolean
  setKioskMode: (kiosk: boolean) => void

  // Settings
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => void
}

// Default food presets
const defaultFoodPresets: FoodItemPreset[] = [
  { id: 'bolognese', name: 'Bolognese Sauce', icon: '🍝', category: 'sauce', use_count: 0 },
  { id: 'tomato-sauce', name: 'Tomato Sauce', icon: '🍅', category: 'sauce', use_count: 0 },
  { id: 'bechamel', name: 'Béchamel', icon: '🥛', category: 'sauce', use_count: 0 },
  { id: 'gravy', name: 'Gravy', icon: '🥄', category: 'sauce', use_count: 0 },
  { id: 'curry-sauce', name: 'Curry Sauce', icon: '🍛', category: 'sauce', use_count: 0 },
  { id: 'soup', name: 'Soup', icon: '🍲', category: 'soup', use_count: 0 },
  { id: 'stock', name: 'Stock', icon: '🫕', category: 'soup', use_count: 0 },
  { id: 'stew', name: 'Stew', icon: '🥘', category: 'soup', use_count: 0 },
  { id: 'roast-beef', name: 'Roast Beef', icon: '🥩', category: 'meat', use_count: 0 },
  { id: 'chicken', name: 'Chicken', icon: '🍗', category: 'meat', use_count: 0 },
  { id: 'pulled-pork', name: 'Pulled Pork', icon: '🐖', category: 'meat', use_count: 0 },
  { id: 'vegetables', name: 'Cooked Vegetables', icon: '🥗', category: 'vegetable', use_count: 0 },
  { id: 'rice', name: 'Rice', icon: '🍚', category: 'other', use_count: 0 },
  { id: 'pasta', name: 'Pasta', icon: '🍜', category: 'other', use_count: 0 },
]

// Create the store with persistence
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Current site
      currentSite: null,
      setCurrentSite: (site) => set({ currentSite: site }),

      // Staff members
      staffMembers: [],
      setStaffMembers: (members) => set({ staffMembers: members }),
      addStaffMember: (member) =>
        set((state) => ({
          staffMembers: [...state.staffMembers, member],
        })),
      updateStaffMember: (id, updates) =>
        set((state) => ({
          staffMembers: state.staffMembers.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),
      removeStaffMember: (id) =>
        set((state) => ({
          staffMembers: state.staffMembers.filter((m) => m.id !== id),
        })),

      // Food presets
      foodPresets: defaultFoodPresets,
      setFoodPresets: (presets) => set({ foodPresets: presets }),
      addFoodPreset: (preset) =>
        set((state) => ({
          foodPresets: [...state.foodPresets, preset],
        })),
      updateFoodPreset: (id, updates) =>
        set((state) => ({
          foodPresets: state.foodPresets.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      removeFoodPreset: (id) =>
        set((state) => ({
          foodPresets: state.foodPresets.filter((p) => p.id !== id),
        })),
      incrementFoodUsage: (id) =>
        set((state) => ({
          foodPresets: state.foodPresets.map((p) =>
            p.id === id ? { ...p, use_count: (p.use_count || 0) + 1 } : p
          ),
        })),

      // Cooling sessions
      coolingSessions: [],
      addCoolingSession: (session) =>
        set((state) => ({
          coolingSessions: [session, ...state.coolingSessions],
        })),
      updateCoolingSession: (id, updates) =>
        set((state) => ({
          coolingSessions: state.coolingSessions.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),
      removeCoolingSession: (id) =>
        set((state) => ({
          coolingSessions: state.coolingSessions.filter((s) => s.id !== id),
        })),
      setCoolingSessions: (sessions) => set({ coolingSessions: sessions }),

      // Active alerts
      alerts: [],
      addAlert: (alert) =>
        set((state) => ({
          alerts: [alert, ...state.alerts],
        })),
      acknowledgeAlert: (id, by) =>
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id
              ? {
                  ...a,
                  acknowledged: true,
                  acknowledged_at: new Date().toISOString(),
                  acknowledged_by: by,
                }
              : a
          ),
        })),
      clearAlerts: () => set({ alerts: [] }),

      // Offline queue
      offlineQueue: [],
      addToOfflineQueue: (event) =>
        set((state) => ({
          offlineQueue: [...state.offlineQueue, event],
        })),
      clearOfflineQueue: () => set({ offlineQueue: [] }),

      // Connection status
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      setIsOnline: (online) => set({ isOnline: online }),

      // Voice state
      isListening: false,
      setIsListening: (listening) => set({ isListening: listening }),

      // UI state
      kioskMode: true,
      setKioskMode: (kiosk) => set({ kioskMode: kiosk }),

      // Settings
      settings: defaultSettings,
      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),
    }),
    {
      name: 'kitchen-compliance-storage',
      partialize: (state) => ({
        currentSite: state.currentSite,
        staffMembers: state.staffMembers,
        foodPresets: state.foodPresets,
        coolingSessions: state.coolingSessions,
        offlineQueue: state.offlineQueue,
        kioskMode: state.kioskMode,
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
