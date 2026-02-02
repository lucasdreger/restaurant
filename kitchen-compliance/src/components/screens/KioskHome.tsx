import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Snowflake, History, AlertTriangle, Mic, Thermometer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CoolingCard } from '@/components/cooling/CoolingCard'
import { StartCoolingModal } from '@/components/cooling/StartCoolingModal'
import { CloseCoolingModal } from '@/components/cooling/CloseCoolingModal'
import { FridgeTempModal } from '@/components/fridge/FridgeTempModal'
import { VoiceButton, type VoiceButtonHandle } from '@/components/voice/VoiceButton'
import { StatusHeader } from '@/components/layout/StatusHeader'
import { useAppStore, getActiveSessions, getOverdueSessions, WAKE_WORD_OPTIONS } from '@/store/useAppStore'
import { useCoolingWorkflow } from '@/services/coolingService'
import type { FoodItemPreset, VoiceCommand, CoolingSession, CloseCoolingData } from '@/types'
import { useTextToSpeech } from '@/hooks/useVoiceRecognition'
import { useVoiceCloseFlow } from '@/hooks/useVoiceCloseFlow'
import { useWakeWord, playWakeSound, getPrimaryWakeWordLabel } from '@/hooks/useWakeWord'
import { parseVoiceCommand } from '@/lib/voiceCommands'

interface KioskHomeProps {
  onNavigateToHistory?: () => void
  onNavigateToSettings?: () => void
}

