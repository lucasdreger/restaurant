import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Thermometer, Check, AlertTriangle, ChevronLeft, ChevronRight, Delete, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getFridges, logFridgeTemp, type Fridge, FRIDGE_LIMITS } from '@/services/fridgeService'
import { useAppStore } from '@/store/useAppStore'
import { useStaff } from '@/hooks/queries/useStaff'
import type { StaffMember } from '@/types'
import { toast } from 'sonner'

interface FridgeTempModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  preselectedFridgeIndex?: number
  preselectedTemperature?: number | null
  preselectedStaffId?: string | null
  voiceStep?: string // 'idle' | 'awaiting_fridge' | 'awaiting_temperature' | 'awaiting_staff' | 'awaiting_confirmation'
}

export function FridgeTempModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedFridgeIndex,
  preselectedTemperature,
  preselectedStaffId,
  voiceStep
}: FridgeTempModalProps) {
  const { currentSite, settings } = useAppStore()
  const { data: staffMembers = [] } = useStaff(currentSite?.id)

  const [fridges, setFridges] = useState<Fridge[]>([])
  const [selectedFridgeIndex, setSelectedFridgeIndex] = useState(0)
  const [temperature, setTemperature] = useState('')
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Internal step for manual or visual flow
  const [internalStep, setInternalStep] = useState<'temperature' | 'staff'>('temperature')

  // Get fridge limit based on subscription
  const fridgeLimit = FRIDGE_LIMITS[settings.subscriptionTier] || 1

  const activeStaff = useMemo(() => staffMembers.filter(s => s.active), [staffMembers])

  // Load fridges on mount
  useEffect(() => {
    if (isOpen && currentSite?.id) {
      loadFridges()
    }
  }, [isOpen, currentSite?.id])

  // Apply preselected values and voice step
  useEffect(() => {
    if (isOpen) {
      if (preselectedFridgeIndex !== undefined && preselectedFridgeIndex >= 0) {
        setSelectedFridgeIndex(preselectedFridgeIndex)
      }
      if (preselectedTemperature !== undefined && preselectedTemperature !== null) {
        setTemperature(preselectedTemperature.toString())
      } else {
        setTemperature('')
      }
      if (preselectedStaffId) {
        const staff = staffMembers.find(s => s.id === preselectedStaffId)
        if (staff) setSelectedStaff(staff)
      } else {
        setSelectedStaff(null)
      }

      // Sync step based on voice flow logic
      if (voiceStep === 'awaiting_staff') {
        setInternalStep('staff')
      } else {
        setInternalStep('temperature')
      }
      setShowSuccess(false)
    }
  }, [preselectedFridgeIndex, preselectedTemperature, preselectedStaffId, voiceStep, isOpen, staffMembers])

  const loadFridges = async () => {
    if (!currentSite?.id) return
    try {
      const data = await getFridges(currentSite.id)
      // Limit based on subscription tier
      setFridges(data.slice(0, fridgeLimit))
    } catch (err) {
      console.error('Failed to load fridges:', err)
      // Use demo fridge
      setFridges([{
        id: 'demo-fridge-1',
        site_id: currentSite.id,
        name: 'Main Fridge',
        sort_order: 0,
        min_temp: 0,
        max_temp: 5,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
    }
  }

  // Current fridge
  const currentFridge = fridges[selectedFridgeIndex]

  // Temperature validation
  const tempValue = temperature ? parseFloat(temperature) : null
  const isCompliant = tempValue !== null && tempValue >= 0 && tempValue <= 5
  const isWarning = tempValue !== null && (tempValue < 0 || tempValue > 5)

  // Handle number input
  const handleNumberPress = useCallback((num: string) => {
    if (temperature.length >= 4) return // Max: -9.9 or 99.9

    if (num === '.') {
      if (temperature.includes('.')) return
      setTemperature(prev => prev + '.')
    } else if (num === '-') {
      if (temperature.length > 0) return // Can only add minus at start
      setTemperature('-')
    } else {
      // Prevent multiple digits after decimal
      if (temperature.includes('.')) {
        const [, decimals] = temperature.split('.')
        if (decimals && decimals.length >= 1) return
      }
      setTemperature(prev => prev + num)
    }
  }, [temperature])

  // Handle backspace
  const handleBackspace = useCallback(() => {
    setTemperature(prev => prev.slice(0, -1))
  }, [])

  // Handle clear
  const handleClear = useCallback(() => {
    setTemperature('')
  }, [])

  // Handle proceed to staff
  const handleProceedToStaff = () => {
    if (tempValue === null) return
    setInternalStep('staff')
  }

  // Submit temperature log
  const handleSubmit = async (staffToSubmit: StaffMember) => {
    if (!currentSite?.id || !currentFridge || tempValue === null || !staffToSubmit) return

    setIsLoading(true)
    try {
      await logFridgeTemp({
        site_id: currentSite.id,
        fridge_id: currentFridge.id,
        temperature: tempValue,
        recorded_by: staffToSubmit.id,
        recorded_by_name: staffToSubmit.name,
      })

      setShowSuccess(true)
      toast.success(`${currentFridge.name}: ${tempValue}°C logged`)

      // If multiple fridges, go to next one
      if (fridges.length > 1 && selectedFridgeIndex < fridges.length - 1) {
        setTimeout(() => {
          setSelectedFridgeIndex(prev => prev + 1)
          setTemperature('')
          setSelectedStaff(null)
          setInternalStep('temperature')
          setShowSuccess(false)
        }, 800)
      } else {
        // All done
        setTimeout(() => {
          setShowSuccess(false)
          setTemperature('')
          setSelectedStaff(null)
          setInternalStep('temperature')
          setSelectedFridgeIndex(0)
          onSuccess?.()
          onClose()
        }, 1000)
      }
    } catch (err) {
      console.error('Failed to log temperature:', err)
      toast.error('Failed to log temperature')
    } finally {
      setIsLoading(false)
    }
  }

  // Navigate between fridges
  const goToPrevFridge = () => {
    if (selectedFridgeIndex > 0) {
      setSelectedFridgeIndex(prev => prev - 1)
      setTemperature('')
      setInternalStep('temperature')
      setSelectedStaff(null)
    }
  }

  const goToNextFridge = () => {
    if (selectedFridgeIndex < fridges.length - 1) {
      setSelectedFridgeIndex(prev => prev + 1)
      setTemperature('')
      setInternalStep('temperature')
      setSelectedStaff(null)
    }
  }

  if (!isOpen) return null

  // Used for voice-preselected pulse effect
  const isPreselectedStaff = !!(voiceStep === 'awaiting_staff' && selectedStaff)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md mx-4 bg-theme-card rounded-3xl shadow-2xl overflow-hidden border border-theme-primary">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme-primary">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-xl",
              isCompliant ? "bg-emerald-500/20 text-emerald-400" :
                isWarning ? "bg-red-500/20 text-red-400" :
                  "bg-sky-500/20 text-sky-400"
            )}>
              <Thermometer className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-theme-primary">Log Fridge Temp</h2>
              <p className="text-xs text-theme-muted">FSAI SC1 Compliance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-theme-muted hover:text-theme-primary hover:bg-theme-ghost rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Fridge Selector (if multiple) */}
        {fridges.length > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-theme-secondary">
            <button
              onClick={goToPrevFridge}
              disabled={selectedFridgeIndex === 0}
              className="p-2 rounded-xl disabled:opacity-30 hover:bg-theme-ghost transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-theme-secondary" />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-theme-primary">
                {currentFridge?.name}
                {currentFridge?.fridge_code && (
                  <span className="ml-2 px-1.5 py-0.5 bg-theme-ghost rounded text-[10px] text-theme-muted">
                    {currentFridge.fridge_code}
                  </span>
                )}
              </p>
              <p className="text-xs text-theme-muted">
                {selectedFridgeIndex + 1} of {fridges.length}
              </p>
            </div>
            <button
              onClick={goToNextFridge}
              disabled={selectedFridgeIndex === fridges.length - 1}
              className="p-2 rounded-xl disabled:opacity-30 hover:bg-theme-ghost transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-theme-secondary" />
            </button>
          </div>
        )}

        {/* Single fridge header */}
        {fridges.length === 1 && currentFridge && (
          <div className="px-4 py-3 bg-theme-secondary text-center">
            <p className="text-sm font-semibold text-theme-primary">
              {currentFridge.name}
              {currentFridge.fridge_code && (
                <span className="ml-2 px-1.5 py-0.5 bg-theme-ghost rounded text-[10px] text-theme-muted">
                  {currentFridge.fridge_code}
                </span>
              )}
            </p>
          </div>
        )}

        {internalStep === 'temperature' ? (
          <>
            {/* Temperature Display */}
            <div className="p-6 flex flex-col items-center">
              <div className={cn(
                "w-full py-6 px-4 rounded-2xl text-center transition-colors",
                showSuccess ? "bg-emerald-500/20 border-2 border-emerald-500" :
                  isWarning ? "bg-red-500/10 border-2 border-red-500" :
                    isCompliant ? "bg-emerald-500/10 border-2 border-emerald-500/50" :
                      "bg-theme-secondary border-2 border-theme-primary"
              )}>
                {showSuccess ? (
                  <div className="flex flex-col items-center gap-2">
                    <Check className="w-12 h-12 text-emerald-400" />
                    <span className="text-lg text-emerald-400 font-semibold">Logged!</span>
                  </div>
                ) : (
                  <>
                    <div className="text-5xl font-bold text-theme-primary font-mono min-h-[60px]">
                      {temperature || <span className="text-theme-muted">—</span>}
                      {temperature && <span className="text-3xl ml-1 text-theme-muted">°C</span>}
                    </div>
                    {isWarning && (
                      <div className="flex items-center justify-center gap-2 mt-3 text-red-400">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-sm font-medium">Out of range (0-5°C)</span>
                      </div>
                    )}
                    {isCompliant && tempValue !== null && (
                      <div className="flex items-center justify-center gap-2 mt-3 text-emerald-400">
                        <Check className="w-5 h-5" />
                        <span className="text-sm font-medium">Compliant</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Compliance indicator */}
              <div className="mt-3 text-xs text-theme-muted text-center">
                Target range: 0°C to 5°C
              </div>
            </div>

            {/* Number Pad - Large touch-friendly buttons */}
            <div className="px-4 pb-4">
              <div className="grid grid-cols-3 gap-2">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleNumberPress(num)}
                    className="h-16 text-2xl font-bold bg-theme-ghost hover:bg-theme-secondary active:bg-theme-input text-theme-primary rounded-xl transition-colors border border-theme-primary"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => handleNumberPress('-')}
                  className="h-16 text-2xl font-bold bg-theme-ghost hover:bg-theme-secondary active:bg-theme-input text-theme-primary rounded-xl transition-colors border border-theme-primary"
                >
                  −
                </button>
                <button
                  onClick={() => handleNumberPress('0')}
                  className="h-16 text-2xl font-bold bg-theme-ghost hover:bg-theme-secondary active:bg-theme-input text-theme-primary rounded-xl transition-colors border border-theme-primary"
                >
                  0
                </button>
                <button
                  onClick={() => handleNumberPress('.')}
                  className="h-16 text-2xl font-bold bg-theme-ghost hover:bg-theme-secondary active:bg-theme-input text-theme-primary rounded-xl transition-colors border border-theme-primary"
                >
                  .
                </button>
              </div>

              {/* Clear and Backspace */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={handleClear}
                  className="h-12 text-sm font-semibold bg-theme-secondary hover:bg-theme-ghost text-theme-secondary rounded-xl transition-colors border border-theme-primary"
                >
                  Clear
                </button>
                <button
                  onClick={handleBackspace}
                  className="h-12 flex items-center justify-center bg-theme-secondary hover:bg-theme-ghost text-theme-secondary rounded-xl transition-colors border border-theme-primary"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Proceed to Staff Button */}
            <div className="p-4 pt-0">
              <button
                onClick={handleProceedToStaff}
                disabled={tempValue === null || isLoading || showSuccess}
                className={cn(
                  "w-full py-4 rounded-xl font-bold text-lg transition-all",
                  tempValue !== null && !isLoading
                    ? "bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white shadow-lg shadow-sky-500/30"
                    : "bg-theme-ghost text-theme-muted cursor-not-allowed"
                )}
              >
                {isLoading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 text-sm font-bold text-theme-secondary uppercase tracking-wider">
                  <User className="w-4 h-4 text-purple-400" />
                  Who is recording?
                </label>
                <span className="text-xl font-mono text-emerald-400">
                  {temperature}°C
                </span>
              </div>

              {activeStaff.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {activeStaff.map((staff) => (
                    <button
                      key={staff.id}
                      onClick={() => {
                        setSelectedStaff(staff)
                        // If voice flow is active, we just visually select it, but we could also auto-submit in manual mode.
                        // Let's auto-submit in manual mode to save taps.
                        if (!voiceStep || voiceStep === 'idle') {
                          handleSubmit(staff)
                        }
                      }}
                      className={cn(
                        'p-4 rounded-xl transition-all flex flex-col items-center justify-center gap-1 min-h-[80px] touch-manipulation border border-theme-primary',
                        selectedStaff?.id === staff.id
                          ? cn(
                            'bg-purple-500 text-white ring-2 ring-purple-400 shadow-lg shadow-purple-500/30 border-purple-400',
                            isPreselectedStaff && 'animate-pulse'
                          )
                          : 'bg-theme-secondary text-theme-secondary hover:bg-theme-hover active:scale-95'
                      )}
                    >
                      <span className="text-xl font-bold">{staff.initials}</span>
                      <span className="text-xs truncate max-w-full">{staff.name}</span>
                      {staff.staff_code && (
                        <span className={cn(
                          'mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          selectedStaff?.id === staff.id
                            ? 'bg-white/20 text-white'
                            : 'bg-theme-hover text-theme-muted'
                        )}>
                          Code {staff.staff_code}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-theme-secondary rounded-xl text-center border border-theme-primary">
                  <p className="text-theme-muted text-sm mb-2">No staff members configured</p>
                  <p className="text-xs text-theme-muted">Add staff in Settings → Staff</p>
                </div>
              )}

              {showSuccess && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-500/20 border-2 border-emerald-500 flex flex-col items-center gap-2">
                  <Check className="w-8 h-8 text-emerald-400" />
                  <span className="text-lg text-emerald-400 font-semibold">Logged!</span>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-theme-primary space-y-3">
              <button
                onClick={() => selectedStaff && handleSubmit(selectedStaff)}
                disabled={!selectedStaff || isLoading || showSuccess}
                className={cn(
                  "w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2",
                  selectedStaff && !isLoading && !showSuccess
                    ? "bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-theme-ghost text-theme-muted cursor-not-allowed"
                )}
              >
                {isLoading ? 'Saving...' : 'Log Temperature'}
              </button>
              <button
                onClick={() => setInternalStep('temperature')}
                className="w-full py-3 text-sm font-medium text-theme-muted hover:text-theme-primary transition-colors bg-theme-secondary rounded-xl border border-theme-primary"
              >
                Back to Temperature
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

