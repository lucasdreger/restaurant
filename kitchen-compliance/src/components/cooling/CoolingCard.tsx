import { useEffect, useState } from 'react'
import { Snowflake, Trash2, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { CoolingSession } from '@/types'
import {
  cn,
  formatTime,
  formatTimeFromDate,
  getTimeDifferenceSeconds,
  getCoolingStatus,
  COOLING_POLICY,
} from '@/lib/utils'

interface CoolingCardProps {
  session: CoolingSession
  onClose: (id: string) => void
  onDiscard: (id: string) => void
  compact?: boolean
  referenceNumber?: number
}

export function CoolingCard({
  session,
  onClose,
  onDiscard,
  compact = false,
  referenceNumber,
}: CoolingCardProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [status, setStatus] = useState(session.status)

  // Update elapsed time every second
  useEffect(() => {
    if (session.closed_at) return

    const updateTime = () => {
      const seconds = getTimeDifferenceSeconds(new Date(session.started_at))
      setElapsedSeconds(seconds)
      setStatus(getCoolingStatus(new Date(session.started_at)))
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [session.started_at, session.closed_at])

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  const remainingToSoft = Math.max(0, COOLING_POLICY.SOFT_LIMIT_MINUTES - elapsedMinutes)
  const remainingToHard = Math.max(0, COOLING_POLICY.HARD_LIMIT_MINUTES - elapsedMinutes)

  const cardClasses = cn(
    'cooling-card transition-all duration-300',
    status === 'active' && 'cooling-card-active',
    status === 'warning' && 'cooling-card-warning',
    status === 'overdue' && 'cooling-card-overdue'
  )

  const timerClasses = cn(
    'font-mono font-bold',
    status === 'active' && 'text-emerald-400',
    status === 'warning' && 'text-amber-400',
    status === 'overdue' && 'text-red-400 animate-pulse'
  )

  const statusIcon = {
    active: <Snowflake className="w-5 h-5 text-sky-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    overdue: <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />,
    closed: <CheckCircle className="w-5 h-5 text-green-400" />,
    discarded: <Trash2 className="w-5 h-5 text-theme-muted" />,
  }

  // Compact mode: shows minimal info with inline actions
  if (compact) {
    return (
      <div className={cardClasses}>
        <div className="flex items-center justify-between gap-3">
          {/* Left: Status + Item Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {statusIcon[status]}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {referenceNumber !== undefined && (
                  <span className="px-2 py-0.5 rounded-full bg-theme-ghost text-[10px] font-semibold text-theme-muted">
                    #{referenceNumber}
                  </span>
                )}
                <p className="font-bold text-base truncate text-theme-primary">{session.item_name}</p>
              </div>
              <p className="text-xs text-theme-muted">
                {formatTimeFromDate(new Date(session.started_at))}
              </p>
            </div>
          </div>

          {/* Center: Timer */}
          <div className="text-center">
            <p className={cn('text-xl', timerClasses)}>
              {formatTime(elapsedSeconds)}
            </p>
            {status !== 'overdue' && (
              <p className="text-xs text-theme-muted">{remainingToHard}m left</p>
            )}
          </div>

          {/* Right: Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onClose(session.id)}
              className="p-3 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl transition-colors"
              title="Move to fridge"
            >
              <Snowflake className="w-5 h-5 text-emerald-400" />
            </button>
            <button
              onClick={() => onDiscard(session.id)}
              className="p-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl transition-colors"
              title="Discard"
            >
              <Trash2 className="w-5 h-5 text-red-400" />
            </button>
          </div>
        </div>

        {/* Compact Progress Bar */}
        <div className="w-full h-1.5 bg-theme-secondary rounded-full overflow-hidden mt-3">
          <div
            className={cn(
              'h-full transition-all duration-1000 rounded-full',
              status === 'active' && 'bg-sky-500',
              status === 'warning' && 'bg-amber-500',
              status === 'overdue' && 'bg-red-500 animate-pulse'
            )}
            style={{
              width: `${Math.min(100, (elapsedMinutes / COOLING_POLICY.HARD_LIMIT_MINUTES) * 100)}%`,
            }}
          />
        </div>
      </div>
    )
  }

  // Full card mode: detailed view with prominent actions
  return (
    <div className={cn(cardClasses, 'animate-slide-in p-4')}>
      {/* FSAI Reference Badge - even smaller */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-medium rounded-full">
          FSAI SC3
        </span>
        {!session.synced && (
          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded-full">
            Offline
          </span>
        )}
      </div>

      {/* Header + Timer in one row */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-shrink-0">
          {statusIcon[status]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {referenceNumber !== undefined && (
              <span className="px-1 py-0.5 rounded-full bg-theme-ghost text-[9px] font-semibold text-theme-muted">
                #{referenceNumber}
              </span>
            )}
            <h3 className="font-bold text-sm truncate text-theme-primary">{session.item_name}</h3>
          </div>
          <p className="text-[10px] text-theme-muted flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {formatTimeFromDate(new Date(session.started_at))}
          </p>
        </div>
        {/* Timer display inline - slightly smaller */}
        <div className="text-right flex-shrink-0">
          <p className={cn('text-lg font-mono font-bold leading-none', timerClasses)}>
            {formatTime(elapsedSeconds)}
          </p>
          <p className={cn('text-[9px] mt-0.5', timerClasses)}>
            {status === 'active' && `${remainingToSoft}m warning`}
            {status === 'warning' && `${remainingToHard}m left`}
            {status === 'overdue' && 'OVERDUE'}
          </p>
        </div>
      </div>

      {/* Progress Bar - thinner */}
      <div className="w-full h-1 bg-theme-secondary rounded-full overflow-hidden mb-2">
        <div
          className={cn(
            'h-full transition-all duration-1000 rounded-full',
            status === 'active' && 'bg-sky-500',
            status === 'warning' && 'bg-amber-500',
            status === 'overdue' && 'bg-red-500 animate-pulse'
          )}
          style={{
            width: `${Math.min(100, (elapsedMinutes / COOLING_POLICY.HARD_LIMIT_MINUTES) * 100)}%`,
          }}
        />
      </div>

      {/* Status Warning (only when needed) - more compact */}
      {status === 'warning' && (
        <div className="mb-2 p-1.5 bg-amber-500/10 border border-amber-500/30 rounded flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <p className="text-amber-300 text-[10px]">
            &lt;8°C within {remainingToHard}m
          </p>
        </div>
      )}
      {status === 'overdue' && (
        <div className="mb-2 p-1.5 bg-red-500/10 border border-red-500/30 rounded flex items-center gap-1.5 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-[10px] font-bold">
            ACTION REQUIRED!
          </p>
        </div>
      )}

      {/* Action Buttons - More Compact */}
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant="primary"
          size="sm"
          fullWidth
          onClick={() => onClose(session.id)}
          className="flex items-center justify-center gap-1.5 py-1.5"
        >
          <Snowflake className="w-4 h-4" />
          <span className="font-bold text-xs text-white">In Fridge</span>
        </Button>
        <Button
          variant="danger"
          size="sm"
          fullWidth
          onClick={() => onDiscard(session.id)}
          className="flex items-center justify-center gap-1.5 py-1.5 text-white"
        >
          <Trash2 className="w-4 h-4" />
          <span className="font-bold text-xs text-white">Discard</span>
        </Button>
      </div>
    </div>
  )
}
