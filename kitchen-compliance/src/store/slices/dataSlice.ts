import type { StateCreator } from 'zustand'
import type { CoolingEvent, Alert, FoodItemPreset } from '@/types'

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

export interface DataSlice {
    // Data loading state
    dataLoaded: {
        staff: boolean
        food: boolean
        fridges: boolean
    }
    setDataLoaded: (key: 'staff' | 'food' | 'fridges', loaded: boolean) => void
    resetDataLoaded: () => void

    // Food presets
    foodPresets: FoodItemPreset[]
    setFoodPresets: (presets: FoodItemPreset[]) => void
    addFoodPreset: (preset: FoodItemPreset) => void
    updateFoodPreset: (id: string, updates: Partial<FoodItemPreset>) => void
    removeFoodPreset: (id: string) => void
    incrementFoodUsage: (id: string) => void

    // Active alerts
    alerts: Alert[]
    addAlert: (alert: Alert) => void
    acknowledgeAlert: (id: string, by?: string) => void
    clearAlerts: () => void

    // Offline queue
    offlineQueue: CoolingEvent[]
    addToOfflineQueue: (event: CoolingEvent) => void
    clearOfflineQueue: () => void
}

export const createDataSlice: StateCreator<DataSlice> = (set) => ({
    // Data loading state
    dataLoaded: { staff: false, food: false, fridges: false },
    setDataLoaded: (key, loaded) => set((state) => ({
        dataLoaded: { ...state.dataLoaded, [key]: loaded }
    })),
    resetDataLoaded: () => set({ dataLoaded: { staff: false, food: false, fridges: false } }),

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
})
