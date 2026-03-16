import { v4 as uuidv4 } from 'uuid'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  HACCP_REMINDERS,
  HACCP_TEMPERATURES,
  addMinutesIso,
  getHotHoldSeverity,
  getWorkflowStateFromTemperature,
  isWorkflowTemperatureCompliant,
} from '@/lib/haccp'
import type {
  FoodItemPreset,
  HaccpBatch,
  HaccpCorrectiveAction,
  HaccpLocationKind,
  HaccpReminder,
  HaccpWorkflow,
  HaccpWorkflowEvent,
  WorkflowKind,
  WorkflowState,
} from '@/types'
import type {
  HaccpBatchInsert,
  HaccpBatchUpdate,
  HaccpReminderInsert,
  HaccpWorkflowEventInsert,
  HaccpWorkflowInsert,
  HaccpWorkflowUpdate,
  PushSubscriptionInsert,
} from '@/types/database.types'

export interface HaccpLifecycle {
  batch: HaccpBatch
  workflows: HaccpWorkflow[]
  events: HaccpWorkflowEvent[]
}

export interface HaccpWorkflowActor {
  id?: string | null
  name?: string | null
}

export interface StartWorkflowInput {
  siteId: string
  itemName: string
  itemCategory?: FoodItemPreset['category']
  batchId?: string | null
  parentWorkflowId?: string | null
  startedBy?: HaccpWorkflowActor
  initialTemperature?: number | null
  notes?: string | null
  locationKind?: HaccpLocationKind
  locationId?: string | null
  locationLabel?: string | null
}

export interface CompleteWorkflowInput {
  workflowId: string
  temperature?: number | null
  completedBy?: HaccpWorkflowActor
  notes?: string | null
}

export interface CompleteCoolingInput extends CompleteWorkflowInput {
  locationKind?: HaccpLocationKind
  locationId?: string | null
  locationLabel?: string | null
}

export interface LogHotHoldCheckInput {
  workflowId: string
  temperature: number
  actor?: HaccpWorkflowActor
  correctiveAction?: HaccpCorrectiveAction | null
  notes?: string | null
}

export interface RegisterPushSubscriptionInput {
  siteId: string
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string | null
}

const ACTIVE_WORKFLOW_STATES: WorkflowState[] = ['active', 'awaiting_completion', 'needs_action']
const COOLING_COMPLETION_TEMPERATURE_C = 8

function asCategory(value: unknown): FoodItemPreset['category'] {
  if (value === 'sauce' || value === 'soup' || value === 'meat' || value === 'vegetable') {
    return value
  }

  return 'other'
}

function asLocationKind(value: unknown): HaccpLocationKind {
  if (value === 'kitchen' || value === 'fridge' || value === 'hot_hold' || value === 'service') {
    return value
  }

  return 'unknown'
}

function mapBatch(row: Record<string, any>): HaccpBatch {
  return {
    id: row.id,
    site_id: row.site_id,
    item_name: row.item_name,
    item_category: asCategory(row.item_category),
    source_workflow_id: row.source_workflow_id ?? null,
    current_workflow_id: row.current_workflow_id ?? null,
    location_kind: asLocationKind(row.location_kind),
    location_id: row.location_id ?? null,
    location_label: row.location_label ?? null,
    last_temperature: row.last_temperature ?? null,
    last_recorded_at: row.last_recorded_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
  }
}

function mapWorkflow(row: Record<string, any>): HaccpWorkflow {
  return {
    id: row.id,
    batch_id: row.batch_id,
    site_id: row.site_id,
    workflow_kind: row.workflow_kind,
    state: row.state,
    parent_workflow_id: row.parent_workflow_id ?? null,
    title: row.title,
    item_name: row.item_name,
    item_category: asCategory(row.item_category),
    started_at: row.started_at,
    completed_at: row.completed_at ?? null,
    due_at: row.due_at ?? null,
    next_due_at: row.next_due_at ?? null,
    revalidation_interval_minutes: row.revalidation_interval_minutes ?? null,
    start_temperature: row.start_temperature ?? null,
    end_temperature: row.end_temperature ?? null,
    last_temperature: row.last_temperature ?? null,
    severity: row.severity ?? null,
    corrective_action: row.corrective_action ?? null,
    notes: row.notes ?? null,
    location_kind: asLocationKind(row.location_kind),
    location_id: row.location_id ?? null,
    location_label: row.location_label ?? null,
    started_by_id: row.started_by_id ?? null,
    started_by_name: row.started_by_name ?? null,
    completed_by_id: row.completed_by_id ?? null,
    completed_by_name: row.completed_by_name ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
  }
}

