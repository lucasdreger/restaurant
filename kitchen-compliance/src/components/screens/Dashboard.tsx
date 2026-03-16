import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Flame, Plus, Snowflake, Soup, Thermometer, TimerReset } from 'lucide-react'
import { Sidebar, MobileNav } from '@/components/layout/Sidebar'
import { DashboardHeader, ProgressCard } from '@/components/layout/DashboardHeader'
import { FridgeTempModal } from '@/components/fridge/FridgeTempModal'
import {
  type ActionDialogContext,
  HaccpStartWorkflowDialog,
  HaccpWorkflowActionDialog,
  type ActionPayload,
  type StartContext,
  type StartPayload,
} from '@/components/haccp/HaccpWorkflowDialogs'
import { HaccpOperatorQuickPickDialog } from '@/components/haccp/HaccpOperatorQuickPickDialog'
import { LegacyHaccpBoard, type LegacyHaccpAction } from '@/components/haccp/LegacyHaccpBoard'
import {
  VoiceButton,
  type VoiceButtonHandle,
  type VoiceInteractionState,
} from '@/components/voice/VoiceButton'
import {
  useAppStore,
  getUnacknowledgedAlerts,
  WAKE_WORD_OPTIONS,
} from '@/store/useAppStore'
import { useTextToSpeech } from '@/hooks/useVoiceRecognition'
import { useVoiceFridgeFlow } from '@/hooks/useVoiceFridgeFlow'
import { useWakeWord, playWakeSound, getPrimaryWakeWordLabel } from '@/hooks/useWakeWord'
import { getFridges, logFridgeTemp, type Fridge } from '@/services/fridgeService'
import { parseVoiceCommand } from '@/lib/voiceCommands'
import { isWorkflowTemperatureCompliant, shouldShowWorkflowOnBoard } from '@/lib/haccp'
import { cn } from '@/lib/utils'
import { isLike } from '@/lib/stringUtils'
import { useStaff } from '@/hooks/queries/useStaff'
import { useHaccpMutations, useHaccpReminders, useHaccpWorkflows } from '@/hooks/queries/useHaccp'
import { useHaccpVoiceController } from '@/hooks/useHaccpVoiceController'
import type { HaccpReminder, HaccpWorkflow, VoiceCommand, WorkflowKind, WorkflowState } from '@/types'
import { toast } from 'sonner'

interface DashboardProps {
  onNavigate?: (screen: string) => void
  currentScreen?: string
}

type VoiceFlowSpeakOptions = {
  rate?: number
  pitch?: number
  onComplete?: () => void
  preferBrowser?: boolean
  preferRealtime?: boolean
}

type QuickOperatorAction = Extract<LegacyHaccpAction, 'transition_to_cooling' | 'start_reheating' | 'start_hot_hold'>

type QuickOperatorDialogContext = {
  workflow: HaccpWorkflow
  action: QuickOperatorAction
}

const DASHBOARD_STATES: WorkflowState[] = ['active', 'awaiting_completion', 'needs_action', 'completed']

function startContextForKind(kind: WorkflowKind): StartContext {
  if (kind === 'hot_hold') {
    return { kind: 'hot_hold', locationLabel: 'Hot Pass' }
  }

  return { kind }
}

