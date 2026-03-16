import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  BellRing,
  Flame,
  GripVertical,
  History,
  Snowflake,
  Soup,
  TimerReset,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getHotHoldReminderAlert, getHotHoldSeverity } from '@/lib/haccp'
import { cn } from '@/lib/utils'
import type { HaccpWorkflow, WorkflowKind, WorkflowState } from '@/types'

export type LegacyHaccpAction =
  | 'complete'
  | 'transition_to_cooling'
  | 'start_reheating'
  | 'start_hot_hold'
  | 'hold_check'
  | 'stop_hot_hold'

interface LegacyHaccpBoardProps {
  workflows: HaccpWorkflow[]
  dueReminders: number
  onAction: (workflow: HaccpWorkflow, action: LegacyHaccpAction) => void | Promise<void>
  onStartWorkflow?: (kind: WorkflowKind) => void
  onOpenHistory?: () => void
}

const LANE_META: Record<
  WorkflowKind,
  {
    title: string
    description: string
    icon: typeof Flame
    tone: string
    iconTone: string
  }
> = {
  cooking: {
    title: 'Cook',
    description: 'Bring food to 75C or above before release.',
    icon: Flame,
    tone: 'border-amber-500/20',
    iconTone: 'bg-amber-500/15 text-amber-500',
  },
  cooling: {
    title: 'Cool',
    description: 'Track safe cooling to 8C or below.',
    icon: Snowflake,
    tone: 'border-sky-500/20',
    iconTone: 'bg-sky-500/15 text-sky-500',
  },
  reheating: {
    title: 'Reheat',
    description: 'Reheat chilled batches back to 75C.',
    icon: Soup,
    tone: 'border-orange-500/20',
    iconTone: 'bg-orange-500/15 text-orange-500',
  },
  hot_hold: {
    title: 'Hold',
    description: 'Maintain 63C and log a temperature check every 90 min.',
    icon: TimerReset,
    tone: 'border-red-500/20',
    iconTone: 'bg-red-500/15 text-red-500',
  },
}

function formatRelative(date?: string | null) {
  if (!date) return 'No timer'

  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return 'No timer'
  }
}

function workflowBadgeClass(state: WorkflowState) {
  switch (state) {
    case 'active':
      return 'bg-green-500/10 text-green-600'
    case 'awaiting_completion':
      return 'bg-amber-500/10 text-amber-600'
    case 'needs_action':
      return 'bg-red-500/10 text-red-600'
    case 'completed':
      return 'bg-theme-ghost text-theme-secondary'
    case 'discarded':
      return 'bg-red-500/10 text-red-600'
    default:
      return 'bg-theme-ghost text-theme-secondary'
  }
}

function laneSortValue(workflow: HaccpWorkflow) {
  if (workflow.state === 'needs_action') return 0
  if (workflow.state === 'awaiting_completion') return 1
  if (workflow.state === 'active') return 2
  return 3
}

function formatWorkflowState(state: WorkflowState) {
  return state.replace(/_/g, ' ')
}

function completionActionLabel(workflow: HaccpWorkflow) {
  if (workflow.workflow_kind === 'cooking') return 'Finish Cook'
  if (workflow.workflow_kind === 'cooling') return 'Finish Cooling'
  if (workflow.workflow_kind === 'reheating') return 'Finish Reheat'
  return 'Complete'
}

function getWorkflowDragAction(
  workflow: HaccpWorkflow,
  targetKind: WorkflowKind,
): LegacyHaccpAction | null {
  if (workflow.state !== 'completed') return null

  if (workflow.workflow_kind === 'cooking' && targetKind === 'cooling') {
    return 'transition_to_cooling'
  }

  if (workflow.workflow_kind === 'cooking' && targetKind === 'hot_hold') {
    return 'start_hot_hold'
  }

  if (workflow.workflow_kind === 'cooling' && targetKind === 'reheating') {
    return 'start_reheating'
  }

  return null
}

function isWorkflowDraggable(workflow: HaccpWorkflow) {
  return workflow.state === 'completed' && (workflow.workflow_kind === 'cooking' || workflow.workflow_kind === 'cooling')
}

