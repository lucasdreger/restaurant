import { v4 as uuidv4 } from 'uuid'
import { useAppStore } from '@/store/useAppStore'
import type { CoolingSession, CoolingEvent, FoodItemPreset, Alert, CloseCoolingData } from '@/types'
import type { Json } from '@/types/database.types'
import { COOLING_POLICY, getCoolingStatus, type CoolingStatus } from '@/lib/utils'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { COOLING_KEYS, useCoolingSessions } from '@/hooks/queries/useCooling'

const mapCoolingSessionRow = (row: any): CoolingSession => ({
  id: row.id,
  item_name: row.item_name,
  item_category: row.item_category as FoodItemPreset['category'],
  started_at: row.started_at,
  soft_due_at: row.soft_due_at,
  hard_due_at: row.hard_due_at,
  closed_at: row.closed_at || undefined,
  status: row.status as CoolingStatus,
  close_action: row.close_action as CoolingSession['close_action'],
  // Temperature data
  start_temperature: row.start_temperature ?? undefined,
  end_temperature: row.end_temperature ?? undefined,
  // Staff tracking (aligned with database schema)
  started_by_id: row.started_by_id || undefined,
  staff_name: row.staff_name || undefined,
  closed_by: row.closed_by || undefined,
  closed_by_id: row.closed_by_id || undefined,
  // Food item reference
  food_item_id: row.food_item_id || undefined,
  // Exception handling
  exception_reason: row.exception_reason || undefined,
  exception_approved_by: row.exception_approved_by || undefined,
  created_by: row.created_by || undefined,
  site_id: row.site_id,
  synced: true,
})

// Create a new cooling session
export function createCoolingSession(
  itemName: string,
  itemCategory: FoodItemPreset['category'],
  siteId: string,
  createdBy?: string
): CoolingSession {
  const now = new Date()
  const softDue = new Date(now.getTime() + COOLING_POLICY.SOFT_LIMIT_MINUTES * 60 * 1000)
  const hardDue = new Date(now.getTime() + COOLING_POLICY.HARD_LIMIT_MINUTES * 60 * 1000)

  const session: CoolingSession = {
    id: uuidv4(),
    item_name: itemName,
    item_category: itemCategory,
    started_at: now.toISOString(),
    soft_due_at: softDue.toISOString(),
    hard_due_at: hardDue.toISOString(),
    status: 'active',
    site_id: siteId,
    created_by: createdBy,
    synced: false,
  }

  return session
}

// Create a cooling event for the audit log
export function createCoolingEvent(
  sessionId: string,
  siteId: string,
  eventType: CoolingEvent['event_type'],
  payload: Record<string, unknown> = {}
): CoolingEvent {
  return {
    id: uuidv4(),
    session_id: sessionId,
    site_id: siteId,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    payload,
    synced: false,
  }
}

// Create an alert
export function createAlert(
  sessionId: string,
  type: Alert['type'],
  itemName: string
): Alert {
  const message =
    type === 'warning'
      ? `⚠️ ${itemName} cooling for 90 minutes - check soon!`
      : `🚨 ${itemName} OVERDUE - action required NOW!`

  return {
    id: uuidv4(),
    session_id: sessionId,
    type,
    message,
    triggered_at: new Date().toISOString(),
    acknowledged: false,
  }
}

// Sync session to Supabase
export async function syncSessionToSupabase(session: CoolingSession): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, skipping sync')
    return false
  }

  try {
    const { error } = await (supabase.from('cooling_sessions') as any).upsert({
      id: session.id,
      site_id: session.site_id,
      item_name: session.item_name,
      item_category: session.item_category,
      started_at: session.started_at,
      soft_due_at: session.soft_due_at,
      hard_due_at: session.hard_due_at,
      closed_at: session.closed_at,
      status: session.status,
      close_action: session.close_action,
      // Temperature data (FSAI SC3 compliance)
      start_temperature: session.start_temperature,
      end_temperature: session.end_temperature,
      // Staff tracking (aligned with database schema)
      started_by_id: session.started_by_id,
      staff_name: session.staff_name,
      closed_by: session.closed_by,
      closed_by_id: session.closed_by_id,
      // Food item reference
      food_item_id: session.food_item_id,
      // Exception handling
      exception_reason: session.exception_reason,
      exception_approved_by: session.exception_approved_by,
      created_by: session.created_by,
    })

    if (error) throw error
    return true
  } catch (err) {
    console.error('Failed to sync session to Supabase:', err)
    return false
  }
}