export function Dashboard({ onNavigate, currentScreen = 'home' }: DashboardProps) {
  const [isFridgeTempModalOpen, setIsFridgeTempModalOpen] = useState(false)
  const [preselectedFridgeIndex, setPreselectedFridgeIndex] = useState<number | undefined>(undefined)
  const [preselectedFridgeTemp, setPreselectedFridgeTemp] = useState<number | null>(null)
  const [preselectedStaffId, setPreselectedStaffId] = useState<string | null>(null)
  const [fridges, setFridges] = useState<Fridge[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [manualStartDialog, setManualStartDialog] = useState<StartContext | null>(null)
  const [voiceStartDialog, setVoiceStartDialog] = useState<StartContext | null>(null)
  const [manualActionDialog, setManualActionDialog] = useState<ActionDialogContext | null>(null)
  const [voiceActionDialog, setVoiceActionDialog] = useState<ActionDialogContext | null>(null)
  const [quickOperatorDialog, setQuickOperatorDialog] = useState<QuickOperatorDialogContext | null>(null)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [wakeWordTriggerToken, setWakeWordTriggerToken] = useState(0)
  const [isFlowTransitioning, setIsFlowTransitioning] = useState(false)
  const [isWakeWordSuppressed, setIsWakeWordSuppressed] = useState(false)
  const [voiceInteraction, setVoiceInteraction] = useState<{
    state: VoiceInteractionState
    detail?: string
  }>({
    state: 'idle',
  })

  const { currentSite, alerts, acknowledgeAlert, settings, activeStaffId } = useAppStore()
  const { data: workflows = [] } = useHaccpWorkflows(currentSite?.id, DASHBOARD_STATES)
  const { data: reminders = [] } = useHaccpReminders(currentSite?.id)
  const { data: staffMembers = [] } = useStaff(currentSite?.id)
  const mutations = useHaccpMutations(currentSite?.id)
  const { speak } = useTextToSpeech()

  const voiceButtonRef = useRef<VoiceButtonHandle>(null)
  const flowTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const wakeWordSuppressTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const wakeWordResumeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastCommandHandledAt = useRef<number>(0)
  const resumeListeningRef = useRef<() => void>(() => {})
  const previousFlowInProgressRef = useRef(false)
  const voiceRuntimeStateRef = useRef({
    isFlowActive: false,
    isVoiceInteractionBusy: false,
  })

  useEffect(() => {
    if (!selectedStaffId && staffMembers.length > 0) {
      setSelectedStaffId(activeStaffId ?? staffMembers[0].id)
    }
  }, [activeStaffId, selectedStaffId, staffMembers])

  const selectedStaff = useMemo(
    () => staffMembers.find((staff) => staff.id === selectedStaffId) ?? null,
    [selectedStaffId, staffMembers],
  )

  const startDialog = manualStartDialog ?? voiceStartDialog
  const actionDialog = manualActionDialog ?? voiceActionDialog

  const visibleWorkflows = useMemo(
    () => workflows.filter((workflow: HaccpWorkflow) => shouldShowWorkflowOnBoard(workflow, clockNow)),
    [clockNow, workflows],
  )

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

  const activeCoolingWorkflows = useMemo(
    () =>
      visibleWorkflows.filter(
        (workflow: HaccpWorkflow) =>
          workflow.workflow_kind === 'cooling' &&
          workflow.state !== 'completed' &&
          workflow.state !== 'discarded' &&
          workflow.state !== 'cancelled',
      ),
    [visibleWorkflows],
  )

  const dueReminders = useMemo(
    () =>
      reminders.filter(
        (reminder: HaccpReminder) =>
          reminder.delivery_state !== 'acknowledged' &&
          reminder.delivery_state !== 'cancelled' &&
          new Date(reminder.due_at).getTime() <= clockNow,
      ),
    [clockNow, reminders],
  )

  const unacknowledgedAlerts = useMemo(
    () => getUnacknowledgedAlerts(alerts),
    [alerts],
  )

  const workflowStats = useMemo(() => {
    const total = visibleWorkflows.length
    const live = visibleWorkflows.filter((workflow: HaccpWorkflow) => workflow.state !== 'completed').length
    const completed = visibleWorkflows.filter((workflow: HaccpWorkflow) => workflow.state === 'completed').length
    const needsAction = visibleWorkflows.filter((workflow: HaccpWorkflow) => workflow.state === 'needs_action').length
    const hotHoldLive = visibleWorkflows.filter(
      (workflow: HaccpWorkflow) => workflow.workflow_kind === 'hot_hold' && workflow.state !== 'completed',
    ).length
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100)

    return {
      total,
      live,
      completed,
      needsAction,
      hotHoldLive,
      completionRate,
    }
  }, [visibleWorkflows])

  useEffect(() => {
    if (currentSite?.id) {
      getFridges(currentSite.id).then(setFridges).catch(() => setFridges([]))
    }
  }, [currentSite?.id])

  const requestFlowInput = useCallback(() => {
    voiceButtonRef.current?.stopVoice()

    const delayMs = 120
    setTimeout(() => {
      voiceButtonRef.current?.triggerVoice()
    }, delayMs)
  }, [])

  const speakForFlow = useCallback(
    (text: string, options: VoiceFlowSpeakOptions = {}) => {
      voiceButtonRef.current?.stopVoice()
      speak(text, {
        rate: options.rate,
        pitch: options.pitch,
        onComplete: options.onComplete,
        preferBrowser: options.preferBrowser ?? true,
      })
    },
    [speak],
  )

  const commonOnStopListening = useCallback(() => {
    if (voiceButtonRef.current) {
      voiceButtonRef.current.stopVoice()
    }
  }, [])

  const voiceFridgeFlow = useVoiceFridgeFlow({
    fridges,
    staffMembers,
    onConfirm: async (data) => {
      if (!currentSite?.id) return
      await logFridgeTemp({
        site_id: currentSite.id,
        fridge_id: data.fridgeId,
        temperature: data.temperature,
        recorded_by: data.staffId,
        recorded_by_name: staffMembers.find((staff) => staff.id === data.staffId)?.name,
      })
      setIsFridgeTempModalOpen(false)
    },
    onOpenModal: (fridgeIndex) => {
      setPreselectedFridgeIndex(fridgeIndex)
      setIsFridgeTempModalOpen(true)
    },
    onCloseModal: () => setIsFridgeTempModalOpen(false),
    speak: speakForFlow,
    onAwaitingInput: requestFlowInput,
    onStopListening: commonOnStopListening,
  })

  useEffect(() => {
    setPreselectedFridgeTemp(voiceFridgeFlow.temperature)
    setPreselectedStaffId(voiceFridgeFlow.staffId)
  }, [voiceFridgeFlow.temperature, voiceFridgeFlow.staffId])

  const isVoiceInteractionBusy = useMemo(
    () =>
      voiceInteraction.state === 'connecting' ||
      voiceInteraction.state === 'listening' ||
      voiceInteraction.state === 'processing' ||
      voiceInteraction.state === 'speaking' ||
      voiceInteraction.state === 'flow_active',
    [voiceInteraction.state],
  )

  const haccpVoice = useHaccpVoiceController({
    siteId: currentSite?.id,
    workflows: visibleWorkflows,
    reminders,
    actor: selectedStaff ? { id: selectedStaff.id, name: selectedStaff.name } : null,
    voiceButtonRef,
    isVoiceBusy: isVoiceInteractionBusy,
    onOpenStartDialog: setManualStartDialog,
    onOpenActionDialog: setManualActionDialog,
    onSyncStartDialog: setVoiceStartDialog,
    onSyncActionDialog: setVoiceActionDialog,
    mutations,
  })

  const isFlowInProgress = haccpVoice.conversationMode || voiceFridgeFlow.step !== 'idle'
  const isFlowActive = isFlowTransitioning || isFlowInProgress

  useEffect(() => {
    voiceRuntimeStateRef.current = {
      isFlowActive,
      isVoiceInteractionBusy,
    }
  }, [isFlowActive, isVoiceInteractionBusy])

  const suppressWakeWordTemporarily = useCallback((durationMs = 3500) => {
    setIsWakeWordSuppressed(true)
    if (wakeWordSuppressTimeoutRef.current) {
      clearTimeout(wakeWordSuppressTimeoutRef.current)
    }
    wakeWordSuppressTimeoutRef.current = setTimeout(() => {
      setIsWakeWordSuppressed(false)
      wakeWordSuppressTimeoutRef.current = null
    }, durationMs)
  }, [])

  const beginFlowTransition = useCallback(() => {
    setIsFlowTransitioning(true)

    if (flowTransitionTimeoutRef.current) {
      clearTimeout(flowTransitionTimeoutRef.current)
    }

    flowTransitionTimeoutRef.current = setTimeout(() => {
      setIsFlowTransitioning(false)
      flowTransitionTimeoutRef.current = null
    }, 1500)
  }, [])

  const scheduleWakeWordResume = useCallback(
    (delayMs = 1200) => {
      if (!settings.wakeWordEnabled) return

      if (wakeWordResumeTimeoutRef.current) {
        clearTimeout(wakeWordResumeTimeoutRef.current)
      }

      wakeWordResumeTimeoutRef.current = setTimeout(() => {
        if (
          voiceRuntimeStateRef.current.isFlowActive ||
          voiceRuntimeStateRef.current.isVoiceInteractionBusy
        ) {
          return
        }

        resumeListeningRef.current()
      }, delayMs)
    },
    [settings.wakeWordEnabled],
  )

  useEffect(() => {
    if (isFlowInProgress) {
      setIsFlowTransitioning(false)
      if (flowTransitionTimeoutRef.current) {
        clearTimeout(flowTransitionTimeoutRef.current)
        flowTransitionTimeoutRef.current = null
      }
    }
  }, [isFlowInProgress])

  useEffect(() => {
    const wasFlowInProgress = previousFlowInProgressRef.current
    if (wasFlowInProgress && !isFlowInProgress) {
      if (settings.voiceProvider === 'realtime') {
        voiceButtonRef.current?.stopVoice()
      }

      if (settings.wakeWordEnabled) {
        scheduleWakeWordResume(650)
      }
    }

    previousFlowInProgressRef.current = isFlowInProgress
  }, [
    isFlowInProgress,
    scheduleWakeWordResume,
    settings.voiceProvider,
    settings.wakeWordEnabled,
  ])

  useEffect(() => {
    return () => {
      if (flowTransitionTimeoutRef.current) {
        clearTimeout(flowTransitionTimeoutRef.current)
      }
      if (wakeWordSuppressTimeoutRef.current) {
        clearTimeout(wakeWordSuppressTimeoutRef.current)
      }
      if (wakeWordResumeTimeoutRef.current) {
        clearTimeout(wakeWordResumeTimeoutRef.current)
      }
    }
  }, [])

  const inferStopItemFromNoisySpeech = useCallback(
    (rawTranscript: string): string | null => {
      if (activeCoolingWorkflows.length === 0) return null

      const normalized = rawTranscript
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (!normalized) return null

      const tokens = normalized.split(/\s+/).filter(Boolean)
      const startHints = ['start', 'begin', 'new']
      if (startHints.some((hint) => normalized.includes(hint))) return null

      const stopHints = [
        'finish',
        'done',
        'stop',
        'close',
        'pull',
        'pulling',
        'fridge',
        'move',
        'cooling',
        'coolin',
        'kulin',
        'comi',
        'finis',
      ]
      const hasStopHint =
        stopHints.some((hint) => normalized.includes(hint)) ||
        tokens.some((token) => stopHints.some((hint) => isLike(token, hint, 2)))

      let bestMatch: { item: string; score: number } | null = null

      for (const workflow of activeCoolingWorkflows) {
        const itemNormalized = workflow.item_name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s.-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        if (!itemNormalized) continue

        const itemTokens = itemNormalized.split(/\s+/).filter(Boolean)
        let score = 0

        if (normalized.includes(itemNormalized)) score += 4
        if (isLike(normalized, itemNormalized, 3)) score += 2

        for (const token of tokens) {
          for (const itemToken of itemTokens) {
            if (token === itemToken) {
              score += 2
            } else if (isLike(token, itemToken, 1)) {
              score += 1
            }
          }
        }

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { item: workflow.item_name, score }
        }
      }

      if (!bestMatch) return null
      const threshold = hasStopHint ? 2 : 3
      return bestMatch.score >= threshold ? bestMatch.item : null
    },
    [activeCoolingWorkflows],
  )

  const handleVoiceCommand = useCallback(
    (command: VoiceCommand) => {
      if (Date.now() - lastCommandHandledAt.current < 2000) {
        return
      }
      lastCommandHandledAt.current = Date.now()

      if (command.type === 'log_fridge_temp') {
        beginFlowTransition()
        voiceFridgeFlow.startFlow(command.fridgeNumber)
        return
      }

      if (command.type === 'discard') {
        toast.info('Use the workflow card actions to discard or correct a batch.')
        suppressWakeWordTemporarily()
        scheduleWakeWordResume(1000)
        return
      }

      const shouldGuardTransition =
        command.type === 'start_cooling' ||
        command.type === 'stop_cooling' ||
        command.type === 'start_cooking' ||
        command.type === 'start_hot_hold' ||
        (command.type === 'start_reheating' && !command.item) ||
        (command.type === 'complete_cooking' && typeof command.temperature !== 'number') ||
        (command.type === 'complete_reheating' && typeof command.temperature !== 'number') ||
        (command.type === 'log_hot_hold_check' && typeof command.temperature !== 'number')

      if (shouldGuardTransition) {
        beginFlowTransition()
      }

      void (async () => {
        const handled = await haccpVoice.handleVoiceCommand(command)

        if (!handled && command.type !== 'unknown' && command.type !== 'noise') {
          toast.info('Voice command not available in the current HACCP flow.')
        }

        suppressWakeWordTemporarily()
        scheduleWakeWordResume(1600)
      })()
    },
    [
      beginFlowTransition,
      haccpVoice,
      scheduleWakeWordResume,
      suppressWakeWordTemporarily,
      voiceFridgeFlow,
    ],
  )

  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      if (haccpVoice.conversationMode) {
        void haccpVoice.handleConversationTranscript(transcript)
        return
      }

      if (voiceFridgeFlow.step !== 'idle') {
        void voiceFridgeFlow.handleTranscript(transcript)
        return
      }

      const parsedCommand = parseVoiceCommand(transcript)
      if (parsedCommand.type === 'noise' || parsedCommand.type === 'unknown') {
        const inferredItem = inferStopItemFromNoisySpeech(transcript)
        if (inferredItem) {
          handleVoiceCommand({ type: 'stop_cooling', item: inferredItem })
        }
      }
    },
    [handleVoiceCommand, haccpVoice, inferStopItemFromNoisySpeech, voiceFridgeFlow],
  )

  const handleVoiceInterimTranscript = useCallback(
    (transcript: string) => {
      if (voiceFridgeFlow.step !== 'idle') {
        voiceFridgeFlow.checkInterimTranscript(transcript)
      }
    },
    [voiceFridgeFlow],
  )

  const handleVoiceEnd = useCallback(() => {
    if (settings.wakeWordEnabled && !isFlowActive && !isVoiceInteractionBusy) {
      resumeListeningRef.current()
    }
  }, [isFlowActive, isVoiceInteractionBusy, settings.wakeWordEnabled])

  const handleVoiceInteractionStateChange = useCallback(
    (state: VoiceInteractionState, detail?: string) => {
      setVoiceInteraction((current) => {
        if (current.state === state && current.detail === detail) return current
        return { state, detail }
      })
    },
    [],
  )

  const handleWakeWordHeard = useCallback(() => {
    if (isVoiceInteractionBusy) return
    playWakeSound()
    if (settings.voiceProvider === 'realtime') return

    setTimeout(() => {
      setWakeWordTriggerToken((token) => token + 1)
    }, 400)
  }, [isVoiceInteractionBusy, settings.voiceProvider])

  const handleWakeWordDetected = useCallback(() => {
    if (isVoiceInteractionBusy) return
    if (Date.now() - lastCommandHandledAt.current < 1500) {
      return
    }

    if (settings.voiceProvider === 'realtime') {
      setWakeWordTriggerToken((token) => token + 1)
    }
  }, [isVoiceInteractionBusy, settings.voiceProvider])

  const handleImmediateCommand = useCallback(
    (command: string) => {
      if (haccpVoice.conversationMode) {
        void haccpVoice.handleConversationTranscript(command)
        return
      }

      if (voiceFridgeFlow.step !== 'idle') {
        void voiceFridgeFlow.handleTranscript(command)
        return
      }

      const parsedCommand = parseVoiceCommand(command)

      if (parsedCommand.type === 'noise') {
        const normalized = command
          .toLowerCase()
          .replace(/[^\w\s.-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        const coolingTail = normalized.match(/\bcooling\s+(.+)$/i)
        const looksLikeStart = /\b(start|begin|new)\b/i.test(normalized)
        if (coolingTail && !looksLikeStart) {
          const inferredItem = coolingTail[1]?.trim()
          if (inferredItem) {
            handleVoiceCommand({ type: 'stop_cooling', item: inferredItem })
            return
          }
        }

        const inferredWorkflowItem = inferStopItemFromNoisySpeech(command)
        if (inferredWorkflowItem) {
          handleVoiceCommand({ type: 'stop_cooling', item: inferredWorkflowItem })
          return
        }

        if (voiceButtonRef.current) {
          voiceButtonRef.current.triggerVoice()
        }
        return
      }

      if (parsedCommand.type !== 'unknown') {
        handleVoiceCommand(parsedCommand)
        return
      }

      const inferredWorkflowItem = inferStopItemFromNoisySpeech(command)
      if (inferredWorkflowItem) {
        handleVoiceCommand({ type: 'stop_cooling', item: inferredWorkflowItem })
        return
      }

      if (voiceButtonRef.current) {
        voiceButtonRef.current.triggerVoice()
      }

      scheduleWakeWordResume(2000)
    },
    [
      handleVoiceCommand,
      haccpVoice,
      inferStopItemFromNoisySpeech,
      scheduleWakeWordResume,
      voiceFridgeFlow,
    ],
  )

  const activeWakeWordPhrases = useMemo(() => {
    const activeIds = settings.activeWakeWords || ['luma']
    return activeIds.flatMap((id) => {
      const option = WAKE_WORD_OPTIONS.find((entry) => entry.id === id)
      return option ? option.phrases : []
    })
  }, [settings.activeWakeWords])

  const primaryWakeWordLabel = useMemo(
    () => getPrimaryWakeWordLabel(activeWakeWordPhrases),
    [activeWakeWordPhrases],
  )

  const { isActive: isWakeWordActive, resumeListening } = useWakeWord({
    onWakeWordHeard: handleWakeWordHeard,
    onWakeWordDetected: handleWakeWordDetected,
    onCommandDetected: handleImmediateCommand,
    enabled:
      settings.wakeWordEnabled &&
      !isFlowActive &&
      !isVoiceInteractionBusy &&
      !isWakeWordSuppressed,
    language: settings.language === 'en' ? 'en-IE' : settings.language,
    wakeWords: activeWakeWordPhrases,
  })

  useEffect(() => {
    resumeListeningRef.current = resumeListening
  }, [resumeListening])

  const handleNavigate = useCallback(
    (screen: string) => {
      onNavigate?.(screen)
    },
    [onNavigate],
  )

  const handleNotificationsClick = useCallback(() => {
    if (dueReminders.length === 0 && unacknowledgedAlerts.length === 0) {
      toast.info('No new notifications')
      return
    }

    if (dueReminders.length > 0) {
      toast.warning(
        `${dueReminders.length} hot hold check${dueReminders.length === 1 ? ' is' : 's are'} due now`,
        { duration: 5000 },
      )
    }

    unacknowledgedAlerts.forEach((alert, index) => {
      setTimeout(() => {
        if (alert.type === 'overdue') {
          toast.error(alert.message, { duration: 5000 })
        } else {
          toast.warning(alert.message, { duration: 5000 })
        }
        acknowledgeAlert(alert.id)
      }, index * 500)
    })
  }, [acknowledgeAlert, dueReminders.length, unacknowledgedAlerts])

  const handleStartSubmit = useCallback(
    async (payload: StartPayload) => {
      if (!currentSite?.id) return
      if (!payload.staffId) {
        toast.error('Select an operator to continue.')
        return
      }

      const actor = staffMembers.find((staff) => staff.id === payload.staffId)
      if (!actor) {
        toast.error('Selected operator could not be found.')
        return
      }

      const baseInput = {
        siteId: currentSite.id,
        itemName: payload.itemName,
        itemCategory: payload.itemCategory as any,
        batchId: payload.batchId ?? null,
        parentWorkflowId: payload.parentWorkflowId ?? null,
        initialTemperature: payload.kind === 'cooking' ? null : payload.temperature ?? null,
        startedBy: { id: actor.id, name: actor.name },
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

      setManualStartDialog(null)
      setVoiceStartDialog(null)
    },
    [currentSite, mutations, staffMembers],
  )

  const handleActionSubmit = useCallback(
    async (payload: ActionPayload) => {
      if (!payload.staffId) {
        toast.error('Select an operator to continue.')
        return
      }

      const actor = staffMembers.find((staff) => staff.id === payload.staffId)
      if (!actor) {
        toast.error('Selected operator could not be found.')
        return
      }

      if (payload.mode === 'complete') {
        if (payload.workflow.workflow_kind === 'cooking') {
          await mutations.completeCooking.mutateAsync({
            workflowId: payload.workflow.id,
            temperature: payload.temperature ?? null,
            completedBy: { id: actor.id, name: actor.name },
            notes: payload.notes,
          })

          if (payload.postCompletionAction === 'start_cooling') {
            if (payload.temperature != null && isWorkflowTemperatureCompliant('cooking', payload.temperature)) {
              await mutations.transitionToCooling.mutateAsync({
                workflowId: payload.workflow.id,
                actor: { id: actor.id, name: actor.name },
              })
            } else {
              toast.error('Cooking must reach 75C before cooling can start.')
            }
          }
        } else if (payload.workflow.workflow_kind === 'cooling') {
          await mutations.completeCooling.mutateAsync({
            workflowId: payload.workflow.id,
            temperature: payload.temperature ?? null,
            completedBy: { id: actor.id, name: actor.name },
            locationKind: 'fridge',
            locationId: payload.locationId ?? null,
            locationLabel: payload.locationLabel ?? null,
            notes: payload.notes,
          })
        } else if (payload.workflow.workflow_kind === 'reheating') {
          await mutations.completeReheating.mutateAsync({
            workflowId: payload.workflow.id,
            temperature: payload.temperature ?? null,
            completedBy: { id: actor.id, name: actor.name },
            notes: payload.notes,
          })
        }
      } else if (payload.mode === 'hold_check') {
        await mutations.logHotHoldCheck.mutateAsync({
          workflowId: payload.workflow.id,
          temperature: payload.temperature ?? 0,
          correctiveAction: payload.correctiveAction ?? null,
          actor: { id: actor.id, name: actor.name },
          notes: payload.notes,
        })
      } else if (payload.mode === 'stop') {
        await mutations.stopHotHold.mutateAsync({
          workflowId: payload.workflow.id,
          actor: { id: actor.id, name: actor.name },
        })
      }

      setManualActionDialog(null)
      setVoiceActionDialog(null)
    },
    [mutations, staffMembers],
  )

  const continueQuickOperatorAction = useCallback(
    async (
      workflow: HaccpWorkflow,
      action: QuickOperatorAction,
      actorOverride?: { id: string; name: string } | null,
    ) => {
      const actor = actorOverride ?? (selectedStaff ? { id: selectedStaff.id, name: selectedStaff.name } : null)

      if (!actor) {
        const hasAvailableStaff = staffMembers.some((staff) => staff.active !== false)

        if (!hasAvailableStaff) {
          toast.error('Add an active operator before continuing this workflow.')
          return
        }

        setQuickOperatorDialog({ workflow, action })
        return
      }

      if (selectedStaffId !== actor.id) {
        setSelectedStaffId(actor.id)
      }

      if (action === 'transition_to_cooling') {
        await mutations.transitionToCooling.mutateAsync({
          workflowId: workflow.id,
          actor,
        })
        return
      }

      if (action === 'start_reheating') {
        setManualStartDialog({
          kind: 'reheating',
          batchId: workflow.batch_id,
          itemName: workflow.item_name,
          itemCategory: workflow.item_category,
          temperature: workflow.last_temperature ?? null,
        })
        return
      }

      setManualStartDialog({
        kind: 'hot_hold',
        batchId: workflow.batch_id,
        itemName: workflow.item_name,
        itemCategory: workflow.item_category,
        temperature: workflow.last_temperature ?? null,
        locationLabel: 'Hot Pass',
      })
    },
    [mutations.transitionToCooling, selectedStaff, selectedStaffId, staffMembers],
  )

  const handleQuickOperatorSelect = useCallback(
    async (staffId: string) => {
      const pending = quickOperatorDialog
      if (!pending) return

      const actor = staffMembers.find((staff) => staff.id === staffId)
      if (!actor) {
        toast.error('Selected operator could not be found.')
        return
      }

      setQuickOperatorDialog(null)
      await continueQuickOperatorAction(pending.workflow, pending.action, {
        id: actor.id,
        name: actor.name,
      })
    },
    [continueQuickOperatorAction, quickOperatorDialog, staffMembers],
  )

  const openStartWorkflow = useCallback((kind: WorkflowKind) => {
    setVoiceStartDialog(null)
    setManualStartDialog(startContextForKind(kind))
  }, [])

  const handleCardAction = useCallback(
    async (workflow: HaccpWorkflow, action: LegacyHaccpAction) => {
      if (action === 'complete') {
        setManualActionDialog({
          workflow,
          mode: workflow.workflow_kind === 'hot_hold' ? 'hold_check' : 'complete',
        })
        return
      }

      if (action === 'hold_check') {
        setManualActionDialog({ workflow, mode: 'hold_check' })
        return
      }

      if (action === 'stop_hot_hold') {
        setManualActionDialog({ workflow, mode: 'stop' })
        return
      }

      if (action === 'transition_to_cooling') {
        await continueQuickOperatorAction(workflow, action)
        return
      }

      if (action === 'start_reheating') {
        await continueQuickOperatorAction(workflow, action)
        return
      }

      if (action === 'start_hot_hold') {
        await continueQuickOperatorAction(workflow, action)
      }
    },
    [continueQuickOperatorAction],
  )

  const complianceStatus = useMemo(() => {
    if (workflowStats.needsAction > 0) return 'critical'
    if (dueReminders.length > 0) return 'warning'
    return 'ready'
  }, [dueReminders.length, workflowStats.needsAction])

  const voiceStatusTone = useMemo(() => {
    switch (voiceInteraction.state) {
      case 'error':
        return 'text-amber-500'
      case 'wake_ready':
        return 'text-rose-500'
      case 'connecting':
      case 'processing':
        return 'text-purple-500'
      case 'listening':
      case 'flow_active':
        return 'text-green-500'
      case 'speaking':
        return 'text-amber-500'
      default:
        return 'text-theme-muted'
    }
  }, [voiceInteraction.state])

  const voiceStatusSummary = useMemo(() => {
    switch (voiceInteraction.state) {
      case 'wake_ready':
        return `Wake word: "${primaryWakeWordLabel}"`
      case 'connecting':
        return 'Connecting realtime voice'
      case 'processing':
        return 'Processing speech'
      case 'listening':
        return 'Listening for command'
      case 'flow_active':
        return 'Flow active'
      case 'speaking':
        return 'Assistant speaking'
      case 'error':
        return 'Voice error'
      default:
        return 'Voice ready'
    }
  }, [primaryWakeWordLabel, voiceInteraction.state])

  return (
    <div className="min-h-screen bg-theme-primary flex">
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
        siteName={currentSite?.name || 'Kitchen Ops'}
      />

      <div className="flex-1 flex flex-col min-h-screen">
        <DashboardHeader
          complianceStatus={complianceStatus}
          lastAudit="Today"
          autoLogging={true}
          notificationCount={dueReminders.length + unacknowledgedAlerts.length}
          onNotificationsClick={handleNotificationsClick}
        />

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 overflow-auto">
          <section className="mb-8">
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setIsFridgeTempModalOpen(true)}
                className="flex items-center gap-4 px-5 py-4 bg-glass border border-glass rounded-xl hover:bg-theme-ghost transition-all duration-150 group shadow-sm hover:shadow-md"
              >
                <div className="p-3 rounded-lg bg-teal-500/15 text-teal-500 group-hover:bg-teal-500/25 transition-colors">
                  <Thermometer className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-theme-primary">Log Fridge Temp</span>
                  <p className="text-xs text-theme-muted">Fridge monitoring</p>
                </div>
              </button>

              <button
                onClick={() => {
                  openStartWorkflow('cooking')
                }}
                className="flex items-center gap-4 px-5 py-4 bg-glass border border-glass rounded-xl hover:bg-theme-ghost transition-all duration-150 group shadow-sm hover:shadow-md"
              >
                <div className="p-3 rounded-lg bg-amber-500/15 text-amber-500 group-hover:bg-amber-500/25 transition-colors">
                  <Flame className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-theme-primary">Start Cook</span>
                  <p className="text-xs text-theme-muted">Open a cooking workflow</p>
                </div>
              </button>

              <button
                onClick={() => {
                  openStartWorkflow('cooling')
                }}
                className="flex items-center gap-4 px-5 py-4 bg-glass border border-glass rounded-xl hover:bg-theme-ghost transition-all duration-150 group shadow-sm hover:shadow-md"
              >
                <div className="p-3 rounded-lg bg-sky-500/15 text-sky-500 group-hover:bg-sky-500/25 transition-colors">
                  <Snowflake className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-theme-primary">Start Cooling</span>
                  <p className="text-xs text-theme-muted">Track chilled handoff</p>
                </div>
              </button>

              <button
                onClick={() => {
                  openStartWorkflow('reheating')
                }}
                className="flex items-center gap-4 px-5 py-4 bg-glass border border-glass rounded-xl hover:bg-theme-ghost transition-all duration-150 group shadow-sm hover:shadow-md"
              >
                <div className="p-3 rounded-lg bg-orange-500/15 text-orange-500 group-hover:bg-orange-500/25 transition-colors">
                  <Soup className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-theme-primary">Start Reheat</span>
                  <p className="text-xs text-theme-muted">Resume a chilled batch</p>
                </div>
              </button>

              <button
                onClick={() => {
                  openStartWorkflow('hot_hold')
                }}
                className="flex items-center gap-4 px-5 py-4 bg-glass border border-glass rounded-xl hover:bg-theme-ghost transition-all duration-150 group shadow-sm hover:shadow-md"
              >
                <div className="p-3 rounded-lg bg-red-500/15 text-red-500 group-hover:bg-red-500/25 transition-colors">
                  <TimerReset className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-theme-primary">Start Hold</span>
                  <p className="text-xs text-theme-muted">Manage hot hold checks</p>
                </div>
              </button>

              <div className="flex items-center gap-4 px-5 py-4 bg-glass border border-glass rounded-xl shadow-sm">
                <VoiceButton
                  ref={voiceButtonRef}
                  onCommand={handleVoiceCommand}
                  onTranscript={handleVoiceTranscript}
                  onInterimTranscript={handleVoiceInterimTranscript}
                  onEnd={handleVoiceEnd}
                  onInteractionStateChange={handleVoiceInteractionStateChange}
                  size="sm"
                  wakeWordActive={isWakeWordActive}
                  wakeWordTriggerToken={wakeWordTriggerToken}
                  wakeWordLabel={primaryWakeWordLabel}
                  conversationMode={haccpVoice.conversationMode || voiceFridgeFlow.step !== 'idle'}
                  quickResponseMode={voiceFridgeFlow.isQuickResponseStep}
                />
                <div className="text-left">
                  <span className="font-semibold text-theme-primary">Voice Commands</span>
                  <p className={cn('text-xs font-medium', voiceStatusTone)}>{voiceStatusSummary}</p>
                  <p className="text-xs text-theme-muted">
                    {voiceInteraction.detail ||
                      'Try: "Start cook soup", "Start cooling stock", "Soup is at 64 degrees"'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <span className="text-emerald-500 text-xs">✓</span>
              </div>
              <h2 className="text-xs font-semibold text-theme-secondary uppercase tracking-wide">
                Daily Compliance Cycles
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <ProgressCard
                title="HACCP Records"
                value={workflowStats.completionRate}
                status={
                  workflowStats.total === 0
                    ? 'pending'
                    : workflowStats.needsAction > 0
                      ? 'warning'
                      : workflowStats.live > 0
                        ? 'in-progress'
                        : 'complete'
                }
                subtitle={
                  workflowStats.live > 0
                    ? `${workflowStats.live} live workflow${workflowStats.live === 1 ? '' : 's'}`
                    : workflowStats.total === 0
                      ? 'No HACCP activity yet'
                      : 'All current workflows complete'
                }
              />
              <ProgressCard
                title="Corrective Actions"
                value={workflowStats.needsAction === 0 ? 'Clear' : workflowStats.needsAction}
                status={workflowStats.needsAction === 0 ? 'complete' : 'warning'}
                subtitle={
                  workflowStats.needsAction === 0
                    ? 'No open corrective actions'
                    : 'Review flagged batches now'
                }
              />
              <ProgressCard
                title="Hot Hold Checks"
                value={dueReminders.length === 0 ? 'Ready' : dueReminders.length}
                status={
                  dueReminders.length > 0
                    ? 'warning'
                    : workflowStats.hotHoldLive > 0
                      ? 'in-progress'
                      : 'pending'
                }
                subtitle={
                  workflowStats.hotHoldLive > 0
                    ? `${workflowStats.hotHoldLive} hold workflow${workflowStats.hotHoldLive === 1 ? '' : 's'} live`
                    : 'No active hot hold'
                }
              />
            </div>
          </section>

          <LegacyHaccpBoard
            workflows={visibleWorkflows}
            dueReminders={dueReminders.length}
            onAction={handleCardAction}
            onStartWorkflow={openStartWorkflow}
            onOpenHistory={() => handleNavigate('history')}
          />
        </main>

        <button
          onClick={() => {
            setVoiceStartDialog(null)
            setManualStartDialog({ kind: 'cooling' })
          }}
          className="lg:hidden fixed right-4 bottom-20 w-14 h-14 rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30 flex items-center justify-center hover:bg-sky-600 transition-all active:scale-95 z-40"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <MobileNav currentScreen={currentScreen} onNavigate={handleNavigate} />

      <HaccpStartWorkflowDialog
        open={!!startDialog}
        onOpenChange={(open) => {
          if (open) return
          setManualStartDialog(null)
          setVoiceStartDialog(null)
          if (haccpVoice.conversationMode) {
            haccpVoice.cancelConversation()
          }
        }}
        context={startDialog}
        staffOptions={staffMembers.map((staff) => ({ id: staff.id, name: staff.name, staff_code: staff.staff_code }))}
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
        onOpenChange={(open) => {
          if (open) return
          setManualActionDialog(null)
          setVoiceActionDialog(null)
          if (haccpVoice.conversationMode) {
            haccpVoice.cancelConversation()
          }
        }}
        mode={actionDialog?.mode ?? 'complete'}
        workflow={actionDialog?.workflow ?? null}
        prefill={actionDialog?.prefill ?? null}
        staffOptions={staffMembers.map((staff) => ({ id: staff.id, name: staff.name, staff_code: staff.staff_code }))}
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

      <HaccpOperatorQuickPickDialog
        open={!!quickOperatorDialog}
        onOpenChange={(open) => {
          if (open) return
          setQuickOperatorDialog(null)
        }}
        workflow={quickOperatorDialog?.workflow ?? null}
        action={quickOperatorDialog?.action ?? 'transition_to_cooling'}
        staffMembers={staffMembers}
        loading={
          mutations.transitionToCooling.isPending ||
          mutations.startReheating.isPending ||
          mutations.startHotHold.isPending
        }
        onSelect={handleQuickOperatorSelect}
      />

      <FridgeTempModal
        isOpen={isFridgeTempModalOpen}
        onClose={() => {
          setIsFridgeTempModalOpen(false)
          voiceFridgeFlow.reset()
        }}
        preselectedFridgeIndex={preselectedFridgeIndex}
        preselectedTemperature={preselectedFridgeTemp}
        preselectedStaffId={preselectedStaffId}
        voiceStep={voiceFridgeFlow.step}
      />
    </div>
  )
}