function mapEvent(row: Record<string, any>): HaccpWorkflowEvent {
  return {
    id: row.id,
    workflow_id: row.workflow_id,
    batch_id: row.batch_id,
    site_id: row.site_id,
    event_type: row.event_type,
    payload: row.payload ?? {},
    created_at: row.created_at,
  }
}

function mapReminder(row: Record<string, any>): HaccpReminder {
  return {
    id: row.id,
    workflow_id: row.workflow_id,
    batch_id: row.batch_id,
    site_id: row.site_id,
    reminder_type: row.reminder_type,
    due_at: row.due_at,
    delivered_at: row.delivered_at ?? null,
    acknowledged_at: row.acknowledged_at ?? null,
    delivery_state: row.delivery_state,
    created_at: row.created_at,
  }
}

function ensureSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured')
  }
}

function buildWorkflowTitle(itemName: string, workflowKind: WorkflowKind) {
  const suffix = workflowKind === 'hot_hold' ? 'hot hold' : workflowKind
  return `${itemName} ${suffix}`
}

function batchLocationForWorkflow(workflowKind: WorkflowKind, locationKind?: HaccpLocationKind): HaccpLocationKind {
  if (locationKind) return locationKind

  if (workflowKind === 'cooling' || workflowKind === 'cooking' || workflowKind === 'reheating') {
    return 'kitchen'
  }

  if (workflowKind === 'hot_hold') {
    return 'hot_hold'
  }

  return 'unknown'
}

async function insertBatch(values: HaccpBatchInsert) {
  ensureSupabase()
  const { data, error } = await (supabase.from('haccp_batches') as any)
    .insert(values)
    .select('*')
    .single()

  if (error) throw error
  return mapBatch(data)
}

async function updateBatch(batchId: string, values: HaccpBatchUpdate) {
  ensureSupabase()
  const { data, error } = await (supabase.from('haccp_batches') as any)
    .update(values)
    .eq('id', batchId)
    .select('*')
    .single()

  if (error) throw error
  return mapBatch(data)
}

async function insertWorkflow(values: HaccpWorkflowInsert) {
  ensureSupabase()
  const { data, error } = await (supabase.from('haccp_workflows') as any)
    .insert(values)
    .select('*')
    .single()

  if (error) throw error
  return mapWorkflow(data)
}

async function updateWorkflow(workflowId: string, values: HaccpWorkflowUpdate) {
  ensureSupabase()
  const { data, error } = await (supabase.from('haccp_workflows') as any)
    .update(values)
    .eq('id', workflowId)
    .select('*')
    .single()

  if (error) throw error
  return mapWorkflow(data)
}

async function insertWorkflowEvent(values: HaccpWorkflowEventInsert) {
  ensureSupabase()
  const { data, error } = await (supabase.from('haccp_workflow_events') as any)
    .insert(values)
    .select('*')
    .single()

  if (error) throw error
  return mapEvent(data)
}

async function fetchBatch(batchId: string) {
  ensureSupabase()
  const { data, error } = await (supabase.from('haccp_batches') as any)
    .select('*')
    .eq('id', batchId)
    .single()

  if (error) throw error
  return mapBatch(data)
}

export async function fetchWorkflowById(workflowId: string) {
  ensureSupabase()
  const { data, error } = await (supabase.from('haccp_workflows') as any)
    .select('*')
    .eq('id', workflowId)
    .single()

  if (error) throw error
  return mapWorkflow(data)
}

