import { useState, useEffect, useCallback } from 'react'
import { X, Thermometer, Check, AlertTriangle, ChevronLeft, ChevronRight, Delete } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getFridges, logFridgeTemp, type Fridge, FRIDGE_LIMITS } from '@/services/fridgeService'
import { useAppStore } from '@/store/useAppStore'
import { toast } from 'sonner'

interface FridgeTempModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  preselectedFridgeIndex?: number
}

export function FridgeTempModal({ isOpen, onClose, onSuccess, preselectedFridgeIndex }: FridgeTempModalProps) {
  const { currentSite, settings, staffMembers } = useAppStore()
  
  const [fridges, setFridges] = useState<Fridge[]>([])
  const [selectedFridgeIndex, setSelectedFridgeIndex] = useState(0)
  const [temperature, setTemperature] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Get fridge limit based on subscription
  const fridgeLimit = FRIDGE_LIMITS[settings.subscriptionTier] || 1

  // Load fridges on mount
  useEffect(() => {
    if (isOpen && currentSite?.id) {
      loadFridges()
    }
  }, [isOpen, currentSite?.id])

  // Apply preselected fridge index when provided
  useEffect(() => {
    if (preselectedFridgeIndex !== undefined && preselectedFridgeIndex >= 0) {
      setSelectedFridgeIndex(preselectedFridgeIndex)
    }
  }, [preselectedFridgeIndex, isOpen])

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

  // Submit temperature log
  const handleSubmit = async () => {
    if (!currentSite?.id || !currentFridge || tempValue === null) return
    
    setIsLoading(true)
    try {
      await logFridgeTemp({
        site_id: currentSite.id,
        fridge_id: currentFridge.id,
        temperature: tempValue,
        // For now, we'll leave recorded_by optional
        recorded_by_name: staffMembers[0]?.name || undefined,
      })
      
      setShowSuccess(true)
      toast.success(`${currentFridge.name}: ${tempValue}°C logged`)
      
      // If multiple fridges, go to next one
      if (fridges.length > 1 && selectedFridgeIndex < fridges.length - 1) {
        setTimeout(() => {
          setSelectedFridgeIndex(prev => prev + 1)
          setTemperature('')
          setShowSuccess(false)
        }, 800)
      } else {
        // All done
        setTimeout(() => {
          setShowSuccess(false)
          setTemperature('')
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
    }
  }

  const goToNextFridge = () => {
    if (selectedFridgeIndex < fridges.length - 1) {
      setSelectedFridgeIndex(prev => prev + 1)
      setTemperature('')
    }
  }

  if (!isOpen) return null

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
              <p className="text-sm font-semibold text-theme-primary">{currentFridge?.name}</p>
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
            <p className="text-sm font-semibold text-theme-primary">{currentFridge.name}</p>
          </div>
        )}

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

        {/* Submit Button */}
        <div className="p-4 pt-0">
          <button
            onClick={handleSubmit}
            disabled={tempValue === null || isLoading || showSuccess}
            className={cn(
              "w-full py-4 rounded-xl font-bold text-lg transition-all",
              tempValue !== null && !isLoading
                ? "bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                : "bg-theme-ghost text-theme-muted cursor-not-allowed"
            )}
          >
            {isLoading ? 'Saving...' : 'Log Temperature'}
          </button>
        </div>
      </div>
    </div>
  )
}
