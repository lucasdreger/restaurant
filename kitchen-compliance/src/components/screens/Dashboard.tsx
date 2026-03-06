import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Snowflake, AlertTriangle, Eye, Thermometer } from 'lucide-react'
import { Sidebar, MobileNav } from '@/components/layout/Sidebar'
import { DashboardHeader, ProgressCard } from '@/components/layout/DashboardHeader'
import { CoolingSensorCard } from '@/components/cooling/CoolingSensorCard'
import { StartCoolingModal } from '@/components/cooling/StartCoolingModal'
import { CloseCoolingModal } from '@/components/cooling/CloseCoolingModal'
import { FridgeTempModal } from '@/components/fridge/FridgeTempModal'
import { VoiceButton, type VoiceButtonHandle, type VoiceInteractionState } from '@/components/voice/VoiceButton'
import { useAppStore, getActiveSessions, getOverdueSessions, getUnacknowledgedAlerts, WAKE_WORD_OPTIONS } from '@/store/useAppStore'
import { useCoolingWorkflow } from '@/services/coolingService'
import { useTextToSpeech } from '@/hooks/useVoiceRecognition'
import { useVoiceCloseFlow } from '@/hooks/useVoiceCloseFlow'
import { useVoiceFridgeFlow } from '@/hooks/useVoiceFridgeFlow'
import { useWakeWord, playWakeSound, getPrimaryWakeWordLabel } from '@/hooks/useWakeWord'
import { getFridges, logFridgeTemp } from '@/services/fridgeService'
import { parseVoiceCommand } from '@/lib/voiceCommands'
import { cn } from '@/lib/utils'
import { isLike } from '@/lib/stringUtils'
import { useCoolingSessions } from '@/hooks/queries/useCooling'
import { useStaff } from '@/hooks/queries/useStaff'
import type { FoodItemPreset, VoiceCommand, CloseCoolingData, CoolingSession } from '@/types'
import { toast } from 'sonner'

interface DashboardProps {
  onNavigate?: (screen: string) => void
  currentScreen?: string
}