export function KioskHome({
  onNavigateToHistory,
  onNavigateToSettings,
}: KioskHomeProps) {
  const [isStartModalOpen, setIsStartModalOpen] = useState(false)
  const [closeModalSessionId, setCloseModalSessionId] = useState<string | null>(null)
  const [wakeWordTriggered, setWakeWordTriggered] = useState(false)
  const [isFridgeTempModalOpen, setIsFridgeTempModalOpen] = useState(false)

  const { coolingSessions, settings, staffMembers } = useAppStore()
  const { startCooling, closeCooling, discardCooling, updateSessionStatuses } = useCoolingWorkflow()
  const { speak } = useTextToSpeech()

  // Ref to trigger voice button programmatically
  const voiceButtonRef = useRef<VoiceButtonHandle>(null)

  // Get active wake words from settings
  const activeWakeWordPhrases = useMemo(() => {
    const activeIds = settings.activeWakeWords || ['luma']
    return activeIds.flatMap(id => {
      const option = WAKE_WORD_OPTIONS.find(o => o.id === id)
      return option ? option.phrases : []
    })
  }, [settings.activeWakeWords])

  // Get primary wake word for display
  const primaryWakeWordLabel = useMemo(() => {
    return getPrimaryWakeWordLabel(activeWakeWordPhrases)
  }, [activeWakeWordPhrases])

  // Get the session being closed for the modal
  const sessionToClose = useMemo(
    () => coolingSessions.find((s) => s.id === closeModalSessionId) || null,
    [coolingSessions, closeModalSessionId]
  )

  // Use memoized selectors
  const activeSessions = useMemo(() => getActiveSessions(coolingSessions), [coolingSessions])
  const overdueSessions = useMemo(() => getOverdueSessions(coolingSessions), [coolingSessions])
  const sessionReferenceMap = useMemo(() => {
    return new Map(activeSessions.map((session, index) => [session.id, index + 1]))
  }, [activeSessions])

  // Update session statuses every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      updateSessionStatuses()
    }, 10000)
    return () => clearInterval(interval)
  }, [updateSessionStatuses])

  // Handle starting a new cooling session
  const handleStartCooling = useCallback(
    async (itemName: string, category: FoodItemPreset['category']) => {
      const session = await startCooling(itemName, category)
      if (session) {
        speak(`Cooling started for ${itemName}`)
      }
    },
    [startCooling, speak]
  )

  // Open the close modal for a session
  const handleOpenCloseModal = useCallback((sessionId: string) => {
    setCloseModalSessionId(sessionId)
  }, [])

  const handleVoiceOpenCloseModal = useCallback((sessionId: string) => {
    setCloseModalSessionId(sessionId)
  }, [])

  // Handle auto-start voice listening after TTS completes
  const handleAwaitingInput = useCallback(() => {
    console.log('[KioskHome] Voice flow awaiting input - triggering voice button after TTS')
    // Delay to ensure TTS audio has completely finished playing
    // and system isn't capturing its own voice
    setTimeout(() => {
      if (voiceButtonRef.current) {
        voiceButtonRef.current.triggerVoice()
      }
    }, 800) // 800ms delay to avoid capturing TTS echo
  }, [])

  // Handle stopping voice listening when valid input is detected (called by checkInterimTranscript)
  const handleStopListening = useCallback(() => {
    console.log('[KioskHome] Stopping listening - valid input detected')
    if (voiceButtonRef.current) {
      voiceButtonRef.current.stopVoice()
    }
  }, [])

  // Handle closing a cooling session with temperature data
  const voiceCloseFlow = useVoiceCloseFlow({
    sessions: activeSessions,
    staffMembers,
    onConfirm: async (sessionId, data) => {
      await closeCooling(sessionId, data)
      setCloseModalSessionId(null)
    },
    onOpenModal: handleVoiceOpenCloseModal,
    onCloseModal: () => setCloseModalSessionId(null),
    speak,
    onAwaitingInput: handleAwaitingInput,
    onStopListening: handleStopListening, // Stop listening immediately when valid input detected
  })

  // Handle confirming close
  const handleConfirmClose = useCallback(
    async (data: CloseCoolingData) => {
      if (!closeModalSessionId) return

      const success = await closeCooling(closeModalSessionId, data)
      if (success) {
        const tempMsg = data.temperature !== undefined
          ? ` at ${data.temperature} degrees celsius`
          : ''
        speak(`Item moved to fridge${tempMsg}. Well done!`, {
          onComplete: () => {
            // Resume wake word listening after completion message
            if (settings.wakeWordEnabled) {
              setTimeout(() => resumeListening(), 500)
            }
          }
        })
        setCloseModalSessionId(null)
        voiceCloseFlow.reset()
      }
    },
    [closeModalSessionId, closeCooling, speak, voiceCloseFlow]
  )

  // Handle discarding a cooling session
  const handleDiscardCooling = useCallback(
    async (sessionId: string) => {
      const success = await discardCooling(sessionId)
      if (success) {
        speak('Item discarded and logged')
      }
    },
    [discardCooling, speak]
  )

  // Interim wake word detection (fast feedback)
  const handleWakeWordHeard = useCallback(() => {
    console.log('[KioskHome] Wake word heard (interim)')
    playWakeSound()
    setWakeWordTriggered(true)
  }, [])

  // Wake word detection - ready for command mode
  const handleWakeWordDetected = useCallback(() => {
    console.log('[KioskHome] Wake word detected (final) - triggering command mode INSTANTLY')

    // Trigger the voice button IMMEDIATELY (no delay for wake word)
    if (voiceButtonRef.current) {
      voiceButtonRef.current.triggerVoice()
    }
  }, [])

  // Forward declaration for handleVoiceCommand used in handleImmediateCommand
  const handleVoiceCommandRef = useRef<(command: VoiceCommand) => void>(() => { })

  const handleImmediateCommand = useCallback((command: string) => {
    console.log('[KioskHome] Immediate command after wake word:', command)
    const parsedCommand = parseVoiceCommand(command)
    if (parsedCommand.type !== 'unknown') {
      handleVoiceCommandRef.current(parsedCommand)
    }
  }, [])

  const { isActive: isWakeWordActive, resumeListening } = useWakeWord({
    onWakeWordHeard: handleWakeWordHeard,
    onWakeWordDetected: handleWakeWordDetected,
    onCommandDetected: handleImmediateCommand,
    enabled: settings.wakeWordEnabled,
    language: settings.language === 'en' ? 'en-IE' : settings.language,
    wakeWords: activeWakeWordPhrases,
  })

  // Handle voice commands
  const handleVoiceCommand = useCallback(
    (command: VoiceCommand) => {
      // Reset wake word triggered state
      setWakeWordTriggered(false)

      switch (command.type) {
        case 'start_cooling':
          if (command.item) {
            handleStartCooling(command.item, 'other')
          } else {
            setIsStartModalOpen(true)
          }
          break
        case 'stop_cooling':
          voiceCloseFlow.startFlow(command.item)
          break
        case 'discard':
          // Discard the most recent active session
          if (activeSessions.length > 0) {
            handleDiscardCooling(activeSessions[0].id)
          }
          break
        default:
          // Unknown command - feedback provided in VoiceButton
          break
      }

      // Resume wake word listening after command processed
      if (settings.wakeWordEnabled) {
        resumeListening()
      }
    },
    [activeSessions, handleStartCooling, handleDiscardCooling, settings.wakeWordEnabled, resumeListening, voiceCloseFlow]
  )

  // Update ref
  useEffect(() => {
    handleVoiceCommandRef.current = handleVoiceCommand
  }, [handleVoiceCommand])

  // Handle when voice button finishes (for resuming wake word)
  const handleVoiceEnd = useCallback(() => {
    setWakeWordTriggered(false)
    if (settings.wakeWordEnabled) {
      resumeListening()
    }
  }, [settings.wakeWordEnabled, resumeListening])

  const hasOverdue = overdueSessions.length > 0
  const hasActive = activeSessions.length > 0

  return (
    <div className="min-h-screen bg-theme-primary flex flex-col">
      <StatusHeader onSettingsClick={onNavigateToSettings} />

      <main className="flex-1 p-4 pb-24 overflow-auto">
        {/* Overdue Sessions (Priority Display) */}
        {hasOverdue && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
              <h2 className="text-lg font-bold text-red-400">
                Action Required ({overdueSessions.length})
              </h2>
            </div>
            <div className="space-y-4">
              {overdueSessions.map((session: CoolingSession) => (
                <CoolingCard
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

        {/* Active Cooling Sessions */}
        {hasActive && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-sky-400" />
                <h2 className="text-lg font-bold text-theme-secondary">
                  Cooling ({activeSessions.filter((s: CoolingSession) => s.status !== 'overdue').length})
                </h2>
              </div>
              <span className="text-xs text-theme-muted">FSAI SC3</span>
            </div>
            <div className="space-y-4">
              {activeSessions
                .filter((s: CoolingSession) => s.status !== 'overdue')
                .map((session: CoolingSession, index: number) => (
                  <CoolingCard
                    key={session.id}
                    session={session}
                    onClose={handleOpenCloseModal}
                    onDiscard={handleDiscardCooling}
                    compact={activeSessions.length > 3 && index > 0}
                    referenceNumber={sessionReferenceMap.get(session.id)}
                  />
                ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!hasActive && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-6 bg-theme-secondary rounded-full mb-6">
              <Snowflake className="w-16 h-16 text-theme-muted" />
            </div>
            <h2 className="text-2xl font-bold text-theme-secondary mb-2">
              No items cooling
            </h2>
            <p className="text-theme-muted max-w-sm mb-6">
              Tap the button below or use voice commands to start tracking
              cooked food that needs to cool before refrigeration.
            </p>

            {/* Voice Command Hints */}
            <div className="bg-theme-secondary rounded-xl p-4 max-w-sm w-full border border-theme-primary">
              <div className="flex items-center gap-2 mb-3">
                <Mic className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-theme-secondary">Voice Commands</span>
              </div>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-theme-muted">"</span>
                  <span className="text-purple-400">Start cooling [item]</span>
                  <span className="text-theme-muted">"</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-theme-muted">"</span>
                  <span className="text-emerald-400">Finish cooling 1</span>
                  <span className="text-theme-muted">" or "</span>
                  <span className="text-emerald-400">Done</span>
                  <span className="text-theme-muted">"</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-theme-muted">"</span>
                  <span className="text-red-400">Discard</span>
                  <span className="text-theme-muted">"</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 safe-area-bottom bg-theme-card/98 backdrop-blur-md border-t border-theme-primary">
        <div className="max-w-lg mx-auto p-3">
          {hasActive ? (
            <div className="flex items-center gap-3">
              <Button
                variant="cooling"
                size="lg"
                onClick={() => setIsStartModalOpen(true)}
                className="flex-1"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Item
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={() => setIsFridgeTempModalOpen(true)}
                className="bg-cyan-500/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 px-4"
              >
                <Thermometer className="w-5 h-5 mr-1" />
                <span className="text-sm">Temp</span>
              </Button>

              {onNavigateToHistory && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={onNavigateToHistory}
                >
                  <History className="w-5 h-5" />
                </Button>
              )}

              <VoiceButton
                ref={voiceButtonRef}
                onCommand={handleVoiceCommand}
                onTranscript={voiceCloseFlow.handleTranscript}
                onInterimTranscript={voiceCloseFlow.checkInterimTranscript}
                onEnd={handleVoiceEnd}
                size="sm"
                wakeWordActive={isWakeWordActive}
                wakeWordTriggered={wakeWordTriggered}
                wakeWordLabel={primaryWakeWordLabel}
                conversationMode={voiceCloseFlow.step !== 'idle'}
              />
            </div>
          ) : (
            <>
              <Button
                variant="cooling"
                size="kiosk"
                fullWidth
                onClick={() => setIsStartModalOpen(true)}
                className="mb-3"
              >
                <Plus className="w-7 h-7 mr-2" />
                Start Cooling
              </Button>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => setIsFridgeTempModalOpen(true)}
                    className="bg-cyan-500/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 px-6"
                  >
                    <Thermometer className="w-6 h-6 mr-2" />
                    Log Fridge Temp
                  </Button>
                  {onNavigateToHistory && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onNavigateToHistory}
                    >
                      <History className="w-5 h-5 mr-1.5" />
                      History
                    </Button>
                  )}
                </div>

                <VoiceButton
                  ref={voiceButtonRef}
                  onCommand={handleVoiceCommand}
                  onTranscript={voiceCloseFlow.handleTranscript}
                  onInterimTranscript={voiceCloseFlow.checkInterimTranscript}
                  onEnd={handleVoiceEnd}
                  size="md"
                  wakeWordActive={isWakeWordActive}
                  wakeWordTriggered={wakeWordTriggered}
                  wakeWordLabel={primaryWakeWordLabel}
                  conversationMode={voiceCloseFlow.step !== 'idle'}
                />
              </div>
            </>
          )}
        </div>
      </div>

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
        onConfirm={handleConfirmClose}
        session={sessionToClose}
        preselectedStaffId={voiceCloseFlow.staffId}
        preselectedTemperature={voiceCloseFlow.temperature ?? null}
      />

      <FridgeTempModal
        isOpen={isFridgeTempModalOpen}
        onClose={() => setIsFridgeTempModalOpen(false)}
      />
    </div>
  )
}
