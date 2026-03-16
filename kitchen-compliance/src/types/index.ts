import type { CoolingStatus } from '@/lib/utils'

// Food item presets for quick selection
export interface FoodItemPreset {
  id: string
  site_id?: string // if site-specific
  name: string
  icon: string // emoji or icon name
  category: 'sauce' | 'soup' | 'meat' | 'vegetable' | 'other'
  use_count?: number // for sorting by most used
}

// Staff roles
export type StaffRole = 'manager' | 'chef' | 'staff'

export const STAFF_ROLES: { id: StaffRole; label: string; color: string }[] = [
  { id: 'manager', label: 'Manager', color: 'text-purple-400 bg-purple-500/20' },
  { id: 'chef', label: 'Chef', color: 'text-amber-400 bg-amber-500/20' },
  { id: 'staff', label: 'Staff', color: 'text-sky-400 bg-sky-500/20' },
]

// Staff member for selection
// Staff member for selection
export interface StaffMember {
  id: string
  site_id: string
  name: string
  initials: string | null
  role: StaffRole
  active: boolean | null
  staff_code?: string | null
  pin_hash?: string | null
  email?: string | null
  created_at: string
  updated_at?: string
}

// Cooling session represents an active or completed cooling workflow
export interface CoolingSession {
  id: string
  item_name: string
  item_category: FoodItemPreset['category']
  started_at: string // ISO timestamp
  soft_due_at: string // ISO timestamp (90 min)
  hard_due_at: string // ISO timestamp (120 min)
  closed_at?: string // ISO timestamp
  status: CoolingStatus
  close_action?: 'in_fridge' | 'discarded' | 'exception'
  // Temperature data (FSAI SC3 compliance)
  start_temperature?: number // °C at start of cooling
  end_temperature?: number // °C when moved to fridge (should be <8°C)
  // Staff tracking (aligned with database schema)
  started_by_id?: string // Staff member who started
  staff_name?: string // Staff member name (denormalized)
  closed_by?: string // Staff who closed (name)
  closed_by_id?: string // Staff who closed (ID)
  // Food item reference
  food_item_id?: string // Reference to food_items table
  // Exception handling
  exception_reason?: string
  exception_approved_by?: string
  created_by?: string // device/user identifier
  site_id: string
  synced: boolean // for offline support
}

// Close cooling data for the modal
export interface CloseCoolingData {
  temperature?: number
  staffId?: string
  staffName?: string
  notes?: string
}

// Event for append-only audit log
export interface CoolingEvent {
  id: string
  session_id: string
  event_type: 'started' | 'warning_triggered' | 'overdue_triggered' | 'closed' | 'discarded' | 'exception_added'
  timestamp: string // ISO timestamp
  payload: Record<string, unknown>
  site_id: string
  synced: boolean
}

export type WorkflowKind = 'cooking' | 'cooling' | 'reheating' | 'hot_hold'
export type WorkflowState =
  | 'active'
  | 'awaiting_completion'
  | 'completed'
  | 'needs_action'
  | 'discarded'
  | 'cancelled'

export type HaccpLocationKind = 'kitchen' | 'fridge' | 'hot_hold' | 'service' | 'unknown'
export type HaccpHotHoldSeverity = 'pass' | 'warning' | 'critical'
export type HaccpCorrectiveAction = 'reheat' | 'discard' | 'manual_override'

export interface HaccpBatch {
  id: string
  site_id: string
  item_name: string
  item_category: FoodItemPreset['category']
  source_workflow_id?: string | null
  current_workflow_id?: string | null
  location_kind: HaccpLocationKind
  location_id?: string | null
  location_label?: string | null
  last_temperature?: number | null
  last_recorded_at?: string | null
  created_at: string
  updated_at?: string | null
}

export interface HaccpWorkflow {
  id: string
  batch_id: string
  site_id: string
  workflow_kind: WorkflowKind
  state: WorkflowState
  parent_workflow_id?: string | null
  title: string
  item_name: string
  item_category: FoodItemPreset['category']
  started_at: string
  completed_at?: string | null
  due_at?: string | null
  next_due_at?: string | null
  revalidation_interval_minutes?: number | null
  start_temperature?: number | null
  end_temperature?: number | null
  last_temperature?: number | null
  severity?: HaccpHotHoldSeverity | null
  corrective_action?: HaccpCorrectiveAction | null
  notes?: string | null
  location_kind: HaccpLocationKind
  location_id?: string | null
  location_label?: string | null
  started_by_id?: string | null
  started_by_name?: string | null
  completed_by_id?: string | null
  completed_by_name?: string | null
  created_at: string
  updated_at?: string | null
}

