import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// Types
export interface Fridge {
  id: string
  site_id: string
  name: string
  sort_order: number
  min_temp: number
  max_temp: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface FridgeTempLog {
  id: string
  site_id: string
  fridge_id: string
  temperature: number
  recorded_by: string | null
  recorded_by_name: string | null
  notes: string | null
  is_compliant: boolean
  created_at: string
}

export interface CreateFridgeTempLog {
  site_id: string
  fridge_id: string
  temperature: number
  recorded_by?: string
  recorded_by_name?: string
  notes?: string
}

// Fridge limits by subscription tier
export const FRIDGE_LIMITS = {
  basic: 1,
  pro: 2,
  enterprise: Infinity,
} as const

// Get all fridges for a site
export async function getFridges(siteId: string): Promise<Fridge[]> {
  if (!isSupabaseConfigured()) {
    // Return demo fridge for offline/demo mode
    return [{
      id: 'demo-fridge-1',
      site_id: siteId,
      name: 'Main Fridge',
      sort_order: 0,
      min_temp: 0,
      max_temp: 5,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]
  }

  const { data, error } = await (supabase
    .from('fridges') as any)
    .select('*')
    .eq('site_id', siteId)
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data || []
}

// Create a new fridge
export async function createFridge(siteId: string, name: string): Promise<Fridge> {
  if (!isSupabaseConfigured()) {
    throw new Error('Database not configured')
  }

  // Get current count to set sort_order
  const { data: existing } = await (supabase
    .from('fridges') as any)
    .select('id')
    .eq('site_id', siteId)
    .eq('active', true)

  const sortOrder = existing?.length || 0

  const { data, error } = await (supabase
    .from('fridges') as any)
    .insert({
      site_id: siteId,
      name: name,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Update fridge name
export async function updateFridge(fridgeId: string, updates: { name?: string }): Promise<Fridge> {
  if (!isSupabaseConfigured()) {
    throw new Error('Database not configured')
  }

  const { data, error } = await (supabase
    .from('fridges') as any)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fridgeId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Soft delete fridge (deactivate)
export async function deleteFridge(fridgeId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Database not configured')
  }

  const { error } = await (supabase
    .from('fridges') as any)
    .update({ active: false })
    .eq('id', fridgeId)

  if (error) throw error
}

// Log a temperature reading
export async function logFridgeTemp(log: CreateFridgeTempLog): Promise<FridgeTempLog> {
  if (!isSupabaseConfigured()) {
    // Demo mode - return mock log
    return {
      id: `demo-log-${Date.now()}`,
      site_id: log.site_id,
      fridge_id: log.fridge_id,
      temperature: log.temperature,
      recorded_by: log.recorded_by || null,
      recorded_by_name: log.recorded_by_name || null,
      notes: log.notes || null,
      is_compliant: log.temperature >= 0 && log.temperature <= 5,
      created_at: new Date().toISOString(),
    }
  }

  const { data, error } = await (supabase
    .from('fridge_temp_logs') as any)
    .insert(log)
    .select()
    .single()

  if (error) throw error
  return data
}

// Get temperature logs for a site (with optional filters)
export async function getFridgeTempLogs(
  siteId: string,
  options?: {
    fridgeId?: string
    startDate?: string
    endDate?: string
    limit?: number
  }
): Promise<FridgeTempLog[]> {
  if (!isSupabaseConfigured()) {
    return []
  }

  let query = (supabase
    .from('fridge_temp_logs') as any)
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  if (options?.fridgeId) {
    query = query.eq('fridge_id', options.fridgeId)
  }

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate)
  }

  if (options?.endDate) {
    query = query.lte('created_at', options.endDate)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

// Get today's logs for a fridge
export async function getTodaysFridgeLogs(siteId: string, fridgeId: string): Promise<FridgeTempLog[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return getFridgeTempLogs(siteId, {
    fridgeId,
    startDate: today.toISOString(),
  })
}

// Check if fridge has been logged today
export async function hasFridgeBeenLoggedToday(siteId: string, fridgeId: string): Promise<boolean> {
  const logs = await getTodaysFridgeLogs(siteId, fridgeId)
  return logs.length > 0
}

// Get last temperature for a fridge
export async function getLastFridgeTemp(siteId: string, fridgeId: string): Promise<FridgeTempLog | null> {
  const logs = await getFridgeTempLogs(siteId, { fridgeId, limit: 1 })
  return logs[0] || null
}