export async function fetchHaccpWorkflows(siteId: string, states: WorkflowState[] = ACTIVE_WORKFLOW_STATES) {
  ensureSupabase()
  const { data, error } = await (supabase.from('haccp_workflows') as any)
    .select('*')
    .eq('site_id', siteId)
    .in('state', states)
    .order('started_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapWorkflow)
}

export async function fetchHaccpReminders(siteId: string) {
  ensureSupabase()
  const { data, error } = await (supabase.from('haccp_reminders') as any)
    .select('*')
    .eq('site_id', siteId)
    .in('delivery_state', ['scheduled', 'due', 'delivered'])
    .order('due_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapReminder)
}

export async function fetchHaccpLifecycles(siteId: string): Promise<HaccpLifecycle[]> {
  ensureSupabase()

  const [{ data: batches, error: batchError }, { data: workflows, error: workflowError }, { data: events, error: eventError }] = await Promise.all([
    (supabase.from('haccp_batches') as any)
      .select('*')
      .eq('site_id', siteId)
      .order('updated_at', { ascending: false }),
    (supabase.from('haccp_workflows') as any)
      .select('*')
      .eq('site_id', siteId)
      .order('started_at', { ascending: true }),
    (supabase.from('haccp_workflow_events') as any)
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: true }),
  ])

  if (batchError) throw batchError
  if (workflowError) throw workflowError
  if (eventError) throw eventError

  const workflowMap = new Map<string, HaccpWorkflow[]>()
  const eventMap = new Map<string, HaccpWorkflowEvent[]>()

  for (const workflow of (workflows ?? []).map(mapWorkflow)) {
    workflowMap.set(workflow.batch_id, [...(workflowMap.get(workflow.batch_id) ?? []), workflow])
  }

  for (const event of (events ?? []).map(mapEvent)) {
    eventMap.set(event.batch_id, [...(eventMap.get(event.batch_id) ?? []), event])
  }

  return ((batches ?? []).map((row: Record<string, any>) => mapBatch(row)) as HaccpBatch[]).map((batch) => ({
    batch,
    workflows: workflowMap.get(batch.id) ?? [],
    events: eventMap.get(batch.id) ?? [],
  }))
}

export async function findLatestBatchByName(siteId: string, itemName: string) {
  const { data, error } = await (supabase.from('haccp_batches') as any)
    .select('*')
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  const normalized = itemName.trim().toLowerCase()
  const match = (data ?? []).find((row: Record<string, any>) => row.item_name?.trim()?.toLowerCase() === normalized)
  return match ? mapBatch(match) : null
}

export async function findLatestWorkflowByItem(siteId: string, workflowKind: WorkflowKind, itemName?: string) {
  const { data, error } = await (supabase.from('haccp_workflows') as any)
    .select('*')
    .eq('site_id', siteId)
    .eq('workflow_kind', workflowKind)
    .order('started_at', { ascending: false })

  if (error) throw error

  const normalized = itemName?.trim().toLowerCase()
  const activeRows = (data ?? []).filter((row: Record<string, any>) => ACTIVE_WORKFLOW_STATES.includes(row.state))
  const match = normalized
    ? activeRows.find((row: Record<string, any>) => row.item_name?.trim()?.toLowerCase() === normalized)
    : activeRows[0]

  return match ? mapWorkflow(match) : null
}

async function resolveOrCreateBatch({
  siteId,
  workflowKind,
  itemName,
  itemCategory,
  batchId,
  locationKind,
  locationId,
  locationLabel,
  lastTemperature,
}: {
  siteId: string
  workflowKind: WorkflowKind
  itemName: string
  itemCategory: FoodItemPreset['category']
  batchId?: string | null
  locationKind?: HaccpLocationKind
  locationId?: string | null
  locationLabel?: string | null
  lastTemperature?: number | null
}) {
  if (batchId) {
    return fetchBatch(batchId)
  }

  const existing = await findLatestBatchByName(siteId, itemName)
  if (existing) {
    return existing
  }

  return insertBatch({
    id: uuidv4(),
    site_id: siteId,
    item_name: itemName,
    item_category: itemCategory,
    location_kind: batchLocationForWorkflow(workflowKind, locationKind),
    location_id: locationId ?? null,
    location_label: locationLabel ?? null,
    last_temperature: lastTemperature ?? null,
    last_recorded_at: lastTemperature != null ? new Date().toISOString() : null,
  })
}

type BatchSnapshotInput = Omit<Partial<HaccpBatchUpdate>, 'current_workflow_id' | 'updated_at' | 'created_at' | 'id' | 'site_id'>

