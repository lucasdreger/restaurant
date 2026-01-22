import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Snowflake, AlertTriangle, Mic, Eye, Thermometer } from 'lucide-react'
import { Sidebar, MobileNav } from '@/components/layout/Sidebar'
import { DashboardHeader, ProgressCard } from '@/components/layout/DashboardHeader'
import { CoolingSensorCard } from '@/components/cooling/CoolingSensorCard'
import { StartCoolingModal } from '@/components/cooling/StartCoolingModal'
import { CloseCoolingModal } from '@/components/cooling/CloseCoolingModal'
import { FridgeTempModal } from '@/components/fridge/FridgeTempModal'
import { VoiceButton } from '@/components/voice/VoiceButton'
import { useAppStore, getActiveSessions, getOverdueSessions, getUnacknowledgedAlerts } from '@/store/useAppStore'
import { useCoolingWorkflow } from '@/services/coolingService'
import { useTextToSpeech } from '@/hooks/useVoiceRecognition'
import type { FoodItemPreset, VoiceCommand, CloseCoolingData } from '@/types'
import { toast } from 'sonner'

interface DashboardProps {
  onNavigate?: (screen: string) => void
  currentScreen?: string
}

export function Dashboard({ onNavigate, currentScreen = 'home' }: DashboardProps) {
  const [isStartModalOpen, setIsStartModalOpen] = useState(false)
  const [closeModalSessionId, setCloseModalSessionId] = useState<string | null>(null)
  const [isFridgeTempModalOpen, setIsFridgeTempModalOpen] = useState(false)
  
  const { coolingSessions, currentSite, alerts, acknowledgeAlert } = useAppStore()
  const { startCooling, closeCooling, discardCooling, updateSessionStatuses } = useCoolingWorkflow()
  const { speak } = useTextToSpeech()

  // Session data
  const activeSessions = useMemo(() => getActiveSessions(coolingSessions), [coolingSessions])
  const overdueSessions = useMemo(() => getOverdueSessions(coolingSessions), [coolingSessions])
  const unacknowledgedAlerts = useMemo(() => getUnacknowledgedAlerts(alerts), [alerts])
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
      const session = await startCooling(itemName, category)
      if (session) {
        speak(`Cooling started for ${itemName}`)
      }
    },
    [startCooling, speak]
  )

  const handleOpenCloseModal = useCallback((sessionId: string) => {
    setCloseModalSessionId(sessionId)
  }, [])

  const handleConfirmClose = useCallback(
    async (data: CloseCoolingData) => {
      if (!closeModalSessionId) return
      const success = await closeCooling(closeModalSessionId, data)
      if (success) {
        const tempMsg = data.temperature !== undefined ? ` at ${data.temperature}°C` : ''
        speak(`Item moved to fridge${tempMsg}. Well done!`)
        setCloseModalSessionId(null)
      }
    },
    [closeModalSessionId, closeCooling, speak]
  )

  const handleDiscardCooling = useCallback(
    async (sessionId: string) => {
      const success = await discardCooling(sessionId)
      if (success) speak('Item discarded and logged')
    },
    [discardCooling, speak]
  )

  const handleVoiceCommand = useCallback(
    (command: VoiceCommand) => {
      switch (command.type) {
        case 'start_cooling':
          if (command.item) {
            handleStartCooling(command.item, 'other')
          } else {
            setIsStartModalOpen(true)
          }
          break
        case 'stop_cooling':
          if (activeSessions.length > 0) {
            handleOpenCloseModal(activeSessions[0].id)
          }
          break
        case 'discard':
          if (activeSessions.length > 0) {
            handleDiscardCooling(activeSessions[0].id)
          }
          break
      }
    },
    [activeSessions, handleStartCooling, handleOpenCloseModal, handleDiscardCooling]
  )

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
          {/* Quick Actions - Log Fridge Temp */}
          <section className="mb-6">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setIsFridgeTempModalOpen(true)}
                className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-cyan-500/20 to-sky-500/20 border-2 border-cyan-500/50 rounded-2xl hover:border-cyan-400 hover:from-cyan-500/30 hover:to-sky-500/30 transition-all group"
              >
                <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-500 group-hover:bg-cyan-500/30 transition-colors">
                  <Thermometer className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="font-bold text-theme-primary text-lg">Log Fridge Temp</span>
                  <p className="text-xs text-theme-muted">FSAI SC1 Compliance</p>
                </div>
              </button>
              
              <button
                onClick={() => setIsStartModalOpen(true)}
                className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-sky-500/20 to-blue-500/20 border-2 border-sky-500/50 rounded-2xl hover:border-sky-400 hover:from-sky-500/30 hover:to-blue-500/30 transition-all group"
              >
                <div className="p-3 rounded-xl bg-sky-500/20 text-sky-500 group-hover:bg-sky-500/30 transition-colors">
                  <Plus className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="font-bold text-theme-primary text-lg">Start Cooling</span>
                  <p className="text-xs text-theme-muted">Track hot food</p>
                </div>
              </button>
            </div>
          </section>

          {/* Daily Progress Section */}
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-emerald-500">✓</span>
              <h2 className="text-sm font-semibold text-theme-secondary uppercase tracking-wide">
                Daily Compliance Cycles
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <ProgressCard
                title="Cooling Records"
                value={activeSessions.length > 0 ? 65 : 100}
                status={activeSessions.length > 0 ? 'in-progress' : 'complete'}
                subtitle={activeSessions.length > 0 ? `${activeSessions.length} active` : 'All complete'}
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {overdueSessions.map((session) => (
                  <CoolingSensorCard
                    key={session.id}
                    session={session}
                    onClose={handleOpenCloseModal}
                    onDiscard={handleDiscardCooling}
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeSessions
                  .filter(s => s.status !== 'overdue')
                  .map((session) => (
                    <CoolingSensorCard
                      key={session.id}
                      session={session}
                      onClose={handleOpenCloseModal}
                      onDiscard={handleDiscardCooling}
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

          {/* Voice Command Section */}
          <section className="bg-theme-card rounded-2xl border border-theme-primary p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mic className="w-5 h-5 text-purple-500" />
              <h2 className="text-sm font-semibold text-theme-secondary uppercase tracking-wide">
                Voice Commands
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <VoiceButton onCommand={handleVoiceCommand} size="md" />
              <div className="text-sm text-theme-secondary space-y-2">
                <p><span className="font-medium text-purple-500">"Start cooling [item]"</span> - Begin tracking</p>
                <p><span className="font-medium text-emerald-500">"Done"</span> or <span className="font-medium text-emerald-500">"In fridge"</span> - Complete session</p>
                <p><span className="font-medium text-red-500">"Discard"</span> - Log waste</p>
              </div>
            </div>
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
        isOpen={closeModalSessionId !== null}
        onClose={() => setCloseModalSessionId(null)}
        onConfirm={handleConfirmClose}
        session={sessionToClose}
      />
      <FridgeTempModal
        isOpen={isFridgeTempModalOpen}
        onClose={() => setIsFridgeTempModalOpen(false)}
      />
    </div>
  )
}