// Sync event to Supabase
export async function syncEventToSupabase(event: CoolingEvent): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, skipping sync')
    return false
  }

  try {
    const { error } = await (supabase.from('cooling_events') as any).insert({
      id: event.id,
      session_id: event.session_id,
      site_id: event.site_id,
      event_type: event.event_type,
      timestamp: event.timestamp,
      payload: event.payload as Json,
    })

    if (error) throw error
    return true
  } catch (err) {
    console.error('Failed to sync event to Supabase:', err)
    return false
  }
}

// Delete session from Supabase
export async function syncDeleteToSupabase(sessionId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, skipping sync')
    return false
  }

  try {
    console.log(`🗑️ Attempting to delete session ${sessionId} from Supabase...`)
    const { error } = await (supabase.from('cooling_sessions') as any)
      .delete()
      .eq('id', sessionId)

    if (error) {
      console.error('❌ Failed to delete session from Supabase (RLS?):', error)
      throw error
    }

    console.log(`✅ Session ${sessionId} deleted from Supabase permanently.`)
    return true
  } catch (err) {
    console.error('❌ Sync delete error:', err)
    return false
  }
}

// Fetch active sessions from Supabase
export async function fetchActiveSessions(siteId: string): Promise<CoolingSession[]> {
  if (!isSupabaseConfigured()) {
    return []
  }

  try {
    const { data: rawData, error } = await (supabase
      .from('cooling_sessions') as any)
      .select('*')
      .eq('site_id', siteId)
      .in('status', ['active', 'warning', 'overdue'])
      .order('started_at', { ascending: false })

    if (error) throw error

    const data: any[] = rawData || []

    return data.map(mapCoolingSessionRow)
  } catch (err) {
    console.error('Failed to fetch sessions from Supabase:', err)
    return []
  }
}

// Fetch all sessions for a site (active + closed)
export async function fetchCoolingSessions(siteId: string): Promise<CoolingSession[]> {
  if (!isSupabaseConfigured()) {
    return []
  }

  try {
    const { data: rawData, error } = await (supabase
      .from('cooling_sessions') as any)
      .select('*')
      .eq('site_id', siteId)
      .order('started_at', { ascending: false })

    if (error) throw error

    const data: any[] = rawData || []
    return data.map(mapCoolingSessionRow)
  } catch (err) {
    console.error('Failed to fetch all sessions from Supabase:', err)
    return []
  }
}