async function syncBatchSnapshot(batchId: string, workflowId: string, values: BatchSnapshotInput) {
  const normalizedValues: HaccpBatchUpdate = {
    current_workflow_id: workflowId,
    item_name: values.item_name,
    item_category: values.item_category,
    source_workflow_id: values.source_workflow_id,
    location_kind: values.location_kind,
    location_id: values.location_id,
    location_label: values.location_label,
    last_temperature: values.last_temperature,
    last_recorded_at: values.last_recorded_at,
  }

  return updateBatch(batchId, normalizedValues)
}

async function createWorkflowWithBatch({
  workflowKind,
  input,
  state,
  completedAt,
  endTemperature,
  lastTemperature,
  nextDueAt,
  revalidationIntervalMinutes,
  severity,
  correctiveAction,
  fallbackToBatchTemperature = true,
}: {
  workflowKind: WorkflowKind
  input: StartWorkflowInput
  state: WorkflowState
  completedAt?: string | null
  endTemperature?: number | null
  lastTemperature?: number | null
  nextDueAt?: string | null
  revalidationIntervalMinutes?: number | null
  severity?: HaccpWorkflow['severity']
  correctiveAction?: HaccpWorkflow['corrective_action']
  fallbackToBatchTemperature?: boolean
}) {
  const itemName = input.itemName.trim()
  const itemCategory = input.itemCategory ?? 'other'
  const batch = await resolveOrCreateBatch({
    siteId: input.siteId,
    workflowKind,
    itemName,
    itemCategory,
    batchId: input.batchId,
    locationKind: input.locationKind,
    locationId: input.locationId,
    locationLabel: input.locationLabel,
    lastTemperature: lastTemperature ?? input.initialTemperature ?? null,
  })

  const workflowId = uuidv4()
  const nowIso = new Date().toISOString()
  const locationKind = batchLocationForWorkflow(workflowKind, input.locationKind ?? batch.location_kind)
  const resolvedStartTemperature =
    input.initialTemperature ?? (fallbackToBatchTemperature ? batch.last_temperature ?? null : null)
  const resolvedLastTemperature = lastTemperature ?? resolvedStartTemperature
  const workflow = await insertWorkflow({
    id: workflowId,
    batch_id: batch.id,
    site_id: input.siteId,
    workflow_kind: workflowKind,
    state,
    parent_workflow_id: input.parentWorkflowId ?? null,
    title: buildWorkflowTitle(itemName, workflowKind),
    item_name: itemName,
    item_category: itemCategory,
    started_at: nowIso,
    completed_at: completedAt ?? null,
    due_at: workflowKind === 'cooling' ? addMinutesIso(nowIso, 120) : null,
    next_due_at: nextDueAt ?? null,
    revalidation_interval_minutes: revalidationIntervalMinutes ?? null,
    start_temperature: resolvedStartTemperature,
    end_temperature: endTemperature ?? null,
    last_temperature: resolvedLastTemperature,
    severity: severity ?? null,
    corrective_action: correctiveAction ?? null,
    notes: input.notes ?? null,
    location_kind: locationKind,
    location_id: input.locationId ?? batch.location_id ?? null,
    location_label: input.locationLabel ?? batch.location_label ?? null,
    started_by_id: input.startedBy?.id ?? null,
    started_by_name: input.startedBy?.name ?? null,
    completed_by_id: completedAt ? input.startedBy?.id ?? null : null,
    completed_by_name: completedAt ? input.startedBy?.name ?? null : null,
  })

  await syncBatchSnapshot(batch.id, workflow.id, {
    item_name: itemName,
    item_category: itemCategory,
    location_kind: workflow.location_kind,
    location_id: workflow.location_id ?? null,
    location_label: workflow.location_label ?? null,
    last_temperature: workflow.last_temperature ?? batch.last_temperature ?? null,
    last_recorded_at: workflow.last_temperature != null ? nowIso : batch.last_recorded_at ?? null,
  })

  await insertWorkflowEvent({
    id: uuidv4(),
    workflow_id: workflow.id,
    batch_id: batch.id,
    site_id: input.siteId,
    event_type: 'workflow_started',
    payload: {
      workflow_kind: workflowKind,
      initial_temperature: input.initialTemperature ?? null,
      parent_workflow_id: input.parentWorkflowId ?? null,
    },
    created_at: nowIso,
  })

  if (workflow.last_temperature != null) {
    await insertWorkflowEvent({
      id: uuidv4(),
      workflow_id: workflow.id,
      batch_id: batch.id,
      site_id: input.siteId,
      event_type: 'temperature_logged',
      payload: {
        temperature: workflow.last_temperature,
        workflow_kind: workflowKind,
        state,
      },
      created_at: nowIso,
    })
  }

  if (completedAt) {
    await insertWorkflowEvent({
      id: uuidv4(),
      workflow_id: workflow.id,
      batch_id: batch.id,
      site_id: input.siteId,
      event_type: 'workflow_completed',
      payload: {
        temperature: workflow.last_temperature,
      },
      created_at: completedAt,
    })
  }

  return workflow
}

