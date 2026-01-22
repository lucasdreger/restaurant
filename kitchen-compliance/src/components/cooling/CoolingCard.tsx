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
}

export function CoolingCard({
  session,
  onClose,
  onDiscard,
  compact = false,
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
              <p className="font-bold text-base truncate text-theme-primary">{session.item_name}</p>
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
    <div className={cn(cardClasses, 'animate-slide-in')}>
      {/* FSAI Reference Badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full">
          FSAI SC3 - Cooling
        </span>
        {!session.synced && (
          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
            Offline
          </span>
        )}
      </div>

      {/* Header + Timer in one row */}
      <div className="flex items-center gap-3 mb-3">
        {statusIcon[status]}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg truncate text-theme-primary">{session.item_name}</h3>
          <p className="text-xs text-theme-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Started {formatTimeFromDate(new Date(session.started_at))}
          </p>
        </div>
        {/* Timer display inline */}
        <div className="text-right flex-shrink-0">
          <p className={cn('text-2xl font-mono font-bold', timerClasses)}>
            {formatTime(elapsedSeconds)}
          </p>
          <p className={cn('text-xs', timerClasses)}>
            {status === 'active' && `${remainingToSoft}m to warning`}
            {status === 'warning' && `${remainingToHard}m left`}
            {status === 'overdue' && 'OVERDUE'}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-theme-secondary rounded-full overflow-hidden mb-3">
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

      {/* Status Warning (only when needed) */}
      {status === 'warning' && (
        <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-amber-300 text-xs">
            Check progress! Must be &lt;8°C within {remainingToHard}m
          </p>
        </div>
      )}
      {status === 'overdue' && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-xs font-bold">
            ACTION REQUIRED: Move to fridge or discard now!
          </p>
        </div>
      )}

      {/* Action Buttons - Always Visible, More Compact */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={() => onClose(session.id)}
          className="flex items-center justify-center gap-2"
        >
          <Snowflake className="w-5 h-5" />
          <span className="font-bold">In Fridge</span>
        </Button>
        <Button
          variant="danger"
          size="md"
          fullWidth
          onClick={() => onDiscard(session.id)}
          className="flex items-center justify-center gap-2"
        >
          <Trash2 className="w-5 h-5" />
          <span className="font-bold">Discard</span>
        </Button>
      </div>
    </div>
  )
}
