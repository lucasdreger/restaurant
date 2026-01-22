import { useState, useCallback, useMemo } from 'react'
import { X, Snowflake, Thermometer, User, CheckCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store/useAppStore'
import type { CoolingSession, CloseCoolingData, StaffMember } from '@/types'
import { cn, formatTime, getTimeDifferenceSeconds } from '@/lib/utils'

interface CloseCoolingModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: CloseCoolingData) => void
  session: CoolingSession | null
}

// Quick temperature presets (common values)
const TEMP_PRESETS = [2, 4, 5, 6, 7, 8]

export function CloseCoolingModal({
  isOpen,
  onClose,
  onConfirm,
  session,
}: CloseCoolingModalProps) {
  const { staffMembers } = useAppStore()
  const [temperature, setTemperature] = useState<number | undefined>(undefined)
  const [customTemp, setCustomTemp] = useState('')
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [showCustomTemp, setShowCustomTemp] = useState(false)

  // Filter active staff members
  const activeStaff = useMemo(() => 
    staffMembers.filter(s => s.active), 
    [staffMembers]
  )

  const handleConfirm = useCallback(() => {
    const finalTemp = showCustomTemp && customTemp ? parseFloat(customTemp) : temperature
    onConfirm({
      temperature: finalTemp,
      staffId: selectedStaff?.id,
      staffName: selectedStaff?.name,
    })
    // Reset form
    setTemperature(undefined)
    setCustomTemp('')
    setSelectedStaff(null)
    setShowCustomTemp(false)
  }, [temperature, customTemp, selectedStaff, showCustomTemp, onConfirm])

  const handleClose = useCallback(() => {
    setTemperature(undefined)
    setCustomTemp('')
    setSelectedStaff(null)
    setShowCustomTemp(false)
    onClose()
  }, [onClose])

  if (!isOpen || !session) return null

  const elapsedSeconds = getTimeDifferenceSeconds(new Date(session.started_at))
  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  const isOverdue = session.status === 'overdue'
  const isWarning = session.status === 'warning'
  
  // Check if temperature is compliant (<8°C)
  const selectedTemp = showCustomTemp && customTemp ? parseFloat(customTemp) : temperature
  const isTempCompliant = selectedTemp !== undefined && selectedTemp < 8
  const isTempHigh = selectedTemp !== undefined && selectedTemp >= 8

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal - Larger for touch */}
      <div className="relative w-full sm:max-w-lg bg-theme-card rounded-t-3xl sm:rounded-2xl shadow-2xl border border-theme-primary max-h-[95vh] overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme-primary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl">
              <Snowflake className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-theme-primary">Move to Fridge</h2>
              <p className="text-sm text-theme-muted">FSAI SC3 - Cooling Record</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-3 hover:bg-theme-hover rounded-xl transition-colors"
          >
            <X className="w-6 h-6 text-theme-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5">
          {/* Session Info */}
          <div className={cn(
            'p-4 rounded-xl border',
            isOverdue ? 'bg-red-500/10 border-red-500/30' : 
            isWarning ? 'bg-amber-500/10 border-amber-500/30' :
            'bg-theme-secondary border-theme-primary'
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-theme-primary text-xl">{session.item_name}</p>
                <p className="text-sm text-theme-muted">
                  Cooling time: {formatTime(elapsedSeconds)} ({elapsedMinutes}m)
                </p>
              </div>
              {isOverdue && (
                <div className="flex items-center gap-1 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm font-medium">Overdue</span>
                </div>
              )}
              {isWarning && !isOverdue && (
                <div className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm font-medium">Warning</span>
                </div>
              )}
              {!isOverdue && !isWarning && (
                <div className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">On time</span>
                </div>
              )}
            </div>
          </div>

          {/* Staff Selection - Tile-based */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-theme-secondary mb-3">
              <User className="w-4 h-4 text-purple-400" />
              Who's recording?
            </label>
            
            {activeStaff.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {activeStaff.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => setSelectedStaff(staff)}
                    className={cn(
                      'p-4 rounded-xl transition-all flex flex-col items-center justify-center gap-1 min-h-[80px] touch-manipulation',
                      selectedStaff?.id === staff.id
                        ? 'bg-purple-500 text-white ring-2 ring-purple-400'
                        : 'bg-theme-secondary text-theme-secondary hover:bg-theme-hover active:scale-95'
                    )}
                  >
                    <span className="text-2xl font-bold">{staff.initials}</span>
                    <span className="text-xs truncate max-w-full">{staff.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-theme-secondary rounded-xl text-center">
                <p className="text-theme-muted text-sm mb-2">No staff members configured</p>
                <p className="text-xs text-theme-muted">Add staff in Settings → Staff</p>
              </div>
            )}
          </div>

          {/* Temperature Input */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-theme-secondary mb-3">
              <Thermometer className="w-4 h-4 text-sky-400" />
              Final Temperature (°C)
              <span className="text-theme-muted">- should be &lt;8°C</span>
            </label>

            {!showCustomTemp ? (
              <>
                {/* Preset Temperature Grid - Larger touch targets */}
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {TEMP_PRESETS.map((temp) => (
                    <button
                      key={temp}
                      onClick={() => setTemperature(temp)}
                      className={cn(
                        'py-5 rounded-xl text-xl font-bold transition-all touch-manipulation active:scale-95',
                        temperature === temp
                          ? temp < 8
                            ? 'bg-emerald-500 text-white ring-2 ring-emerald-400'
                            : 'bg-amber-500 text-white ring-2 ring-amber-400'
                          : 'bg-theme-secondary text-theme-secondary hover:bg-theme-hover'
                      )}
                    >
                      {temp}°
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowCustomTemp(true)}
                  className="w-full py-3 text-sm text-theme-muted hover:text-theme-secondary transition-colors bg-theme-secondary rounded-xl"
                >
                  Enter custom temperature
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={customTemp}
                    onChange={(e) => setCustomTemp(e.target.value)}
                    placeholder="Enter temperature"
                    className={cn(
                      'w-full p-5 text-3xl font-mono text-center bg-theme-secondary text-theme-primary border rounded-xl focus:outline-none focus:ring-2 transition-all',
                      customTemp && parseFloat(customTemp) >= 8
                        ? 'border-amber-500 focus:ring-amber-500'
                        : 'border-theme-primary focus:ring-sky-500'
                    )}
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-theme-muted">
                    °C
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowCustomTemp(false)
                    setCustomTemp('')
                  }}
                  className="w-full py-3 text-sm text-theme-muted hover:text-theme-secondary transition-colors bg-theme-secondary rounded-xl"
                >
                  Use preset temperatures
                </button>
              </div>
            )}

            {/* Temperature Warning */}
            {isTempHigh && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-300">
                  Temperature is ≥8°C. FSAI requires food to be cooled to &lt;8°C 
                  within 2 hours. Consider continuing to cool or document exception.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-theme-primary space-y-3 safe-area-bottom">
          {/* Confirm Button - Large touch target */}
          <Button
            variant="primary"
            size="kiosk"
            fullWidth
            onClick={handleConfirm}
            className={cn(
              'flex items-center justify-center gap-2 py-5',
              isTempCompliant && 'bg-emerald-600 hover:bg-emerald-500'
            )}
          >
            <Snowflake className="w-6 h-6" />
            <span className="font-bold text-lg">
              {selectedTemp !== undefined 
                ? `Confirm at ${selectedTemp}°C` 
                : 'Confirm Move to Fridge'}
            </span>
          </Button>

          {/* Skip Temperature (for quick entry) */}
          {selectedTemp === undefined && (
            <button
              onClick={handleConfirm}
              className="w-full py-3 text-sm text-theme-muted hover:text-theme-secondary transition-colors"
            >
              Skip temperature (not recommended)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
