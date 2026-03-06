// Centralized helpers for clearing *app* state without nuking Supabase Auth
// or other site-wide localStorage keys.

const APP_STORAGE_KEYS = [
  // zustand persist key
  'kitchen-compliance-storage',
]

export function clearKitchenComplianceAppStorage() {
  for (const key of APP_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}