export async function startCooking(input: StartWorkflowInput) {
  return createWorkflowWithBatch({
    workflowKind: 'cooking',
    input: {
      ...input,
      initialTemperature: null,
    },
    state: 'active',
    lastTemperature: null,
    fallbackToBatchTemperature: false,
  })
}

export async function completeCooking(input: CompleteWorkflowInput) {
  const workflow = await fetchWorkflowById(input.workflowId)
  const nowIso = new Date().toISOString()
  const temperature = input.temperature ?? null
  const compliant = temperature != null && isWorkflowTemperatureCompliant('cooking', temperature)
  const updated = await updateWorkflow(input.workflowId, {
    state: temperature != null ? getWorkflowStateFromTemperature('cooking', temperature) : 'awaiting_completion',
    end_temperature: compliant ? temperature : null,
    last_temperature: temperature,
    completed_at: compliant ? nowIso : null,
    completed_by_id: compliant ? input.completedBy?.id ?? null : null,
    completed_by_name: compliant ? input.completedBy?.name ?? null : null,
    notes: input.notes ?? workflow.notes ?? null,
  })

  await syncBatchSnapshot(workflow.batch_id, updated.id, {
    last_temperature: temperature,
    last_recorded_at: temperature != null ? nowIso : null,
  })

  await insertWorkflowEvent({
    id: uuidv4(),
    workflow_id: workflow.id,
    batch_id: workflow.batch_id,
    site_id: workflow.site_id,
    event_type: 'temperature_logged',
    payload: {
      temperature,
      compliant,
    },
    created_at: nowIso,
  })

  if (compliant) {
    await insertWorkflowEvent({
      id: uuidv4(),
      workflow_id: workflow.id,
      batch_id: workflow.batch_id,
      site_id: workflow.site_id,
      event_type: 'workflow_completed',
      payload: { temperature },
      created_at: nowIso,
    })
  }

  return updated
}

export async function startCooling(input: StartWorkflowInput) {
  return createWorkflowWithBatch({
    workflowKind: 'cooling',
    input: {
      ...input,
      locationKind: input.locationKind ?? 'kitchen',
    },
    state: 'active',
    lastTemperature: input.initialTemperature ?? null,
  })
}

export async function transitionWorkflowToCooling(workflowId: string, actor?: HaccpWorkflowActor) {
  const parent = await fetchWorkflowById(workflowId)
  if (parent.workflow_kind !== 'cooking' && parent.workflow_kind !== 'reheating') {
    throw new Error('Only completed cooking or reheating workflows can transition to cooling.')
  }
  if (parent.state !== 'completed') {
    throw new Error('Cooking or reheating must be completed before cooling can start.')
  }

  const nowIso = new Date().toISOString()

  await insertWorkflowEvent({
    id: uuidv4(),
    workflow_id: parent.id,
    batch_id: parent.batch_id,
    site_id: parent.site_id,
    event_type: 'transition_requested',
    payload: {
      to: 'cooling',
    },
    created_at: nowIso,
  })

  const workflow = await startCooling({
    siteId: parent.site_id,
    batchId: parent.batch_id,
    parentWorkflowId: parent.id,
    itemName: parent.item_name,
    itemCategory: parent.item_category,
    startedBy: actor,
    initialTemperature: parent.last_temperature ?? null,
    locationKind: 'kitchen',
    locationLabel: parent.location_label ?? 'Kitchen',
  })

  await insertWorkflowEvent({
    id: uuidv4(),
    workflow_id: workflow.id,
    batch_id: workflow.batch_id,
    site_id: workflow.site_id,
    event_type: 'transition_completed',
    payload: {
      from_workflow_id: parent.id,
      from_kind: parent.workflow_kind,
      to_kind: 'cooling',
    },
    created_at: nowIso,
  })

  return workflow
}