export interface HaccpWorkflowEvent {
  id: string
  workflow_id: string
  batch_id: string
  site_id: string
  event_type:
    | 'workflow_started'
    | 'temperature_logged'
    | 'workflow_completed'
    | 'transition_requested'
    | 'transition_completed'
    | 'reminder_due'
    | 'corrective_action_required'
    | 'corrective_action_taken'
    | 'workflow_cancelled'
  payload: Record<string, unknown>
  created_at: string
}

export interface HaccpReminder {
  id: string
  workflow_id: string
  batch_id: string
  site_id: string
  reminder_type: 'hot_hold_check'
  due_at: string
  delivered_at?: string | null
  acknowledged_at?: string | null
  delivery_state: 'scheduled' | 'due' | 'delivered' | 'acknowledged' | 'cancelled'
  created_at: string
}

// Site/location configuration
export interface Site {
  id: string
  name: string
  address?: string
  kiosk_pin?: string // optional PIN for kiosk mode
  alert_email?: string
  alert_phone?: string
  created_at: string
  updated_at: string
}

// Alert notification
export interface Alert {
  id: string
  session_id: string
  type: 'warning' | 'overdue'
  message: string
  triggered_at: string
  acknowledged: boolean
  acknowledged_at?: string
  acknowledged_by?: string
}

// App state for zustand store
export interface AppState {
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
}

// Voice command types
export type VoiceCommand =
  | { type: 'start_cooling'; item?: string }
  | { type: 'stop_cooling'; sessionId?: string; item?: string }
  | { type: 'start_cooking'; item?: string }
  | { type: 'complete_cooking'; item?: string; temperature?: number }
  | { type: 'start_reheating'; item?: string }
  | { type: 'complete_reheating'; item?: string; temperature?: number }
  | { type: 'start_hot_hold'; item?: string }
  | { type: 'log_hot_hold_check'; temperature?: number; item?: string }
  | { type: 'stop_hot_hold'; item?: string }
  | { type: 'transition_to_cooling'; item?: string; fridge?: string }
  | { type: 'discard'; sessionId?: string }
  | { type: 'log_fridge_temp'; fridgeNumber?: string }
  | { type: 'log_cooking' }
  | { type: 'log_reheating' }
  | { type: 'log_hot_hold' }
  | { type: 'hygiene_inspection' }
  | { type: 'unknown' }
  | { type: 'noise' }

// Export report data
export interface CoolingReport {
  site: Site
  period: {
    from: string
    to: string
  }
  summary: {
    total_sessions: number
    completed_on_time: number
    completed_late: number
    discarded: number
    exceptions: number
  }
  sessions: CoolingSession[]
  events: CoolingEvent[]
  generated_at: string
}

// Default food item presets (template)
export const DEFAULT_FOOD_PRESETS: FoodItemPreset[] = [
  { id: 'bolognese', name: 'Bolognese Sauce', icon: '🍝', category: 'sauce', use_count: 0 },
  { id: 'tomato-sauce', name: 'Tomato Sauce', icon: '🍅', category: 'sauce', use_count: 0 },
  { id: 'bechamel', name: 'Béchamel', icon: '🥛', category: 'sauce', use_count: 0 },
  { id: 'gravy', name: 'Gravy', icon: '🥄', category: 'sauce', use_count: 0 },
  { id: 'curry-sauce', name: 'Curry Sauce', icon: '🍛', category: 'sauce', use_count: 0 },
  { id: 'soup', name: 'Soup', icon: '🍲', category: 'soup', use_count: 0 },
  { id: 'stock', name: 'Stock', icon: '🫕', category: 'soup', use_count: 0 },
  { id: 'stew', name: 'Stew', icon: '🥘', category: 'soup', use_count: 0 },
  { id: 'chili', name: 'Chili', icon: '🌶️', category: 'soup', use_count: 0 },
  { id: 'roast-beef', name: 'Roast Beef', icon: '🥩', category: 'meat', use_count: 0 },
  { id: 'chicken', name: 'Chicken', icon: '🍗', category: 'meat', use_count: 0 },
  { id: 'pulled-pork', name: 'Pulled Pork', icon: '🐖', category: 'meat', use_count: 0 },
  { id: 'lamb', name: 'Lamb', icon: '🐑', category: 'meat', use_count: 0 },
  { id: 'vegetables', name: 'Cooked Vegetables', icon: '🥗', category: 'vegetable', use_count: 0 },
  { id: 'rice', name: 'Rice', icon: '🍚', category: 'other', use_count: 0 },
  { id: 'pasta', name: 'Pasta', icon: '🍜', category: 'other', use_count: 0 },
  { id: 'other', name: 'Other', icon: '📦', category: 'other', use_count: 0 },
]

// Re-export for backwards compatibility
export const FOOD_ITEM_PRESETS = DEFAULT_FOOD_PRESETS
