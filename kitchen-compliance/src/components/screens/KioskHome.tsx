import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Snowflake, History, FileText, AlertTriangle, Mic, Thermometer } from 'lucide-react'
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
import { useWakeWord, playWakeSound, getPrimaryWakeWordLabel } from '@/hooks/useWakeWord'

interface KioskHomeProps {
  onNavigateToHistory?: () => void
  onNavigateToReports?: () => void
  onNavigateToSettings?: () => void
}

export function KioskHome({
  onNavigateToHistory,
  onNavigateToReports,
  onNavigateToSettings,
}: KioskHomeProps) {
  const [isStartModalOpen, setIsStartModalOpen] = useState(false)
  const [closeModalSessionId, setCloseModalSessionId] = useState<string | null>(null)
  const [wakeWordTriggered, setWakeWordTriggered] = useState(false)
  const [isFridgeTempModalOpen, setIsFridgeTempModalOpen] = useState(false)
  
  const { coolingSessions, settings } = useAppStore()
  const { startCooling, closeCooling, discardCooling, updateSessionStatuses } = useCoolingWorkflow()
  const { speak } = useTextToSpeech()
  
  // Ref to trigger voice button programmatically
  const voiceButtonRef = useRef<VoiceButtonHandle>(null)
  
  // Wake word detection - "Hey Chef" always listening mode
  const handleWakeWordDetected = useCallback(() => {
    console.log('[KioskHome] Wake word detected!')
    playWakeSound()
    setWakeWordTriggered(true)
    
    // Trigger the voice button
    if (voiceButtonRef.current) {
      voiceButtonRef.current.triggerVoice()
    }
  }, [])
  
  const handleImmediateCommand = useCallback((command: string) => {
    console.log('[KioskHome] Immediate command after wake word:', command)
    // The VoiceButton will handle this when it processes the voice input
  }, [])
  
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
  
  const { isActive: isWakeWordActive, resumeListening } = useWakeWord({
    onWakeWordDetected: handleWakeWordDetected,
    onCommandDetected: handleImmediateCommand,
    enabled: settings.wakeWordEnabled,
    language: settings.language === 'en' ? 'en-IE' : settings.language,
    wakeWords: activeWakeWordPhrases,
  })

  // Get the session being closed for the modal
  const sessionToClose = useMemo(
    () => coolingSessions.find((s) => s.id === closeModalSessionId) || null,
    [coolingSessions, closeModalSessionId]
  )

  // Use memoized selectors
  const activeSessions = useMemo(() => getActiveSessions(coolingSessions), [coolingSessions])
  const overdueSessions = useMemo(() => getOverdueSessions(coolingSessions), [coolingSessions])

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

  // Handle closing a cooling session with temperature data
  const handleConfirmClose = useCallback(
    async (data: CloseCoolingData) => {
      if (!closeModalSessionId) return
      
      const success = await closeCooling(closeModalSessionId, data)
      if (success) {
        const tempMsg = data.temperature !== undefined 
          ? ` at ${data.temperature} degrees` 
          : ''
        speak(`Item moved to fridge${tempMsg}. Well done!`)
        setCloseModalSessionId(null)
      }
    },
    [closeModalSessionId, closeCooling, speak]
  )

  // Legacy handler for quick close without modal (voice commands)
  const handleQuickClose = useCallback(
    async (sessionId: string) => {
      const success = await closeCooling(sessionId)
      if (success) {
        speak('Item moved to fridge. Well done!')
      }
    },
    [closeCooling, speak]
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
          // Close the most recent active session (quick close via voice)
          if (activeSessions.length > 0) {
            handleQuickClose(activeSessions[0].id)
          }
          break
        case 'discard':
          // Discard the most recent active session
          if (activeSessions.length > 0) {
            handleDiscardCooling(activeSessions[0].id)
          }
          break
        default:
          // Unknown command - modal already provides feedback
          break
      }
      
      // Resume wake word listening after command processed
      if (settings.wakeWordEnabled) {
        resumeListening()
      }
    },
    [activeSessions, handleStartCooling, handleQuickClose, handleDiscardCooling, settings.wakeWordEnabled, resumeListening]
  )
  
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
                  <span className="text-emerald-400">In fridge</span>
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

      {/* Bottom Action Bar - Compact when sessions active */}
      <div className="fixed bottom-0 left-0 right-0 safe-area-bottom bg-theme-card/98 backdrop-blur-md border-t border-theme-primary">
        <div className="max-w-lg mx-auto p-3">
          {/* Compact layout when sessions are active */}
          {hasActive ? (
            <div className="flex items-center gap-3">
              {/* Main Action: Start Cooling */}
              <Button
                variant="cooling"
                size="lg"
                onClick={() => setIsStartModalOpen(true)}
                className="flex-1"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Item
              </Button>

              {/* Fridge Temp Button - More prominent */}
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setIsFridgeTempModalOpen(true)}
                className="bg-cyan-500/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 px-4"
              >
                <Thermometer className="w-5 h-5 mr-1" />
                <span className="text-sm">Temp</span>
              </Button>

              {/* Secondary Actions */}
              {onNavigateToHistory && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={onNavigateToHistory}
                >
                  <History className="w-5 h-5" />
                </Button>
              )}

              {/* Voice Button - Compact */}
              <VoiceButton 
                ref={voiceButtonRef}
                onCommand={handleVoiceCommand} 
                onEnd={handleVoiceEnd}
                size="sm" 
                wakeWordActive={isWakeWordActive}
                wakeWordTriggered={wakeWordTriggered}
                wakeWordLabel={primaryWakeWordLabel}
              />
            </div>
          ) : (
            <>
              {/* Main Action: Start Cooling - Full size when empty */}
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

              {/* Secondary Actions */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {/* Fridge Temp Button - Large & Prominent */}
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
                  {onNavigateToReports && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onNavigateToReports}
                    >
                      <FileText className="w-5 h-5 mr-1.5" />
                      Reports
                    </Button>
                  )}
                </div>

                {/* Voice Button */}
                <VoiceButton 
                  ref={voiceButtonRef}
                  onCommand={handleVoiceCommand} 
                  onEnd={handleVoiceEnd}
                  size="md" 
                  wakeWordActive={isWakeWordActive}
                  wakeWordTriggered={wakeWordTriggered}
                  wakeWordLabel={primaryWakeWordLabel}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Start Cooling Modal */}
      <StartCoolingModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        onStart={handleStartCooling}
      />

      {/* Close Cooling Modal with Temperature Input */}
      <CloseCoolingModal
        isOpen={closeModalSessionId !== null}
        onClose={() => setCloseModalSessionId(null)}
        onConfirm={handleConfirmClose}
        session={sessionToClose}
      />

      {/* Fridge Temperature Logging Modal */}
      <FridgeTempModal
        isOpen={isFridgeTempModalOpen}
        onClose={() => setIsFridgeTempModalOpen(false)}
      />
    </div>
  )
}