export async function completeCooling(input: CompleteCoolingInput) {
  const workflow = await fetchWorkflowById(input.workflowId)
  const nowIso = new Date().toISOString()
  const temperature = input.temperature ?? null
  const compliant = temperature == null || temperature <= COOLING_COMPLETION_TEMPERATURE_C
  const state: WorkflowState = compliant ? 'completed' : 'needs_action'
  const updated = await updateWorkflow(input.workflowId, {
    state,
    last_temperature: temperature,
    end_temperature: compliant ? temperature : null,
    completed_at: compliant ? nowIso : null,
    completed_by_id: compliant ? input.completedBy?.id ?? null : null,
    completed_by_name: compliant ? input.completedBy?.name ?? null : null,
    location_kind: compliant ? input.locationKind ?? 'fridge' : workflow.location_kind,
    location_id: compliant ? input.locationId ?? null : workflow.location_id,
    location_label: compliant ? input.locationLabel ?? 'Fridge' : workflow.location_label,
    notes: input.notes ?? workflow.notes ?? null,
  })

  await syncBatchSnapshot(workflow.batch_id, updated.id, {
    location_kind: compliant ? updated.location_kind : workflow.location_kind,
    location_id: compliant ? updated.location_id : workflow.location_id,
    location_label: compliant ? updated.location_label : workflow.location_label,
    last_temperature: temperature,
    last_recorded_at: temperature != null ? nowIso : null,
  })

  await insertWorkflowEvent({
    id: uuidv4(),
    workflow_id: workflow.id,
    batch_id: workflow.batch_id,
    site_id: workflow.site_id,
    event_type: 'temperature_logged',
    payload: {
      temperature,
      compliant,
    },
    created_at: nowIso,
  })

  await insertWorkflowEvent({
    id: uuidv4(),
    workflow_id: workflow.id,
    batch_id: workflow.batch_id,
    site_id: workflow.site_id,
    event_type: compliant ? 'workflow_completed' : 'corrective_action_required',
    payload: {
      temperature,
      threshold_c: COOLING_COMPLETION_TEMPERATURE_C,
    },
    created_at: nowIso,
  })

  return updated
}

export async function startReheating(input: StartWorkflowInput) {
  let resolvedBatchId = input.batchId ?? null
  let resolvedStartTemperature = input.initialTemperature ?? null

  if (!resolvedBatchId) {
    const latestBatch = await findLatestBatchByName(input.siteId, input.itemName)
    resolvedBatchId = latestBatch?.id ?? null
    if (resolvedStartTemperature == null) {
      resolvedStartTemperature = latestBatch?.last_temperature ?? null
    }
  }

  const nowIso = new Date().toISOString()
  const compliant = resolvedStartTemperature != null && isWorkflowTemperatureCompliant('reheating', resolvedStartTemperature)

  return createWorkflowWithBatch({
    workflowKind: 'reheating',
    input: {
      ...input,
      batchId: resolvedBatchId,
      initialTemperature: resolvedStartTemperature,
      locationKind: 'kitchen',
    },
    state: resolvedStartTemperature != null
      ? getWorkflowStateFromTemperature('reheating', resolvedStartTemperature)
      : 'awaiting_completion',
    completedAt: compliant ? nowIso : null,
    endTemperature: compliant ? resolvedStartTemperature : null,
    lastTemperature: resolvedStartTemperature,
  })
}

export async function completeReheating(input: CompleteWorkflowInput) {
  const workflow = await fetchWorkflowById(input.workflowId)
  const nowIso = new Date().toISOString()
  const temperature = input.temperature ?? null
  const compliant = temperature != null && isWorkflowTemperatureCompliant('reheating', temperature)
  const updated = await updateWorkflow(input.workflowId, {
    state: temperature != null ? getWorkflowStateFromTemperature('reheating', temperature) : 'awaiting_completion',
    end_temperature: compliant ? temperature : null,
    last_temperature: temperature,
    completed_at: compliant ? nowIso : null,
    completed_by_id: compliant ? input.completedBy?.id ?? null : null,
    completed_by_name: compliant ? input.completedBy?.name ?? null : null,
    notes: input.notes ?? workflow.notes ?? null,
  })

  await syncBatchSnapshot(workflow.batch_id, updated.id, {
    last_temperature: temperature,
    last_recorded_at: temperature != null ? nowIso : null,
  })

  await insertWorkflowEvent({
    id: uuidv4(),
    workflow_id: workflow.id,
    batch_id: workflow.batch_id,
    site_id: workflow.site_id,
    event_type: 'temperature_logged',
    payload: {
      temperature,
      compliant,
    },
    created_at: nowIso,
  })

  if (compliant) {
    await insertWorkflowEvent({
      id: uuidv4(),
      workflow_id: workflow.id,
      batch_id: workflow.batch_id,
      site_id: workflow.site_id,
      event_type: 'workflow_completed',
      payload: { temperature },
      created_at: nowIso,
    })
  }

  return updated
}

