import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  Flame,
  History,
  Mic,
  Snowflake,
  Soup,
  TimerReset,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { VoiceButton, type VoiceButtonHandle, type VoiceInteractionState } from '@/components/voice/VoiceButton'
import {
  HaccpStartWorkflowDialog,
  HaccpWorkflowActionDialog,
  type ActionMode,
  type ActionPayload,
  type StartContext,
  type StartPayload,
} from '@/components/haccp/HaccpWorkflowDialogs'
import { useAppStoreShallow, WAKE_WORD_OPTIONS } from '@/store/useAppStore'
import { useAuth } from '@/components/auth/auth-context'
import { useStaff } from '@/hooks/queries/useStaff'
import { useFridges } from '@/hooks/queries/useFridges'
import { useHaccpMutations, useHaccpReminders, useHaccpWorkflows } from '@/hooks/queries/useHaccp'
import { useHaccpVoiceController } from '@/hooks/useHaccpVoiceController'
import { useWakeWord, playWakeSound, getPrimaryWakeWordLabel } from '@/hooks/useWakeWord'
import { parseVoiceCommand } from '@/lib/voiceCommands'
import { getBoardVisibleWorkflows, getHotHoldSeverity } from '@/lib/haccp'
import { cn } from '@/lib/utils'
import { ensurePushSubscription, isPushSupported, requestNotificationPermission } from '@/services/pushService'
import type { HaccpWorkflow, WorkflowKind, WorkflowState } from '@/types'

interface HaccpDashboardProps {
  onNavigate?: (screen: string) => void
  currentScreen?: string
}

type ActionDialogState = {
  workflow: HaccpWorkflow
  mode: ActionMode
} | null

const DASHBOARD_STATES: WorkflowState[] = ['active', 'awaiting_completion', 'needs_action', 'completed']

const LANE_META: Record<WorkflowKind, { title: string; description: string; icon: typeof Flame; accent: string; cardTint: string }> = {
  cooking: {
    title: 'Cook',
    description: 'Reach 75C or more before handoff.',
    icon: Flame,
    accent: 'from-amber-500/30 via-orange-500/10 to-transparent',
    cardTint: 'border-amber-500/20 bg-amber-500/5',
  },
  cooling: {
    title: 'Cool',
    description: 'Move safely to 8C or lower.',
    icon: Snowflake,
    accent: 'from-sky-500/30 via-cyan-500/10 to-transparent',
    cardTint: 'border-sky-500/20 bg-sky-500/5',
  },
  reheating: {
    title: 'Reheat',
    description: 'Bring chilled batches back to 75C.',
    icon: Soup,
    accent: 'from-orange-500/30 via-amber-500/10 to-transparent',
    cardTint: 'border-orange-500/20 bg-orange-500/5',
  },
  hot_hold: {
    title: 'Hold',
    description: 'Maintain 63C with 90 minute checks.',
    icon: TimerReset,
    accent: 'from-rose-500/30 via-red-500/10 to-transparent',
    cardTint: 'border-rose-500/20 bg-rose-500/5',
  },
}

function startContextForKind(kind: WorkflowKind): StartContext {
  if (kind === 'hot_hold') {
    return { kind: 'hot_hold', locationLabel: 'Hot Pass' }
  }

  return { kind }
}

function startActionLabelForKind(kind: WorkflowKind) {
  switch (kind) {
    case 'cooking':
      return 'Start cook event'
    case 'cooling':
      return 'Start cool event'
    case 'reheating':
      return 'Start reheat event'
    case 'hot_hold':
      return 'Start hold event'
  }
}

function formatRelative(date?: string | null) {
  if (!date) return 'No due time'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return 'No due time'
  }
}

function workflowBadgeClass(state: WorkflowState) {
  switch (state) {
    case 'active':
      return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
    case 'awaiting_completion':
      return 'bg-amber-500/15 text-amber-600 border-amber-500/30'
    case 'needs_action':
      return 'bg-red-500/15 text-red-600 border-red-500/30'
    case 'completed':
      return 'bg-zinc-500/15 text-zinc-600 border-zinc-500/30'
    case 'discarded':
      return 'bg-red-500/15 text-red-600 border-red-500/30'
    default:
      return 'bg-zinc-500/15 text-zinc-600 border-zinc-500/30'
  }
}