// Cooling workflow hook
export function useCoolingWorkflow() {
  const queryClient = useQueryClient()
  const {
    addAlert,
    addToOfflineQueue,
    currentSite,
    isOnline,
  } = useAppStore()

  // Use React Query for session data
  const { data: coolingSessions = [] } = useCoolingSessions(currentSite?.id)

  // Start a new cooling session
  const startCooling = async (
    itemName: string,
    itemCategory: FoodItemPreset['category'] = 'other'
  ) => {
    if (!currentSite) {
      console.error('No site selected')
      return null
    }

    const session = createCoolingSession(
      itemName,
      itemCategory,
      currentSite.id
    )

    // Optimistic update
    queryClient.setQueryData(COOLING_KEYS.active(currentSite.id), (old: CoolingSession[] = []) => [session, ...old])

    // Create start event
    const event = createCoolingEvent(session.id, currentSite.id, 'started', {
      item_name: itemName,
      item_category: itemCategory,
    })

    // Sync to Supabase if online (sync in demo mode too since demo site is in database)
    if (isOnline) {
      const synced = await syncSessionToSupabase(session)
      if (synced) {
        // No need to update 'synced' prop locally if we invalidate, but for immediate consistency:
        // We could update the cache item to set synced=true, but invalidation is safer.
        await syncEventToSupabase(event)
        queryClient.invalidateQueries({ queryKey: COOLING_KEYS.active(currentSite.id) })
      }
    } else {
      // Queue for later sync when offline
      addToOfflineQueue(event)
    }

    return session
  }

  // Close a cooling session (item moved to fridge)
  const closeCooling = async (sessionId: string, closeData?: CloseCoolingData) => {
    const session = coolingSessions.find((s) => s.id === sessionId)
    if (!session || !currentSite) return false

    const closedAt = new Date().toISOString()
    const status = getCoolingStatus(new Date(session.started_at))
    const finalStatus = status === 'overdue' ? 'overdue' : 'closed'
    const elapsedMinutes = Math.floor(
      (Date.now() - new Date(session.started_at).getTime()) / (1000 * 60)
    )

    const updates: Partial<CoolingSession> = {
      closed_at: closedAt,
      status: finalStatus,
      close_action: 'in_fridge',
      end_temperature: closeData?.temperature,
      closed_by_id: closeData?.staffId,
      closed_by: closeData?.staffName,
    }

    // Optimistic update
    queryClient.setQueryData(COOLING_KEYS.active(currentSite.id), (old: CoolingSession[] = []) =>
      old.map(s => s.id === sessionId ? { ...s, ...updates } : s)
    )

    // Create close event with temperature and staff data
    const event = createCoolingEvent(sessionId, currentSite.id, 'closed', {
      close_action: 'in_fridge',
      was_overdue: status === 'overdue',
      elapsed_minutes: elapsedMinutes,
      end_temperature: closeData?.temperature,
      closed_by: closeData?.staffName,
      temperature_compliant: closeData?.temperature !== undefined ? closeData.temperature < 8 : undefined,
    })

    // Sync to Supabase if online (sync in demo mode too)
    if (isOnline) {
      const synced = await syncSessionToSupabase({ ...session, ...updates })
      if (synced) {
        await syncEventToSupabase(event)
        queryClient.invalidateQueries({ queryKey: COOLING_KEYS.active(currentSite.id) })
      }
    } else {
      addToOfflineQueue(event)
    }

    return true
  }

  // Discard a cooling session (food thrown away)
  const discardCooling = async (sessionId: string, reason?: string) => {
    const session = coolingSessions.find((s) => s.id === sessionId)
    if (!session || !currentSite) return false

    const closedAt = new Date().toISOString()

    const updates: Partial<CoolingSession> = {
      closed_at: closedAt,
      status: 'discarded',
      close_action: 'discarded',
      exception_reason: reason,
    }

    // Optimistic update
    queryClient.setQueryData(COOLING_KEYS.active(currentSite.id), (old: CoolingSession[] = []) =>
      old.map(s => s.id === sessionId ? { ...s, ...updates } : s)
    )

    // Create discard event
    const event = createCoolingEvent(sessionId, currentSite.id, 'discarded', {
      reason,
      elapsed_minutes: Math.floor(
        (Date.now() - new Date(session.started_at).getTime()) / (1000 * 60)
      ),
    })

    // Sync to Supabase if online (sync in demo mode too)
    if (isOnline) {
      const synced = await syncSessionToSupabase({ ...session, ...updates })
      if (synced) {
        await syncEventToSupabase(event)
        queryClient.invalidateQueries({ queryKey: COOLING_KEYS.active(currentSite.id) })
      }
    } else {
      addToOfflineQueue(event)
    }

    return true
  }

  // Add exception to overdue session (manager-only)
  const addException = async (
    sessionId: string,
    reason: string,
    approvedBy: string
  ) => {
    const session = coolingSessions.find((s) => s.id === sessionId)
    if (!session || !currentSite) return false

    const closedAt = new Date().toISOString()

    const updates: Partial<CoolingSession> = {
      closed_at: closedAt,
      status: 'closed',
      close_action: 'exception',
      exception_reason: reason,
      exception_approved_by: approvedBy,
    }

    // Optimistic update
    queryClient.setQueryData(COOLING_KEYS.active(currentSite.id), (old: CoolingSession[] = []) =>
      old.map(s => s.id === sessionId ? { ...s, ...updates } : s)
    )

    // Create exception event
    const event = createCoolingEvent(sessionId, currentSite.id, 'exception_added', {
      reason,
      approved_by: approvedBy,
      elapsed_minutes: Math.floor(
        (Date.now() - new Date(session.started_at).getTime()) / (1000 * 60)
      ),
    })

    // Sync to Supabase if online
    if (isOnline) {
      const synced = await syncSessionToSupabase({ ...session, ...updates })
      if (synced) {
        await syncEventToSupabase(event)
        // No explicit invalidation needed here if optimistic update is enough, but safest to invalidate
        queryClient.invalidateQueries({ queryKey: COOLING_KEYS.active(currentSite.id) })
      }
    } else {
      addToOfflineQueue(event)
    }

    return true
  }

  // Check and update session statuses (called periodically)
  const updateSessionStatuses = () => {
    // With React Query, we can update the cache directly or force a refetch.
    // Since calculating status is cheap and doesn't change data on server unless we save it,
    // we should just check and trigger alerts here.
    // If status changes (e.g. warning -> overdue), we assume the UI calculates it on render,
    // but if we need to SAVE the status change to DB, we should do it.
    // However, status is usually derived from timestamps.
    // The previous logic saved status updates to local store.
    // Let's just update alerts here. Status saving is implicit/not strictly needed if derived from time.
    // BUT the previous implementation DID save it.
    // For now, let's just emit alerts. React Query data is "truth".
    // If we want to persist status changes to DB, we'd need a mutation.

    coolingSessions.forEach((session) => {
      if (session.closed_at) return // Skip closed sessions

      const currentStatus = getCoolingStatus(new Date(session.started_at))

      if (currentStatus !== session.status) {
        // Status changed.
        // If we want to persist this status change:
        // updateCoolingSession(session.id, { status: currentStatus }) -> converted to DB update?
        // Actually, status in DB is useful for querying. Use specific update fn?
        // Since this runs every 10s, we don't want to spam DB.
        // Maybe only locally update the cache?

        // Optimistic update of status in cache only
        queryClient.setQueryData(COOLING_KEYS.active(currentSite?.id), (old: CoolingSession[] = []) =>
          old.map(s => s.id === session.id ? { ...s, status: currentStatus } : s)
        )

        // Create alert for status changes
        if (currentStatus === 'warning' && session.status === 'active') {
          addAlert(createAlert(session.id, 'warning', session.item_name))
        } else if (currentStatus === 'overdue' && session.status !== 'overdue') {
          addAlert(createAlert(session.id, 'overdue', session.item_name))
        }
      }
    })
  }

  // Delete a cooling session
  const deleteCooling = async (sessionId: string) => {
    const session = coolingSessions.find((s) => s.id === sessionId)
    if (!session || !currentSite) return false

    // Optimistic delete
    queryClient.setQueryData(COOLING_KEYS.active(currentSite.id), (old: CoolingSession[] = []) =>
      old.filter(s => s.id !== sessionId)
    )

    // Sync to Supabase if online
    if (isOnline) {
      await syncDeleteToSupabase(sessionId)
      queryClient.invalidateQueries({ queryKey: COOLING_KEYS.active(currentSite.id) })
    }

    return true
  }

  return {
    startCooling,
    closeCooling,
    discardCooling,
    deleteCooling,
    addException,
    updateSessionStatuses,
    coolingSessions,
  }
}