async function scheduleHotHoldReminder(workflow: HaccpWorkflow, dueAt: string) {
  const reminderId = uuidv4()
  const reminderValues: HaccpReminderInsert = {
    id: reminderId,
    workflow_id: workflow.id,
    batch_id: workflow.batch_id,
    site_id: workflow.site_id,
    reminder_type: 'hot_hold_check',
    due_at: dueAt,
    delivery_state: 'scheduled',
  }

  const { data, error } = await (supabase.from('haccp_reminders') as any)
    .upsert(reminderValues, { onConflict: 'workflow_id' })
    .select('*')
    .single()

  if (error) throw error
  return mapReminder(data)
}

export async function startHotHold(input: StartWorkflowInput) {
  let resolvedBatchId = input.batchId ?? null
  let resolvedTemperature = input.initialTemperature ?? null

  if (!resolvedBatchId) {
    const latestBatch = await findLatestBatchByName(input.siteId, input.itemName)
    resolvedBatchId = latestBatch?.id ?? null
    if (resolvedTemperature == null) {
      resolvedTemperature = latestBatch?.last_temperature ?? null
    }
  }

  const severity = resolvedTemperature != null ? getHotHoldSeverity(resolvedTemperature) : null
  const state = resolvedTemperature != null ? getWorkflowStateFromTemperature('hot_hold', resolvedTemperature) : 'active'
  const nextDueAt = addMinutesIso(new Date().toISOString(), HACCP_REMINDERS.HOT_HOLD_REVALIDATION_MINUTES)
  const workflow = await createWorkflowWithBatch({
    workflowKind: 'hot_hold',
    input: {
      ...input,
      batchId: resolvedBatchId,
      initialTemperature: resolvedTemperature,
      locationKind: 'hot_hold',
      locationLabel: input.locationLabel ?? 'Hot Hold',
    },
    state,
    lastTemperature: resolvedTemperature,
    nextDueAt: state === 'active' ? nextDueAt : null,
    revalidationIntervalMinutes: HACCP_REMINDERS.HOT_HOLD_REVALIDATION_MINUTES,
    severity,
  })

  if (state === 'active') {
    await scheduleHotHoldReminder(workflow, workflow.next_due_at ?? nextDueAt)
  } else {
    await insertWorkflowEvent({
      id: uuidv4(),
      workflow_id: workflow.id,
      batch_id: workflow.batch_id,
      site_id: workflow.site_id,
      event_type: 'corrective_action_required',
      payload: {
        temperature: resolvedTemperature,
        threshold_c: HACCP_TEMPERATURES.HOT_HOLD_MIN_TEMPERATURE_C,
        severity,
      },
      created_at: new Date().toISOString(),
    })
  }

  return workflow
}