function laneSortValue(workflow: HaccpWorkflow) {
  if (workflow.state === 'needs_action') return 0
  if (workflow.state === 'awaiting_completion') return 1
  if (workflow.state === 'active') return 2
  return 3
}

export function HaccpDashboard({ onNavigate }: HaccpDashboardProps) {
  const { user } = useAuth()
  const { currentSite, activeStaffId, wakeWordEnabled, activeWakeWords } = useAppStoreShallow((state) => ({
    currentSite: state.currentSite,
    activeStaffId: state.activeStaffId,
    wakeWordEnabled: state.settings.wakeWordEnabled,
    activeWakeWords: state.settings.activeWakeWords,
  }))
  const { data: workflows = [] } = useHaccpWorkflows(currentSite?.id, DASHBOARD_STATES)
  const { data: reminders = [] } = useHaccpReminders(currentSite?.id)
  const { data: staffMembers = [] } = useStaff(currentSite?.id)
  const { data: fridges = [] } = useFridges(currentSite?.id)
  const mutations = useHaccpMutations(currentSite?.id)

  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [startDialog, setStartDialog] = useState<StartContext | null>(null)
  const [actionDialog, setActionDialog] = useState<ActionDialogState>(null)
  const [voiceInteraction, setVoiceInteraction] = useState<{ state: VoiceInteractionState; detail?: string }>({ state: 'idle' })
  const [wakeWordTriggerToken, setWakeWordTriggerToken] = useState(0)
  const [wakeWordSuppressed, setWakeWordSuppressed] = useState(false)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [pushStatus, setPushStatus] = useState<'unsupported' | 'idle' | 'registering' | 'ready'>(
    isPushSupported() ? 'idle' : 'unsupported',
  )

  const voiceButtonRef = useRef<VoiceButtonHandle>(null)

  useEffect(() => {
    if (staffMembers.length === 0) return
    if (staffMembers.some((staff) => staff.id === selectedStaffId)) return

    const nextStaffId = staffMembers.find((staff) => staff.id === activeStaffId)?.id ?? staffMembers[0].id
    setSelectedStaffId(nextStaffId)
  }, [activeStaffId, selectedStaffId, staffMembers])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(Date.now())
    }, 30_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    setClockNow(Date.now())
  }, [reminders])

  useEffect(() => {
    if (!currentSite?.id || !user?.id || !isPushSupported()) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    setPushStatus('registering')
    void ensurePushSubscription({ siteId: currentSite.id, userId: user.id })
      .then(() => setPushStatus('ready'))
      .catch(() => setPushStatus('idle'))
  }, [currentSite?.id, user?.id])

  const selectedStaff = useMemo(() => {
    return staffMembers.find((staff) => staff.id === selectedStaffId) ?? null
  }, [selectedStaffId, staffMembers])
  const staffOptions = useMemo(
    () => staffMembers.map((staff) => ({ id: staff.id, name: staff.name, staff_code: staff.staff_code })),
    [staffMembers],
  )
  const currentSiteId = currentSite?.id
  const currentUserId = user?.id

  const visibleWorkflows = useMemo(
    () => getBoardVisibleWorkflows(workflows, clockNow),
    [clockNow, workflows],
  )
  const workflowsByKind = useMemo(() => {
    const sortLane = (items: HaccpWorkflow[]) =>
      [...items].sort((a, b) => laneSortValue(a) - laneSortValue(b) || new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

    return {
      cooking: sortLane(visibleWorkflows.filter((workflow: HaccpWorkflow) => workflow.workflow_kind === 'cooking')),
      cooling: sortLane(visibleWorkflows.filter((workflow: HaccpWorkflow) => workflow.workflow_kind === 'cooling')),
      reheating: sortLane(visibleWorkflows.filter((workflow: HaccpWorkflow) => workflow.workflow_kind === 'reheating')),
      hot_hold: sortLane(visibleWorkflows.filter((workflow: HaccpWorkflow) => workflow.workflow_kind === 'hot_hold')),
    }
  }, [visibleWorkflows])

  const dueReminders = useMemo(
    () =>
      reminders.filter(
        (reminder: (typeof reminders)[number]) =>
          reminder.delivery_state !== 'acknowledged' &&
          reminder.delivery_state !== 'cancelled' &&
          new Date(reminder.due_at).getTime() <= clockNow,
      ),
    [clockNow, reminders],
  )

  const haccpVoice = useHaccpVoiceController({
    siteId: currentSite?.id,
    workflows: visibleWorkflows,
    reminders,
    actor: selectedStaff ? { id: selectedStaff.id, name: selectedStaff.name } : null,
    voiceButtonRef,
    isVoiceBusy: voiceInteraction.state !== 'idle' && voiceInteraction.state !== 'wake_ready',
    onOpenStartDialog: setStartDialog,
    onOpenActionDialog: setActionDialog,
    mutations,
  })

  const wakeWordLabel = useMemo(
    () => getPrimaryWakeWordLabel(activeWakeWords?.length ? activeWakeWords : ['luma']),
    [activeWakeWords],
  )

  const handleWakeWordHeard = useCallback(() => {
    playWakeSound()
  }, [])

  const handleWakeWordDetected = useCallback(() => {
    if (wakeWordSuppressed) return
    setWakeWordTriggerToken((value) => value + 1)
    voiceButtonRef.current?.triggerVoice()
  }, [wakeWordSuppressed])

  const handleImmediateWakeCommand = useCallback(
    (commandText: string) => {
      if (!commandText.trim()) return
      setWakeWordSuppressed(true)
      window.setTimeout(() => setWakeWordSuppressed(false), 2500)
      void haccpVoice.handleVoiceCommand(parseVoiceCommand(commandText))
    },
    [haccpVoice],
  )

  const handleEnablePush = useCallback(async () => {
    if (!currentSiteId || !currentUserId || !isPushSupported()) return

    setPushStatus('registering')
    const permission = await requestNotificationPermission()
    if (permission !== 'granted') {
      setPushStatus('idle')
      return
    }

    await ensurePushSubscription({ siteId: currentSiteId, userId: currentUserId })
    setPushStatus('ready')
  }, [currentSiteId, currentUserId])

  useWakeWord({
    enabled:
      wakeWordEnabled &&
      !haccpVoice.conversationMode &&
      (voiceInteraction.state === 'idle' || voiceInteraction.state === 'wake_ready'),
    wakeWords: activeWakeWords?.length ? activeWakeWords : WAKE_WORD_OPTIONS.map((option) => option.id),
    onWakeWordHeard: handleWakeWordHeard,
    onWakeWordDetected: handleWakeWordDetected,
    onCommandDetected: handleImmediateWakeCommand,
  })

  const stats = useMemo(() => {
    const totalLive = visibleWorkflows.filter((workflow: HaccpWorkflow) => workflow.state !== 'completed').length
    const needsAction = visibleWorkflows.filter((workflow: HaccpWorkflow) => workflow.state === 'needs_action').length
    const hotHold = visibleWorkflows.filter((workflow: HaccpWorkflow) => workflow.workflow_kind === 'hot_hold').length
    return { totalLive, needsAction, hotHold, dueReminders: dueReminders.length }
  }, [dueReminders.length, visibleWorkflows])

  const handleStartSubmit = useCallback(
    async (payload: StartPayload) => {
      const actor = payload.staffId
        ? staffMembers.find((staff) => staff.id === payload.staffId)
        : selectedStaff

      const baseInput = {
        siteId: currentSite!.id,
        itemName: payload.itemName,
        itemCategory: payload.itemCategory as any,
        batchId: payload.batchId ?? null,
        parentWorkflowId: payload.parentWorkflowId ?? null,
        initialTemperature: payload.temperature ?? null,
        startedBy: actor ? { id: actor.id, name: actor.name } : undefined,
        locationLabel: payload.locationLabel ?? null,
      }

      if (payload.kind === 'cooking') {
        await mutations.startCooking.mutateAsync(baseInput)
      } else if (payload.kind === 'cooling') {
        await mutations.startCooling.mutateAsync(baseInput)
      } else if (payload.kind === 'reheating') {
        await mutations.startReheating.mutateAsync(baseInput)
      } else if (payload.kind === 'hot_hold') {
        await mutations.startHotHold.mutateAsync({
          ...baseInput,
          locationLabel: payload.locationLabel ?? 'Hot Pass',
        })
      }

      setStartDialog(null)
    },
    [currentSite, mutations, selectedStaff, staffMembers],
  )

  const handleActionSubmit = useCallback(
    async (payload: ActionPayload) => {
      const actor = payload.staffId
        ? staffMembers.find((staff) => staff.id === payload.staffId)
        : selectedStaff

      if (payload.mode === 'complete') {
        if (payload.workflow.workflow_kind === 'cooking') {
          await mutations.completeCooking.mutateAsync({
            workflowId: payload.workflow.id,
            temperature: payload.temperature ?? null,
            completedBy: actor ? { id: actor.id, name: actor.name } : undefined,
            notes: payload.notes,
          })
        } else if (payload.workflow.workflow_kind === 'cooling') {
          await mutations.completeCooling.mutateAsync({
            workflowId: payload.workflow.id,
            temperature: payload.temperature ?? null,
            completedBy: actor ? { id: actor.id, name: actor.name } : undefined,
            locationKind: 'fridge',
            locationId: payload.locationId ?? null,
            locationLabel: payload.locationLabel ?? null,
            notes: payload.notes,
          })
        } else if (payload.workflow.workflow_kind === 'reheating') {
          await mutations.completeReheating.mutateAsync({
            workflowId: payload.workflow.id,
            temperature: payload.temperature ?? null,
            completedBy: actor ? { id: actor.id, name: actor.name } : undefined,
            notes: payload.notes,
          })
        }
      } else if (payload.mode === 'hold_check') {
        await mutations.logHotHoldCheck.mutateAsync({
          workflowId: payload.workflow.id,
          temperature: payload.temperature ?? 0,
          correctiveAction: payload.correctiveAction ?? null,
          actor: actor ? { id: actor.id, name: actor.name } : undefined,
          notes: payload.notes,
        })
      } else if (payload.mode === 'stop') {
        await mutations.stopHotHold.mutateAsync({
          workflowId: payload.workflow.id,
          actor: actor ? { id: actor.id, name: actor.name } : undefined,
        })
      }

      setActionDialog(null)
    },
    [mutations, selectedStaff, staffMembers],
  )

  const handleCardAction = useCallback(
    async (workflow: HaccpWorkflow, action: 'complete' | 'transition_to_cooling' | 'start_reheating' | 'start_hot_hold' | 'hold_check' | 'stop_hot_hold') => {
      if (action === 'complete') {
        setActionDialog({
          workflow,
          mode: workflow.workflow_kind === 'hot_hold' ? 'hold_check' : 'complete',
        })
        return
      }

      if (action === 'hold_check') {
        setActionDialog({ workflow, mode: 'hold_check' })
        return
      }

      if (action === 'stop_hot_hold') {
        setActionDialog({ workflow, mode: 'stop' })
        return
      }

      if (action === 'transition_to_cooling') {
        await mutations.transitionToCooling.mutateAsync({
          workflowId: workflow.id,
          actor: selectedStaff ? { id: selectedStaff.id, name: selectedStaff.name } : undefined,
        })
        return
      }

      if (action === 'start_reheating') {
        setStartDialog({
          kind: 'reheating',
          batchId: workflow.batch_id,
          itemName: workflow.item_name,
          itemCategory: workflow.item_category,
          temperature: workflow.last_temperature ?? null,
        })
        return
      }

      if (action === 'start_hot_hold') {
        setStartDialog({
          kind: 'hot_hold',
          batchId: workflow.batch_id,
          itemName: workflow.item_name,
          itemCategory: workflow.item_category,
          temperature: workflow.last_temperature ?? null,
          locationLabel: 'Hot Pass',
        })
      }
    },
    [mutations.transitionToCooling, selectedStaff],
  )

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_34%),linear-gradient(180deg,#fffdf8_0%,#f8fafc_56%,#eef2ff_100%)] text-zinc-950 dark:bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_30%),linear-gradient(180deg,#09090b_0%,#111827_48%,#0f172a_100%)] dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6 px-4 pb-16 pt-6 lg:px-8">
        <header className="grid gap-4 rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:grid-cols-[1.2fr_0.8fr] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_28px_80px_rgba(2,6,23,0.5)]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Live HACCP</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Cook, cool, reheat, and hold in one board.</h1>
                <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
                  Voice-first HACCP operations with deterministic workflow state, reminder visibility, and full batch traceability.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
                <Mic className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">Wake word</span>
                <span className="text-zinc-500 dark:text-zinc-400">{wakeWordEnabled ? wakeWordLabel : 'Disabled'}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Open workflows" value={stats.totalLive} tone="default" />
              <StatCard label="Needs action" value={stats.needsAction} tone="danger" />
              <StatCard label="Hot hold live" value={stats.hotHold} tone="warm" />
              <StatCard label="Due reminders" value={stats.dueReminders} tone="cool" />
            </div>
          </div>

          <div className="flex h-full flex-col justify-between rounded-[24px] border border-zinc-200 bg-zinc-950 p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] dark:border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Quick Dock</p>
                <h2 className="mt-2 text-xl font-semibold">Start the next stage or hand control to voice.</h2>
              </div>
              <VoiceButton
                ref={voiceButtonRef}
                size="lg"
                conversationMode={haccpVoice.conversationMode}
                quickResponseMode={haccpVoice.conversationMode}
                wakeWordActive={wakeWordEnabled}
                wakeWordTriggerToken={wakeWordTriggerToken}
                wakeWordLabel={wakeWordLabel}
                onCommand={(command) => {
                  void haccpVoice.handleVoiceCommand(command)
                }}
                onTranscript={(text) => {
                  if (haccpVoice.conversationMode) {
                    void haccpVoice.handleConversationTranscript(text)
                  }
                }}
                onInteractionStateChange={(state, detail) => setVoiceInteraction({ state, detail })}
              />
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button variant="warning" onClick={() => setStartDialog(startContextForKind('cooking'))}>
                <Flame className="mr-2 h-4 w-4" />
                Start Cooking
              </Button>
              <Button variant="cooling" onClick={() => setStartDialog(startContextForKind('cooling'))}>
                <Snowflake className="mr-2 h-4 w-4" />
                Start Cooling
              </Button>
              <Button variant="secondary" onClick={() => setStartDialog(startContextForKind('reheating'))}>
                <Soup className="mr-2 h-4 w-4" />
                Start Reheat
              </Button>
              <Button variant="danger" onClick={() => setStartDialog(startContextForKind('hot_hold'))}>
                <TimerReset className="mr-2 h-4 w-4" />
                Start Hold
              </Button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <select
                className="h-10 rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white"
                value={selectedStaffId}
                onChange={(event) => setSelectedStaffId(event.target.value)}
              >
                <option value="" className="text-zinc-950">
                  No default staff
                </option>
                {staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.id} className="text-zinc-950">
                    {staff.name}
                  </option>
                ))}
              </select>

              <Button variant="ghost" className="border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => onNavigate?.('history')}>
                <History className="mr-2 h-4 w-4" />
                View Lifecycle History
              </Button>
              {pushStatus !== 'unsupported' ? (
                <Button
                  variant="ghost"
                  className="border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => void handleEnablePush()}
                  disabled={pushStatus === 'ready' || pushStatus === 'registering'}
                >
                  <BellRing className="mr-2 h-4 w-4" />
                  {pushStatus === 'ready' ? 'Push Ready' : pushStatus === 'registering' ? 'Connecting Push' : 'Enable Push'}
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        {dueReminders.length > 0 ? (
          <section className="rounded-[24px] border border-red-500/20 bg-red-500/6 p-4 shadow-sm dark:bg-red-500/10">
            <div className="flex items-center gap-3">
              <BellRing className="h-5 w-5 text-red-500" />
              <div>
                <h2 className="font-semibold">Due reminder queue</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {dueReminders.length} hot-hold check{dueReminders.length > 1 ? 's are' : ' is'} waiting for acknowledgement.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-4">
        {(Object.keys(LANE_META) as WorkflowKind[]).map((kind: WorkflowKind) => {
            const lane = workflowsByKind[kind]
            const laneMeta = LANE_META[kind]
            const Icon = laneMeta.icon

            return (
              <div
                key={kind}
                className={cn(
                  'relative overflow-hidden rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/5',
                )}
              >
                <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b', laneMeta.accent)} />
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{laneMeta.title}</p>
                    <h2 className="mt-1 text-2xl font-semibold">{lane.length}</h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{laneMeta.description}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={startActionLabelForKind(kind)}
                    className="h-14 w-14 rounded-2xl border border-white/60 bg-white/80 p-0 text-current shadow-sm hover:bg-white dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
                    onClick={() => setStartDialog(startContextForKind(kind))}
                  >
                    <Icon className="h-5 w-5" />
                  </Button>
                </div>

                <div className="relative mt-5 space-y-3">
                  {lane.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                      Nothing active in this lane.
                    </div>
                  ) : (
                    lane.slice(0, 5).map((workflow: HaccpWorkflow) => (
                      <WorkflowCard
                        key={workflow.id}
                        workflow={workflow}
                        className={laneMeta.cardTint}
                        onAction={handleCardAction}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </section>
      </div>

      <HaccpStartWorkflowDialog
        open={!!startDialog}
        onOpenChange={(open) => !open && setStartDialog(null)}
        context={startDialog}
        staffOptions={staffOptions}
        defaultStaffId={selectedStaffId || null}
        loading={
          mutations.startCooking.isPending ||
          mutations.startCooling.isPending ||
          mutations.startReheating.isPending ||
          mutations.startHotHold.isPending
        }
        onSubmit={handleStartSubmit}
      />

      <HaccpWorkflowActionDialog
        open={!!actionDialog}
        onOpenChange={(open) => !open && setActionDialog(null)}
        mode={actionDialog?.mode ?? 'complete'}
        workflow={actionDialog?.workflow ?? null}
        staffOptions={staffOptions}
        defaultStaffId={selectedStaffId || null}
        fridges={fridges}
        loading={
          mutations.completeCooking.isPending ||
          mutations.completeCooling.isPending ||
          mutations.completeReheating.isPending ||
          mutations.logHotHoldCheck.isPending ||
          mutations.stopHotHold.isPending
        }
        onSubmit={handleActionSubmit}
      />
    </div>
  )
}

const StatCard = memo(function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'default' | 'danger' | 'warm' | 'cool'
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-500/20 bg-red-500/8 text-red-600'
      : tone === 'warm'
        ? 'border-amber-500/20 bg-amber-500/8 text-amber-600'
        : tone === 'cool'
          ? 'border-sky-500/20 bg-sky-500/8 text-sky-600'
          : 'border-zinc-200 bg-white text-zinc-950 dark:border-white/10 dark:bg-white/5 dark:text-zinc-50'

  return (
    <div className={cn('rounded-2xl border p-4 shadow-sm', toneClass)}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  )
})

const WorkflowCard = memo(function WorkflowCard({
  workflow,
  className,
  onAction,
}: {
  workflow: HaccpWorkflow
  className?: string
  onAction: (
    workflow: HaccpWorkflow,
    action: 'complete' | 'transition_to_cooling' | 'start_reheating' | 'start_hot_hold' | 'hold_check' | 'stop_hot_hold',
  ) => void | Promise<void>
}) {
  const hotHoldSeverity = workflow.workflow_kind === 'hot_hold' && workflow.last_temperature != null
    ? getHotHoldSeverity(workflow.last_temperature)
    : null

  return (
    <article className={cn('rounded-[24px] border p-4 shadow-sm transition-transform hover:-translate-y-0.5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{workflow.item_name}</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            {workflow.location_label || 'No location'} · Started {formatRelative(workflow.started_at)}
          </p>
        </div>
        <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]', workflowBadgeClass(workflow.state))}>
          {workflow.state.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <div className="flex items-center justify-between">
          <span>Latest temp</span>
          <span className="font-semibold">{workflow.last_temperature != null ? `${workflow.last_temperature.toFixed(1)}C` : 'Pending'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Next due</span>
          <span className="font-semibold">{formatRelative(workflow.next_due_at ?? workflow.due_at)}</span>
        </div>
        {hotHoldSeverity ? (
          <div className="flex items-center justify-between">
            <span>Severity</span>
            <span
              className={cn(
                'font-semibold uppercase tracking-[0.16em]',
                hotHoldSeverity === 'critical' ? 'text-red-600' : hotHoldSeverity === 'warning' ? 'text-amber-600' : 'text-emerald-600',
              )}
            >
              {hotHoldSeverity}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(workflow.workflow_kind === 'cooking' || workflow.workflow_kind === 'reheating' || workflow.workflow_kind === 'cooling') &&
        workflow.state !== 'completed' ? (
          <Button size="sm" variant="secondary" onClick={() => void onAction(workflow, 'complete')}>
            {workflow.workflow_kind === 'cooling' ? 'Finish Cooling' : 'Record Temp'}
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

        {workflow.state === 'needs_action' ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Corrective action required
          </div>
        ) : null}
      </div>
    </article>
  )
})