export function Dashboard({ onNavigate, currentScreen = 'home' }: DashboardProps) {
  const [isStartModalOpen, setIsStartModalOpen] = useState(false)
  const [closeModalSessionId, setCloseModalSessionId] = useState<string | null>(null)
  const [isFridgeTempModalOpen, setIsFridgeTempModalOpen] = useState(false)
  const [preselectedFridgeIndex, setPreselectedFridgeIndex] = useState<number | undefined>(undefined)
  const [preselectedFridgeTemp, setPreselectedFridgeTemp] = useState<number | null>(null)
  const [preselectedStaffId, setPreselectedStaffId] = useState<string | null>(null)

  const [fridges, setFridges] = useState<any[]>([])

  const [wakeWordTriggerToken, setWakeWordTriggerToken] = useState(0)
  const [isFlowTransitioning, setIsFlowTransitioning] = useState(false)
  const [isWakeWordSuppressed, setIsWakeWordSuppressed] = useState(false)
  const [voiceInteraction, setVoiceInteraction] = useState<{ state: VoiceInteractionState; detail?: string }>({
    state: 'idle',
  })

  const { currentSite, alerts, acknowledgeAlert, settings } = useAppStore()

  // React Query Hooks
  const { data: coolingSessions = [] } = useCoolingSessions(currentSite?.id)
  const { data: staffMembers = [] } = useStaff(currentSite?.id)

  const {
    startCooling,
    closeCooling,
    deleteCooling,
    updateSessionStatuses
  } = useCoolingWorkflow()
  const { speak } = useTextToSpeech()

  const voiceButtonRef = useRef<VoiceButtonHandle>(null)
  const requestFlowInput = useCallback(() => {
    // Ensure prompt audio is never captured as user input.
    voiceButtonRef.current?.stopVoice()

    const delayMs = 120
    setTimeout(() => {
      console.log('[Dashboard] Flow requesting input - triggering mic')
      voiceButtonRef.current?.triggerVoice()
    }, delayMs)
  }, [])

  const speakForFlow = useCallback(
    (
      text: string,
      options?: { rate?: number; pitch?: number; onComplete?: () => void; preferBrowser?: boolean }
    ) => {
      // Use deterministic TTS for flow prompts.
      // Realtime synthesized responses can be inaudible in some autoplay/mic states.
      voiceButtonRef.current?.stopVoice()
      speak(text, { ...options, preferBrowser: true })
    },
    [speak]
  )

  // Session data
  const activeSessions = useMemo(() => getActiveSessions(coolingSessions), [coolingSessions])
  const overdueSessions = useMemo(() => getOverdueSessions(coolingSessions), [coolingSessions])
  const unacknowledgedAlerts = useMemo(() => getUnacknowledgedAlerts(alerts), [alerts])
  const sessionReferenceMap = useMemo(() => {
    return new Map(activeSessions.map((session, index) => [session.id, index + 1]))
  }, [activeSessions])
  const sessionToClose = useMemo(
    () => coolingSessions.find((s) => s.id === closeModalSessionId) || null,
    [coolingSessions, closeModalSessionId]
  )

  // Update statuses periodically
  useEffect(() => {
    const interval = setInterval(updateSessionStatuses, 10000)
    return () => clearInterval(interval)
  }, [updateSessionStatuses])

  // Determine compliance status
  const complianceStatus = useMemo(() => {
    if (overdueSessions.length > 0) return 'critical'
    if (activeSessions.some(s => s.status === 'warning')) return 'warning'
    return 'ready'
  }, [activeSessions, overdueSessions])

  // Handlers
  const handleStartCooling = useCallback(
    async (itemName: string, category: FoodItemPreset['category']) => {
      // Clean up item name (remove trailing punctuation often added by dictation)
      const cleanName = itemName.replace(/[.,;!?]+$/, '').trim()
      const session = await startCooling(cleanName, category)
      if (session) {
        speak(`Cooling started for ${cleanName}`)
      }
    },
    [startCooling, speak]
  )

  const handleOpenCloseModal = useCallback((sessionId: string) => {
    setCloseModalSessionId(sessionId)
  }, [])

  const handleManualConfirmClose = useCallback(
    async (data: CloseCoolingData) => {
      if (!closeModalSessionId) return
      await closeCooling(closeModalSessionId, data)
      setCloseModalSessionId(null)
    },
    [closeModalSessionId, closeCooling]
  )


  const commonOnStopListening = useCallback(() => {
    console.log('[Dashboard] Stop listening requested by flow')
    if (voiceButtonRef.current) {
      voiceButtonRef.current.stopVoice()
    }
  }, [])

  const voiceCloseFlow = useVoiceCloseFlow({
    sessions: activeSessions,
    staffMembers,
    onConfirm: async (sessionId, data) => {
      await closeCooling(sessionId, data)
      setCloseModalSessionId(null)
    },
    onOpenModal: (sessionId) => setCloseModalSessionId(sessionId),
    onCloseModal: () => setCloseModalSessionId(null),
    speak: speakForFlow,
    onAwaitingInput: requestFlowInput,
    onStopListening: commonOnStopListening
  })

  // Load fridges for the voice flow
  useEffect(() => {
    if (currentSite?.id) {
      getFridges(currentSite.id).then(setFridges).catch(() => { })
    }
  }, [currentSite?.id])

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
        recorded_by_name: staffMembers.find(s => s.id === data.staffId)?.name
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
    onStopListening: commonOnStopListening
  })

  // Sync voice fridge flow state with modal props
  useEffect(() => {
    setPreselectedFridgeTemp(voiceFridgeFlow.temperature)
    setPreselectedStaffId(voiceFridgeFlow.staffId)
  }, [voiceFridgeFlow.temperature, voiceFridgeFlow.staffId])

  const resumeListeningRef = useRef<() => void>(() => { })
  const flowTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const wakeWordSuppressTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
    // Protect against race: command mode ends before flow state flips to awaiting_*.
    setIsFlowTransitioning(true)

    if (flowTransitionTimeoutRef.current) {
      clearTimeout(flowTransitionTimeoutRef.current)
    }

    flowTransitionTimeoutRef.current = setTimeout(() => {
      setIsFlowTransitioning(false)
      flowTransitionTimeoutRef.current = null
    }, 1500)
  }, [])

  // Cleanup transition timer on unmount
  useEffect(() => {
    return () => {
      if (flowTransitionTimeoutRef.current) {
        clearTimeout(flowTransitionTimeoutRef.current)
      }
      if (wakeWordSuppressTimeoutRef.current) {
        clearTimeout(wakeWordSuppressTimeoutRef.current)
      }
    }
  }, [])


  const handleDiscardCooling = useCallback(async (sessionId: string) => {
    // For now, simple confirm. In production would use a nice modal
    if (window.confirm('Are you sure you want to discard this item? This record will be deleted.')) {
      await deleteCooling(sessionId)
      toast.error('Cooling record deleted')
    }
  }, [deleteCooling])

  // Ref to prevent double execution (Immediate vs Whisper)
  const lastCommandHandledAt = useRef<number>(0)
  const isFlowInProgress = voiceCloseFlow.step !== 'idle' || voiceFridgeFlow.step !== 'idle'
  const isFlowActive = isFlowTransitioning || isFlowInProgress
  const isVoiceInteractionBusy = useMemo(
    () =>
      voiceInteraction.state === 'connecting' ||
      voiceInteraction.state === 'listening' ||
      voiceInteraction.state === 'processing' ||
      voiceInteraction.state === 'speaking' ||
      voiceInteraction.state === 'flow_active',
    [voiceInteraction.state]
  )
  const previousFlowInProgressRef = useRef(isFlowInProgress)
  const wakeWordResumeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Once flow is truly active, transition guard is no longer needed.
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
        if (wakeWordResumeTimeoutRef.current) {
          clearTimeout(wakeWordResumeTimeoutRef.current)
        }

        wakeWordResumeTimeoutRef.current = setTimeout(() => {
          if (isFlowActive || isVoiceInteractionBusy) return
          console.log('[Dashboard] Flow completed, resuming wake word...')
          resumeListeningRef.current()
        }, 650)
      }
    }
    previousFlowInProgressRef.current = isFlowInProgress
  }, [
    isFlowActive,
    isFlowInProgress,
    isVoiceInteractionBusy,
    settings.voiceProvider,
    settings.wakeWordEnabled,
  ])

  useEffect(() => {
    return () => {
      if (wakeWordResumeTimeoutRef.current) {
        clearTimeout(wakeWordResumeTimeoutRef.current)
      }
    }
  }, [])

  const handleVoiceCommand = useCallback(
    (command: VoiceCommand) => {
      // Prevent double execution if immediate command handled it recently
      if (Date.now() - lastCommandHandledAt.current < 2000) {
        console.log('[Dashboard] Ignoring duplicate voice command (handled explicitly/immediately)')
        return
      }
      lastCommandHandledAt.current = Date.now()

      console.log('[Dashboard] Handling voice command:', command)

      switch (command.type) {
        case 'start_cooling':
          if (command.item) {
            handleStartCooling(command.item, 'other')
          } else {
            setIsStartModalOpen(true)
          }
          suppressWakeWordTemporarily()
          break
        case 'stop_cooling':
          beginFlowTransition()
          voiceCloseFlow.startFlow(command.item)
          break
        case 'discard':
          if (activeSessions.length > 0) {
            handleDiscardCooling(activeSessions[0].id)
          }
          suppressWakeWordTemporarily()
          break
        case 'log_fridge_temp':
          beginFlowTransition()
          voiceFridgeFlow.startFlow(command.fridgeNumber)
          break
      }

      // Resume wake word listening after a short delay (only if not starting a flow)
      if (settings.wakeWordEnabled && command.type !== 'stop_cooling' && command.type !== 'log_fridge_temp' && !isFlowActive && !isVoiceInteractionBusy) {
        console.log('[Dashboard] Will resume wake word in 1s...')
        setTimeout(() => {
          console.log('[Dashboard] Resuming wake word...')
          resumeListeningRef.current()
        }, 1000)
      }
    },
    [activeSessions, handleStartCooling, handleDiscardCooling, settings.wakeWordEnabled, voiceCloseFlow, voiceFridgeFlow, isFlowActive, isVoiceInteractionBusy, beginFlowTransition, suppressWakeWordTemporarily]
  )

  const inferStopItemFromNoisySpeech = useCallback(
    (rawTranscript: string): string | null => {
      if (activeSessions.length === 0) return null

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

      const stopHints = ['finish', 'done', 'stop', 'close', 'pull', 'pulling', 'fridge', 'move', 'cooling', 'coolin', 'kulin', 'comi', 'finis']
      const hasStopHint = stopHints.some((hint) => normalized.includes(hint)) ||
        tokens.some((token) => stopHints.some((hint) => isLike(token, hint, 2)))

      let bestMatch: { item: string; score: number } | null = null

      for (const session of activeSessions) {
        const itemNormalized = session.item_name
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
          bestMatch = { item: session.item_name, score }
        }
      }

      if (!bestMatch) return null
      const threshold = hasStopHint ? 2 : 3
      return bestMatch.score >= threshold ? bestMatch.item : null
    },
    [activeSessions]
  )

  const handleVoiceTranscript = useCallback((transcript: string) => {
    console.log('[Dashboard] Transcript received:', transcript)
    if (voiceCloseFlow.step !== 'idle') {
      voiceCloseFlow.handleTranscript(transcript)
    } else if (voiceFridgeFlow.step !== 'idle') {
      voiceFridgeFlow.handleTranscript(transcript)
    } else {
      const parsedCommand = parseVoiceCommand(transcript)
      if (parsedCommand.type === 'noise' || parsedCommand.type === 'unknown') {
        const inferredItem = inferStopItemFromNoisySpeech(transcript)
        if (inferredItem) {
          console.log('[Dashboard] Inferred noisy transcript as stop_cooling:', inferredItem)
          handleVoiceCommand({ type: 'stop_cooling', item: inferredItem })
        }
      }
    }
  }, [voiceCloseFlow, voiceFridgeFlow, inferStopItemFromNoisySpeech, handleVoiceCommand])

  const handleVoiceInterimTranscript = useCallback((transcript: string) => {
    if (voiceCloseFlow.step !== 'idle') {
      voiceCloseFlow.checkInterimTranscript(transcript)
    } else if (voiceFridgeFlow.step !== 'idle') {
      voiceFridgeFlow.checkInterimTranscript(transcript)
    }
  }, [voiceCloseFlow, voiceFridgeFlow])

  const handleVoiceEnd = useCallback(() => {
    // ONLY resume wake word if we are NOT in the middle of a voice flow
    if (settings.wakeWordEnabled && !isFlowActive && !isVoiceInteractionBusy) {
      console.log('[Dashboard] Voice ended, resuming wake word...')
      resumeListeningRef.current()
    } else {
      console.log('[Dashboard] Voice ended, but flow active - skipping wake word resume')
    }
  }, [settings.wakeWordEnabled, isFlowActive, isVoiceInteractionBusy])

  const handleVoiceInteractionStateChange = useCallback((state: VoiceInteractionState, detail?: string) => {
    setVoiceInteraction((current) => {
      if (current.state === state && current.detail === detail) return current
      return { state, detail }
    })
  }, [])

  const handleWakeWordHeard = useCallback(() => {
    if (isVoiceInteractionBusy) return
    console.log('[Dashboard] Wake word heard (interim) - Optimistic Trigger!')
    playWakeSound()
    // In realtime mode, wait for final wake-word detection before opening mic.
    // This avoids racing browser wake-word ASR with the realtime session start.
    if (settings.voiceProvider === 'realtime') return

    // Delay triggering recording slightly to let sound finish (avoids capturing beep)
    setTimeout(() => {
      setWakeWordTriggerToken((token) => token + 1)
    }, 400)
  }, [isVoiceInteractionBusy, settings.voiceProvider])

  const handleWakeWordDetected = useCallback(() => {
    if (isVoiceInteractionBusy) return
    console.log('[Dashboard] Wake word fully detected (final)')
    if (Date.now() - lastCommandHandledAt.current < 1500) {
      console.log('[Dashboard] Skipping wake-word mic trigger because immediate command already handled')
      return
    }

    // Realtime mode starts capture on final wake-word detection.
    if (settings.voiceProvider === 'realtime') {
      setWakeWordTriggerToken((token) => token + 1)
    }
  }, [isVoiceInteractionBusy, settings.voiceProvider])

  const handleImmediateCommand = useCallback((command: string) => {
    console.log('[Dashboard] Immediate command after wake word:', command)

    // If we are in the middle of a voice flow, prioritize the flow instead of parsing a new command
    if (voiceCloseFlow.step !== 'idle') {
      console.log('[Dashboard] Close flow active, passing text to flow handler:', command)
      voiceCloseFlow.handleTranscript(command)
      return
    }

    if (voiceFridgeFlow.step !== 'idle') {
      console.log('[Dashboard] Fridge flow active, passing text to flow handler:', command)
      voiceFridgeFlow.handleTranscript(command)
      return
    }

    const parsedCommand = parseVoiceCommand(command)
    console.log('[Dashboard] Parsed command:', parsedCommand)

    if (parsedCommand.type === 'noise') {
      const normalized = command
        .toLowerCase()
        .replace(/[^\w\s.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      // Wake-word ASR often turns "finish cooling pasta" into "is cooling pasta".
      // In immediate-command context, infer stop_cooling when we have "cooling <item>".
      const coolingTail = normalized.match(/\bcooling\s+(.+)$/i)
      const looksLikeStart = /\b(start|begin|new)\b/i.test(normalized)
      if (coolingTail && !looksLikeStart) {
        const inferredItem = coolingTail[1]?.trim()
        if (inferredItem) {
          console.log('[Dashboard] Inferred noisy immediate command as stop_cooling:', inferredItem)
          handleVoiceCommand({ type: 'stop_cooling', item: inferredItem })
          return
        }
      }

      const inferredSessionItem = inferStopItemFromNoisySpeech(command)
      if (inferredSessionItem) {
        console.log('[Dashboard] Inferred session item from noisy immediate command:', inferredSessionItem)
        handleVoiceCommand({ type: 'stop_cooling', item: inferredSessionItem })
        return
      }

      console.log('[Dashboard] Immediate command too noisy/incomplete, falling back to command capture')
      if (voiceButtonRef.current) {
        voiceButtonRef.current.triggerVoice()
      }
      return
    }

    if (parsedCommand.type !== 'unknown') {
      console.log('[Dashboard] Executing command:', parsedCommand)
      handleVoiceCommand(parsedCommand)
    } else {
      const inferredSessionItem = inferStopItemFromNoisySpeech(command)
      if (inferredSessionItem) {
        console.log('[Dashboard] Inferred session item from unknown immediate command:', inferredSessionItem)
        handleVoiceCommand({ type: 'stop_cooling', item: inferredSessionItem })
        return
      }

      console.log('[Dashboard] Unknown command, will wait for VoiceButton')
      if (voiceButtonRef.current) {
        voiceButtonRef.current.triggerVoice()
      }

      // Resume wake word even for unknown commands
      if (settings.wakeWordEnabled) {
        setTimeout(() => {
          if (isVoiceInteractionBusy || isFlowActive) return
          console.log('[Dashboard] Resuming wake word after unknown command...')
          resumeListeningRef.current()
        }, 2000) // Give user time to hear the feedback
      }
    }
  }, [handleVoiceCommand, inferStopItemFromNoisySpeech, isFlowActive, isVoiceInteractionBusy, settings.wakeWordEnabled, voiceCloseFlow, voiceFridgeFlow])

  const activeWakeWordPhrases = useMemo(() => {
    const activeIds = settings.activeWakeWords || ['luma']
    return activeIds.flatMap(id => {
      const option = WAKE_WORD_OPTIONS.find(o => o.id === id)
      return option ? option.phrases : []
    })
  }, [settings.activeWakeWords])

  const primaryWakeWordLabel = useMemo(() => {
    return getPrimaryWakeWordLabel(activeWakeWordPhrases)
  }, [activeWakeWordPhrases])

  const { isActive: isWakeWordActive, resumeListening } = useWakeWord({
    onWakeWordHeard: handleWakeWordHeard,
    onWakeWordDetected: handleWakeWordDetected,
    // Keep immediate command detection enabled for all providers.
    // This is required for one-breath commands like:
    // "Luma finish cooling pasta" / "Luma start cooling pasta".
    onCommandDetected: handleImmediateCommand,
    // Suspend wake-word while the interview flow is active, otherwise SpeechRecognition instances
    // will fight each other and abort staff-code/temp capture.
    enabled: settings.wakeWordEnabled && !isFlowActive && !isVoiceInteractionBusy && !isWakeWordSuppressed,
    language: settings.language === 'en' ? 'en-IE' : settings.language,
    wakeWords: activeWakeWordPhrases,
  })

  useEffect(() => {
    resumeListeningRef.current = resumeListening
  }, [resumeListening])

  const handleNavigate = useCallback((screen: string) => {
    onNavigate?.(screen)
  }, [onNavigate])

  const handleNotificationsClick = useCallback(() => {
    if (unacknowledgedAlerts.length === 0) {
      toast.info('No new notifications')
      return
    }

    // Show alerts in toast and acknowledge them
    unacknowledgedAlerts.forEach((alert, index) => {
      setTimeout(() => {
        if (alert.type === 'overdue') {
          toast.error(alert.message, { duration: 5000 })
        } else {
          toast.warning(alert.message, { duration: 5000 })
        }
        acknowledgeAlert(alert.id)
      }, index * 500) // Stagger toasts
    })
  }, [unacknowledgedAlerts, acknowledgeAlert])

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
      {/* Desktop Sidebar */}
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
        siteName={currentSite?.name || 'Kitchen Ops'}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <DashboardHeader
          complianceStatus={complianceStatus}
          lastAudit="Today"
          autoLogging={true}
          notificationCount={unacknowledgedAlerts.length}
          onNotificationsClick={handleNotificationsClick}
        />

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 overflow-auto">
          {/* Quick Actions */}
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
                  <p className="text-xs text-theme-muted">FSAI SC1 Compliance</p>
                </div>
              </button>

              <button
                onClick={() => setIsStartModalOpen(true)}
                className="flex items-center gap-4 px-5 py-4 bg-glass border border-glass rounded-xl hover:bg-theme-ghost transition-all duration-150 group shadow-sm hover:shadow-md"
              >
                <div className="p-3 rounded-lg bg-sky-500/15 text-sky-500 group-hover:bg-sky-500/25 transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-theme-primary">Start Cooling</span>
                  <p className="text-xs text-theme-muted">Track hot food</p>
                </div>
              </button>

              {/* Voice Commands Button */}
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
                  conversationMode={voiceCloseFlow.step !== 'idle' || voiceFridgeFlow.step !== 'idle'}
                  quickResponseMode={voiceCloseFlow.isQuickResponseStep || voiceFridgeFlow.isQuickResponseStep}
                />
                <div className="text-left">
                  <span className="font-semibold text-theme-primary">Voice Commands</span>
                  <p className={cn('text-xs font-medium', voiceStatusTone)}>{voiceStatusSummary}</p>
                  <p className="text-xs text-theme-muted">{voiceInteraction.detail || 'Say "Start cooling" or "Finish cooling 1"'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Daily Progress Section */}
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
                title="Cooling Records"
                value={
                  coolingSessions.length === 0
                    ? 0
                    : Math.round(
                      (coolingSessions.filter((s: CoolingSession) => s.status === 'closed').length /
                        coolingSessions.length) *
                      100
                    )
                }
                status={
                  coolingSessions.length === 0
                    ? 'pending'
                    : coolingSessions.every((s: CoolingSession) => s.status === 'closed')
                      ? 'complete'
                      : 'in-progress'
                }
                subtitle={
                  activeSessions.length > 0
                    ? `${activeSessions.length} active`
                    : coolingSessions.length === 0
                      ? 'No sessions today'
                      : 'All complete'
                }
              />
              <ProgressCard
                title="Mid-Day Logs"
                value={65}
                status="in-progress"
                subtitle="Next: 15:00 Probe Test"
              />
              <ProgressCard
                title="Closing Routine"
                value="Pending"
                status="pending"
                subtitle="Starts at 22:30 PM"
              />
            </div>
          </section>

          {/* Critical Actions - Overdue */}
          {overdueSessions.length > 0 && (
            <section className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide">
                    Critical Actions
                  </h2>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                    {overdueSessions.length} ALERT{overdueSessions.length > 1 ? 'S' : ''}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {overdueSessions.map((session) => (
                  <CoolingSensorCard
                    key={session.id}
                    session={session}
                    onClose={handleOpenCloseModal}
                    onDiscard={handleDiscardCooling}
                    referenceNumber={sessionReferenceMap.get(session.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Active Cooling Section */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-sky-500" />
                <h2 className="text-sm font-semibold text-theme-secondary uppercase tracking-wide">
                  Active Cooling Monitors
                </h2>
                {activeSessions.length > 0 && (
                  <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-xs font-bold rounded-full">
                    {activeSessions.filter(s => s.status !== 'overdue').length}
                  </span>
                )}
              </div>
              <button className="text-sm text-sky-600 font-medium hover:underline flex items-center gap-1">
                <Eye className="w-4 h-4" />
                View All
              </button>
            </div>

            {activeSessions.filter(s => s.status !== 'overdue').length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeSessions
                  .filter(s => s.status !== 'overdue')
                  .map((session) => (
                    <CoolingSensorCard
                      key={session.id}
                      session={session}
                      onClose={handleOpenCloseModal}
                      onDiscard={handleDiscardCooling}
                      referenceNumber={sessionReferenceMap.get(session.id)}
                    />
                  ))}
              </div>
            ) : (
              <div className="bg-theme-card rounded-2xl border border-theme-primary p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-theme-secondary flex items-center justify-center mx-auto mb-4">
                  <Snowflake className="w-8 h-8 text-theme-muted" />
                </div>
                <h3 className="text-lg font-semibold text-theme-primary mb-2">
                  No Active Cooling
                </h3>
                <p className="text-theme-secondary mb-6 max-w-sm mx-auto">
                  All items have been processed. Start a new cooling session when needed.
                </p>
                <button
                  onClick={() => setIsStartModalOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-sky-500 text-white rounded-xl font-semibold hover:bg-sky-600 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Start Cooling
                </button>
              </div>
            )}
          </section>

        </main>

        {/* Floating Action Button - Mobile */}
        <button
          onClick={() => setIsStartModalOpen(true)}
          className="lg:hidden fixed right-4 bottom-20 w-14 h-14 rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30 flex items-center justify-center hover:bg-sky-600 transition-all active:scale-95 z-40"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Navigation */}
      <MobileNav currentScreen={currentScreen} onNavigate={handleNavigate} />

      {/* Modals */}
      <StartCoolingModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        onStart={handleStartCooling}
      />
      <CloseCoolingModal
        key={`${closeModalSessionId ?? 'none'}-${voiceCloseFlow.staffId ?? 'none'}-${voiceCloseFlow.temperature ?? 'none'}`}
        isOpen={closeModalSessionId !== null}
        onClose={() => {
          setCloseModalSessionId(null)
          voiceCloseFlow.reset()
        }}
        onConfirm={handleManualConfirmClose}
        session={sessionToClose}
        preselectedStaffId={voiceCloseFlow.staffId}
        preselectedTemperature={voiceCloseFlow.temperature ?? null}
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
      />
    </div>
  )
}