export async function logHotHoldCheck(input: LogHotHoldCheckInput) {
  const workflow = await fetchWorkflowById(input.workflowId)
  const nowIso = new Date().toISOString()
  const severity = getHotHoldSeverity(input.temperature)
  const compliant = input.temperature >= HACCP_TEMPERATURES.HOT_HOLD_MIN_TEMPERATURE_C

  let state: WorkflowState = compliant ? 'active' : 'needs_action'
  let correctiveAction = input.correctiveAction ?? null
  let completedAt: string | null = null
  let nextDueAt: string | null = compliant ? addMinutesIso(nowIso, HACCP_REMINDERS.HOT_HOLD_REVALIDATION_MINUTES) : null

  if (!compliant && correctiveAction === 'discard') {
    state = 'discarded'
    completedAt = nowIso
  }

  if (!compliant && correctiveAction === 'manual_override') {
    state = 'active'
    nextDueAt = addMinutesIso(nowIso, HACCP_REMINDERS.HOT_HOLD_REVALIDATION_MINUTES)
  }

  const updated = await updateWorkflow(input.workflowId, {
    state,
    last_temperature: input.temperature,
    end_temperature: completedAt ? input.temperature : workflow.end_temperature,
    completed_at: completedAt,
    completed_by_id: completedAt ? input.actor?.id ?? null : workflow.completed_by_id,
    completed_by_name: completedAt ? input.actor?.name ?? null : workflow.completed_by_name,
    next_due_at: nextDueAt,
    severity,
    corrective_action: correctiveAction,
    notes: input.notes ?? workflow.notes ?? null,
  })

  await syncBatchSnapshot(workflow.batch_id, updated.id, {
    last_temperature: input.temperature,
    last_recorded_at: nowIso,
    location_kind: state === 'discarded' ? 'service' : updated.location_kind,
  })

  await insertWorkflowEvent({
    id: uuidv4(),
    workflow_id: workflow.id,
    batch_id: workflow.batch_id,
    site_id: workflow.site_id,
    event_type: 'temperature_logged',
    payload: {
      temperature: input.temperature,
      severity,
      compliant,
    },
    created_at: nowIso,
  })

  if (state === 'active') {
    await scheduleHotHoldReminder(updated, nextDueAt ?? addMinutesIso(nowIso, HACCP_REMINDERS.HOT_HOLD_REVALIDATION_MINUTES))
  } else {
    const { error } = await (supabase.from('haccp_reminders') as any)
      .update({
        delivery_state: 'cancelled',
        acknowledged_at: nowIso,
      })
      .eq('workflow_id', workflow.id)

    if (error) throw error
  }

  if (!compliant) {
    await insertWorkflowEvent({
      id: uuidv4(),
      workflow_id: workflow.id,
      batch_id: workflow.batch_id,
      site_id: workflow.site_id,
      event_type: correctiveAction ? 'corrective_action_taken' : 'corrective_action_required',
      payload: {
        temperature: input.temperature,
        severity,
        corrective_action: correctiveAction,
      },
      created_at: nowIso,
    })
  }

  return updated
}

export async function stopHotHold(workflowId: string, actor?: HaccpWorkflowActor) {
  const workflow = await fetchWorkflowById(workflowId)
  const nowIso = new Date().toISOString()
  const updated = await updateWorkflow(workflowId, {
    state: 'completed',
    completed_at: nowIso,
    completed_by_id: actor?.id ?? null,
    completed_by_name: actor?.name ?? null,
    next_due_at: null,
  })

  await insertWorkflowEvent({
    id: uuidv4(),
    workflow_id: workflow.id,
    batch_id: workflow.batch_id,
    site_id: workflow.site_id,
    event_type: 'workflow_completed',
    payload: {
      workflow_kind: workflow.workflow_kind,
    },
    created_at: nowIso,
  })

  const { error } = await (supabase.from('haccp_reminders') as any)
    .update({
      delivery_state: 'cancelled',
      acknowledged_at: nowIso,
    })
    .eq('workflow_id', workflow.id)

  if (error) throw error

  return updated
}

export async function markReminderDelivered(reminderId: string) {
  const { data, error } = await (supabase.from('haccp_reminders') as any)
    .update({
      delivery_state: 'delivered',
      delivered_at: new Date().toISOString(),
    })
    .eq('id', reminderId)
    .select('*')
    .single()

  if (error) throw error
  return mapReminder(data)
}

export async function acknowledgeReminder(reminderId: string) {
  const { data, error } = await (supabase.from('haccp_reminders') as any)
    .update({
      delivery_state: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', reminderId)
    .select('*')
    .single()

  if (error) throw error
  return mapReminder(data)
}

export async function registerPushSubscription(input: RegisterPushSubscriptionInput) {
  const values: PushSubscriptionInsert = {
    id: uuidv4(),
    site_id: input.siteId,
    user_id: input.userId,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    user_agent: input.userAgent ?? null,
  }

  const { data, error } = await (supabase.from('push_subscriptions') as any)
    .upsert(values, { onConflict: 'endpoint' })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function removePushSubscription(endpoint: string) {
  const { error } = await (supabase.from('push_subscriptions') as any)
    .delete()
    .eq('endpoint', endpoint)

  if (error) throw error
}
