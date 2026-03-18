import type {
  HaccpHotHoldSeverity,
  HaccpWorkflow,
  WorkflowKind,
  WorkflowState,
} from '@/types'

export const HACCP_TEMPERATURES = {
  SAFE_COOKING_TEMPERATURE_C: 75,
  HOT_HOLD_MIN_TEMPERATURE_C: 63,
  HOT_HOLD_WARNING_MIN_TEMPERATURE_C: 55,
} as const

export const HACCP_REMINDERS = {
  HOT_HOLD_REVALIDATION_MINUTES: 90,
  HOT_HOLD_WARNING_WINDOW_MINUTES: 15,
} as const

const BOARD_COMPLETED_RETENTION_MS = 1000 * 60 * 60 * 24

export type HotHoldReminderAlertState = 'clear' | 'warning' | 'alarm'

export function isWorkflowTemperatureCompliant(kind: WorkflowKind, temperature: number): boolean {
  if (kind === 'cooking' || kind === 'reheating') {
    return temperature >= HACCP_TEMPERATURES.SAFE_COOKING_TEMPERATURE_C
  }

  if (kind === 'hot_hold') {
    return temperature >= HACCP_TEMPERATURES.HOT_HOLD_MIN_TEMPERATURE_C
  }

  return true
}

export function getWorkflowStateFromTemperature(kind: WorkflowKind, temperature: number): WorkflowState {
  if (kind === 'cooking' || kind === 'reheating') {
    return isWorkflowTemperatureCompliant(kind, temperature) ? 'completed' : 'awaiting_completion'
  }

  if (kind === 'hot_hold') {
    return isWorkflowTemperatureCompliant(kind, temperature) ? 'active' : 'needs_action'
  }

  return 'active'
}

export function getHotHoldSeverity(temperature: number): HaccpHotHoldSeverity {
  if (temperature >= HACCP_TEMPERATURES.HOT_HOLD_MIN_TEMPERATURE_C) {
    return 'pass'
  }

  if (temperature >= HACCP_TEMPERATURES.HOT_HOLD_WARNING_MIN_TEMPERATURE_C) {
    return 'warning'
  }

  return 'critical'
}

export function addMinutesIso(isoTimestamp: string, minutes: number): string {
  return new Date(new Date(isoTimestamp).getTime() + minutes * 60_000).toISOString()
}

export function shouldShowWorkflowOnBoard(workflow: HaccpWorkflow, nowMs: number = Date.now()) {
  if (workflow.state !== 'completed') return true
  if (workflow.workflow_kind === 'reheating' || workflow.workflow_kind === 'cooling') return false

  const updatedAt = workflow.updated_at ?? workflow.completed_at ?? workflow.started_at
  return nowMs - new Date(updatedAt).getTime() < BOARD_COMPLETED_RETENTION_MS
}

export function getBoardVisibleWorkflows(workflows: HaccpWorkflow[], nowMs: number = Date.now()) {
  const completedParentsWithActiveNextStep = new Set(
    workflows
      .filter(
        (workflow) =>
          workflow.parent_workflow_id &&
          workflow.state !== 'cancelled' &&
          workflow.state !== 'discarded',
      )
      .map((workflow) => workflow.parent_workflow_id as string),
  )

  return workflows.filter((workflow) => {
    if (!shouldShowWorkflowOnBoard(workflow, nowMs)) return false

    if (
      workflow.workflow_kind === 'cooking' &&
      workflow.state === 'completed' &&
      completedParentsWithActiveNextStep.has(workflow.id)
    ) {
      return false
    }

    return true
  })
}

export function getHotHoldReminderAlert(dueAt?: string | null, nowMs: number = Date.now()) {
  if (!dueAt) {
    return {
      state: 'clear' as HotHoldReminderAlertState,
      minutesUntilDue: null,
    }
  }

  const deltaMs = new Date(dueAt).getTime() - nowMs
  const roundedMinutes =
    deltaMs >= 0
      ? Math.ceil(deltaMs / 60_000)
      : -Math.ceil(Math.abs(deltaMs) / 60_000)

  if (deltaMs <= 0) {
    return {
      state: 'alarm' as HotHoldReminderAlertState,
      minutesUntilDue: roundedMinutes,
    }
  }

  if (deltaMs <= HACCP_REMINDERS.HOT_HOLD_WARNING_WINDOW_MINUTES * 60_000) {
    return {
      state: 'warning' as HotHoldReminderAlertState,
      minutesUntilDue: roundedMinutes,
    }
  }

  return {
    state: 'clear' as HotHoldReminderAlertState,
    minutesUntilDue: roundedMinutes,
  }
}