function workflowDragPrompt(workflow: HaccpWorkflow) {
  if (workflow.workflow_kind === 'cooling' && workflow.state === 'completed') {
    return 'Drag to Reheat'
  }

  if (workflow.workflow_kind === 'cooking' && workflow.state === 'completed') {
    return 'Drag to Cool or Hold'
  }

  return null
}

function laneDropPrompt(action: LegacyHaccpAction | null) {
  if (action === 'transition_to_cooling') return 'Drop to start cooling'
  if (action === 'start_hot_hold') return 'Drop to start hold'
  if (action === 'start_reheating') return 'Drop to start reheat'
  return 'Drop not available'
}

function startActionLabelForKind(kind: WorkflowKind) {
  switch (kind) {
    case 'cooking':
      return 'Start cook workflow'
    case 'cooling':
      return 'Start cool workflow'
    case 'reheating':
      return 'Start reheat workflow'
    case 'hot_hold':
      return 'Start hold workflow'
  }
}

function describeHotHoldAlert(itemName: string, minutesUntilDue: number) {
  if (minutesUntilDue < 0) {
    return `${itemName} is overdue by ${Math.abs(minutesUntilDue)} min.`
  }

  return `${itemName} needs a temperature check in ${minutesUntilDue} min.`
}

function WorkflowCard({
  workflow,
  onAction,
  nowMs,
  draggable = false,
  dragPrompt,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: {
  workflow: HaccpWorkflow
  onAction: (workflow: HaccpWorkflow, action: LegacyHaccpAction) => void | Promise<void>
  nowMs: number
  draggable?: boolean
  dragPrompt?: string | null
  isDragging?: boolean
  onDragStart?: (workflow: HaccpWorkflow) => void
  onDragEnd?: () => void
}) {
  const hotHoldSeverity =
    workflow.workflow_kind === 'hot_hold' && workflow.last_temperature != null
      ? getHotHoldSeverity(workflow.last_temperature)
      : null
  const hotHoldReminderAlert =
    workflow.workflow_kind === 'hot_hold' &&
    workflow.state !== 'completed' &&
    workflow.state !== 'cancelled' &&
    workflow.state !== 'discarded'
      ? getHotHoldReminderAlert(workflow.next_due_at ?? workflow.due_at, nowMs)
      : null

  return (
    <article
      draggable={draggable}
      aria-grabbed={draggable ? isDragging : undefined}
      onDragStart={(event) => {
        if (!draggable) return

        event.dataTransfer?.setData('text/plain', workflow.id)

        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move'
        }

        onDragStart?.(workflow)
      }}
      onDragEnd={() => {
        onDragEnd?.()
      }}
      className={cn(
        'rounded-2xl border border-theme-primary bg-glass p-4 shadow-theme-sm transition',
        draggable && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-70 ring-2 ring-sky-500/30',
        hotHoldReminderAlert?.state === 'warning' && 'border-amber-500/40 ring-2 ring-amber-500/15',
        hotHoldReminderAlert?.state === 'alarm' &&
          'border-red-500/45 ring-2 ring-red-500/20 shadow-[0_0_0_1px_rgba(239,68,68,0.12),0_18px_40px_rgba(239,68,68,0.14)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-theme-primary">{workflow.item_name}</h3>
          <p className="mt-1 text-sm text-theme-secondary">
            {workflow.location_label || workflow.location_kind} • Started {formatRelative(workflow.started_at)}
          </p>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
            workflowBadgeClass(workflow.state),
          )}
        >
          {formatWorkflowState(workflow.state)}
        </span>
      </div>

      {draggable && dragPrompt ? (
        <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-theme-muted">
          <GripVertical className="h-4 w-4" />
          <span>{dragPrompt}</span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 text-sm text-theme-secondary">
        <div className="flex items-center justify-between gap-4">
          <span>Latest temp</span>
          <span className="font-semibold text-theme-primary">
            {workflow.last_temperature != null ? `${workflow.last_temperature.toFixed(1)}C` : 'Pending'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Next due</span>
          <span className="font-semibold text-theme-primary">
            {formatRelative(workflow.next_due_at ?? workflow.due_at)}
          </span>
        </div>
        {hotHoldSeverity ? (
          <div className="flex items-center justify-between gap-4">
            <span>Severity</span>
            <span
              className={cn(
                'font-semibold uppercase tracking-wide',
                hotHoldSeverity === 'critical'
                  ? 'text-red-500'
                  : hotHoldSeverity === 'warning'
                    ? 'text-amber-500'
                    : 'text-green-500',
              )}
            >
              {hotHoldSeverity}
            </span>
          </div>
        ) : null}
      </div>

      {hotHoldReminderAlert && hotHoldReminderAlert.state !== 'clear' && hotHoldReminderAlert.minutesUntilDue != null ? (
        <div
          className={cn(
            'mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold',
            hotHoldReminderAlert.state === 'alarm'
              ? 'border-red-500/40 bg-red-500/10 text-red-600 animate-pulse'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-700',
          )}
        >
          {hotHoldReminderAlert.state === 'alarm' ? (
            <BellRing className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{describeHotHoldAlert(workflow.item_name, hotHoldReminderAlert.minutesUntilDue)}</span>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {(workflow.workflow_kind === 'cooking' ||
          workflow.workflow_kind === 'reheating' ||
          workflow.workflow_kind === 'cooling') &&
        workflow.state !== 'completed' ? (
          <Button
            size="sm"
            variant={workflow.workflow_kind === 'cooling' ? 'cooling' : 'secondary'}
            onClick={() => void onAction(workflow, 'complete')}
          >
            {completionActionLabel(workflow)}
          </Button>
        ) : null}

        {workflow.workflow_kind === 'cooking' && workflow.state === 'completed' ? (
          <>
            <Button size="sm" variant="cooling" onClick={() => void onAction(workflow, 'transition_to_cooling')}>
              Start Cooling
            </Button>
            <Button size="sm" variant="danger" onClick={() => void onAction(workflow, 'start_hot_hold')}>
              Start Hold
            </Button>
          </>
        ) : null}

        {workflow.workflow_kind === 'cooling' && workflow.state === 'completed' ? (
          <Button size="sm" variant="secondary" onClick={() => void onAction(workflow, 'start_reheating')}>
            Start Reheat
          </Button>
        ) : null}

        {workflow.workflow_kind === 'hot_hold' ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => void onAction(workflow, 'hold_check')}>
              Log Check
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void onAction(workflow, 'stop_hot_hold')}>
              Stop Hold
            </Button>
          </>
        ) : null}
      </div>

      {workflow.state === 'needs_action' ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600">
          <AlertTriangle className="h-4 w-4" />
          Corrective action required
        </div>
      ) : null}
    </article>
  )
}

export function LegacyHaccpBoard({
  workflows,
  dueReminders,
  onAction,
  onStartWorkflow,
  onOpenHistory,
}: LegacyHaccpBoardProps) {
  const [draggedWorkflowId, setDraggedWorkflowId] = useState<string | null>(null)
  const [activeDropLane, setActiveDropLane] = useState<WorkflowKind | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 30_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const draggedWorkflow =
    draggedWorkflowId != null
      ? workflows.find((workflow) => workflow.id === draggedWorkflowId) ?? null
      : null

  const criticalWorkflows = workflows.filter((workflow) => workflow.state === 'needs_action')
  const hotHoldAttentionWorkflows = workflows
    .filter(
      (workflow) =>
        workflow.workflow_kind === 'hot_hold' &&
        workflow.state !== 'completed' &&
        workflow.state !== 'cancelled' &&
        workflow.state !== 'discarded',
    )
    .map((workflow) => ({
      workflow,
      alert: getHotHoldReminderAlert(workflow.next_due_at ?? workflow.due_at, nowMs),
    }))
    .filter(({ alert }) => alert.state !== 'clear' && alert.minutesUntilDue != null)
  const hotHoldAlarmWorkflows = hotHoldAttentionWorkflows.filter(({ alert }) => alert.state === 'alarm')
  const hotHoldWarningWorkflows = hotHoldAttentionWorkflows.filter(({ alert }) => alert.state === 'warning')
  const lanes = {
    cooking: [...workflows.filter((workflow) => workflow.workflow_kind === 'cooking')].sort(
      (a, b) => laneSortValue(a) - laneSortValue(b) || new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    ),
    cooling: [...workflows.filter((workflow) => workflow.workflow_kind === 'cooling')].sort(
      (a, b) => laneSortValue(a) - laneSortValue(b) || new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    ),
    reheating: [...workflows.filter((workflow) => workflow.workflow_kind === 'reheating')].sort(
      (a, b) => laneSortValue(a) - laneSortValue(b) || new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    ),
    hot_hold: [...workflows.filter((workflow) => workflow.workflow_kind === 'hot_hold')].sort(
      (a, b) => laneSortValue(a) - laneSortValue(b) || new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    ),
  }

  const clearDragState = () => {
    setDraggedWorkflowId(null)
    setActiveDropLane(null)
  }

  const handleLaneDrop = (kind: WorkflowKind) => {
    if (!draggedWorkflow) {
      clearDragState()
      return
    }

    const action = getWorkflowDragAction(draggedWorkflow, kind)
    clearDragState()

    if (!action) return

    void onAction(draggedWorkflow, action)
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-purple-500/15 flex items-center justify-center">
              <span className="text-purple-500 text-xs">H</span>
            </div>
            <h2 className="text-xs font-semibold text-theme-secondary uppercase tracking-wide">
              HACCP Workflow Board
            </h2>
          </div>
          <p className="text-lg font-semibold text-theme-primary">
            Cook, cool, reheat and hold inside the legacy command center.
          </p>
          <p className="text-sm text-theme-muted mt-1">
            The workflow logic now follows the unified HACCP lifecycle without replacing the existing visual identity.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-xl border border-theme-primary bg-theme-card px-4 py-3 shadow-theme-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">Live workflows</p>
            <p className="mt-1 text-xl font-semibold text-theme-primary">
              {workflows.filter((workflow) => workflow.state !== 'completed').length}
            </p>
          </div>
          <div className="rounded-xl border border-theme-primary bg-theme-card px-4 py-3 shadow-theme-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">Due checks</p>
            <p className="mt-1 text-xl font-semibold text-theme-primary">{dueReminders}</p>
          </div>
          {onOpenHistory ? (
            <Button variant="secondary" onClick={onOpenHistory}>
              <History className="mr-2 h-4 w-4" />
              Lifecycle History
            </Button>
          ) : null}
        </div>
      </section>

      {hotHoldAlarmWorkflows.length > 0 ? (
        <section className="relative overflow-hidden rounded-[28px] border border-red-500/40 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.2),transparent_50%),linear-gradient(135deg,rgba(254,242,242,0.98),rgba(255,255,255,0.95))] p-5 shadow-[0_0_0_1px_rgba(239,68,68,0.1),0_24px_50px_rgba(239,68,68,0.16)] dark:bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.18),transparent_50%),linear-gradient(135deg,rgba(69,10,10,0.92),rgba(15,23,42,0.9))]">
          <div className="absolute inset-0 opacity-35 bg-[repeating-linear-gradient(-45deg,rgba(239,68,68,0.16)_0,rgba(239,68,68,0.16)_12px,transparent_12px,transparent_24px)]" />
          <div className="relative flex items-start gap-4">
            <div className="rounded-2xl bg-red-500 p-3 text-white shadow-lg animate-pulse">
              <BellRing className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-red-700 dark:text-red-300">
                Hot Hold Alarm
              </p>
              <h2 className="mt-2 text-xl font-semibold text-theme-primary">
                Temperature check overdue
              </h2>
              <p className="mt-1 text-sm text-theme-secondary">
                Every hot hold workflow needs a temperature check-in every 90 minutes. Log it now.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {hotHoldAlarmWorkflows.map(({ workflow, alert }) => (
                  <div
                    key={workflow.id}
                    className="flex flex-wrap items-center gap-2 rounded-2xl border border-red-500/35 bg-white/85 px-3 py-2 dark:bg-white/10"
                  >
                    <span className="text-sm font-semibold text-red-700 dark:text-red-200">
                      {describeHotHoldAlert(workflow.item_name, alert.minutesUntilDue!)}
                    </span>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={`Log check for ${workflow.item_name}`}
                      onClick={() => void onAction(workflow, 'hold_check')}
                    >
                      Log Check
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : hotHoldWarningWorkflows.length > 0 ? (
        <section className="relative overflow-hidden rounded-[28px] border border-amber-500/35 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.2),transparent_50%),linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.95))] p-5 shadow-[0_0_0_1px_rgba(245,158,11,0.08),0_20px_40px_rgba(245,158,11,0.12)] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_50%),linear-gradient(135deg,rgba(120,53,15,0.88),rgba(15,23,42,0.9))]">
          <div className="relative flex items-start gap-4">
            <div className="rounded-2xl bg-amber-500/90 p-3 text-white shadow-lg">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-amber-700 dark:text-amber-300">
                Hot Hold Warning
              </p>
              <h2 className="mt-2 text-xl font-semibold text-theme-primary">
                90-minute check window is approaching
              </h2>
              <p className="mt-1 text-sm text-theme-secondary">
                Keep the hold above 63C and prepare a fresh temperature check before the timer expires.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {hotHoldWarningWorkflows.map(({ workflow, alert }) => (
                  <div
                    key={workflow.id}
                    className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/35 bg-white/85 px-3 py-2 dark:bg-white/10"
                  >
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-200">
                      {describeHotHoldAlert(workflow.item_name, alert.minutesUntilDue!)}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Log check for ${workflow.item_name}`}
                      onClick={() => void onAction(workflow, 'hold_check')}
                    >
                      Log Check
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : dueReminders > 0 ? (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <BellRing className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-semibold text-theme-primary">Hot hold reminder queue</p>
              <p className="text-sm text-theme-secondary">
                {dueReminders} hot hold check{dueReminders === 1 ? '' : 's'} due now.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {criticalWorkflows.length > 0 ? (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide">
              Corrective Actions
            </h2>
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
              {criticalWorkflows.length}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {criticalWorkflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onAction={onAction}
                nowMs={nowMs}
                draggable={false}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4">
        {(Object.keys(LANE_META) as WorkflowKind[]).map((kind) => {
          const lane = lanes[kind]
          const meta = LANE_META[kind]
          const Icon = meta.icon
          const dropAction = draggedWorkflow ? getWorkflowDragAction(draggedWorkflow, kind) : null
          const isActiveDropLane = activeDropLane === kind && dropAction != null

          return (
            <div
              key={kind}
              role="region"
              aria-label={`${meta.title} lane`}
              onDragOver={(event) => {
                if (!dropAction) return

                event.preventDefault()

                if (event.dataTransfer) {
                  event.dataTransfer.dropEffect = 'move'
                }

                setActiveDropLane(kind)
              }}
              onDragLeave={() => {
                if (activeDropLane === kind) {
                  setActiveDropLane(null)
                }
              }}
              onDrop={(event) => {
                event.preventDefault()
                handleLaneDrop(kind)
              }}
              className={cn(
                'rounded-2xl border bg-theme-card p-4 shadow-theme-sm transition-colors',
                meta.tone,
                isActiveDropLane && 'border-sky-500 bg-sky-500/5',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-theme-secondary uppercase tracking-wide">{meta.title}</p>
                  <h3 className="mt-1 text-2xl font-semibold text-theme-primary">{lane.length}</h3>
                  <p className="mt-1 text-sm text-theme-muted">{meta.description}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={startActionLabelForKind(kind)}
                  className={cn(
                    'h-14 w-14 rounded-xl p-0 text-current hover:bg-transparent',
                    meta.iconTone,
                  )}
                  onClick={() => onStartWorkflow?.(kind)}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              </div>

              {isActiveDropLane ? (
                <div className="mt-4 rounded-xl border border-dashed border-sky-500/50 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-700">
                  {laneDropPrompt(dropAction)}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {lane.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-theme-primary bg-theme-secondary p-4 text-sm text-theme-muted">
                    Nothing active in this lane.
                  </div>
                ) : (
                  lane.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      onAction={onAction}
                      nowMs={nowMs}
                      draggable={isWorkflowDraggable(workflow)}
                      dragPrompt={workflowDragPrompt(workflow)}
                      isDragging={draggedWorkflowId === workflow.id}
                      onDragStart={(dragged) => {
                        setDraggedWorkflowId(dragged.id)
                      }}
                      onDragEnd={clearDragState}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
