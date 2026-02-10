import { useState, useEffect, useMemo } from 'react'
import { Snowflake, AlertTriangle, Check, Trash2, Thermometer } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CoolingSession } from '@/types'

interface CoolingSensorCardProps {
  session: CoolingSession
  onClose: (sessionId: string) => void
  onDiscard: (sessionId: string) => void
  referenceNumber?: number
}

export function CoolingSensorCard({ session, onClose, onDiscard, referenceNumber }: CoolingSensorCardProps) {
  const [timeRemaining, setTimeRemaining] = useState('')
  const [elapsedTime, setElapsedTime] = useState('')
  const [progress, setProgress] = useState(0)

  // Calculate timing
  useEffect(() => {
    const calculateTime = () => {
      const now = new Date()
      const started = new Date(session.started_at)
      const hardDue = new Date(session.hard_due_at)

      // Elapsed time
      const elapsedMs = now.getTime() - started.getTime()
      const elapsedMins = Math.floor(elapsedMs / (1000 * 60))
      const elapsedHours = Math.floor(elapsedMins / 60)
      const mins = elapsedMins % 60

      if (elapsedHours > 0) {
        setElapsedTime(`${elapsedHours}h ${mins}m`)
      } else {
        setElapsedTime(`${mins}m`)
      }

      // Time remaining until hard deadline
      const remainingMs = hardDue.getTime() - now.getTime()
      if (remainingMs <= 0) {
        setTimeRemaining('OVERDUE')
      } else {
        const remainingMins = Math.ceil(remainingMs / (1000 * 60))
        if (remainingMins > 60) {
          setTimeRemaining(`${Math.floor(remainingMins / 60)}h ${remainingMins % 60}m`)
        } else {
          setTimeRemaining(`${remainingMins}m`)
        }
      }

      // Progress (0-100 where 100 = hard deadline)
      const totalDuration = hardDue.getTime() - started.getTime()
      const progressPercent = Math.min(100, (elapsedMs / totalDuration) * 100)
      setProgress(progressPercent)
    }

    calculateTime()
    const interval = setInterval(calculateTime, 10000) // Update every 10s
    return () => clearInterval(interval)
  }, [session])

  // Status configuration - stunning theme
  const statusConfig = useMemo(() => {
    switch (session.status) {
      case 'active':
        return {
          badge: 'COOLING',
          badgeClass: 'status-badge-active',
          cardClass: 'cooling-card-active',
          iconGradient: 'gradient-cool',
          progressGradient: 'gradient-success',
          timerClass: 'timer-safe',
          accent: 'text-sky-500',
        }
      case 'warning':
        return {
          badge: 'WARNING',
          badgeClass: 'status-badge-warning',
          cardClass: 'cooling-card-warning',
          iconGradient: 'gradient-warning',
          progressGradient: 'gradient-warning',
          timerClass: 'timer-warning',
          accent: 'text-amber-500',
        }
      case 'overdue':
        return {
          badge: 'CRITICAL',
          badgeClass: 'status-badge-danger',
          cardClass: 'cooling-card-overdue',
          iconGradient: 'gradient-danger',
          progressGradient: 'gradient-danger',
          timerClass: 'timer-danger',
          accent: 'text-red-500',
        }
      default:
        return {
          badge: 'COOLING',
          badgeClass: 'status-badge-active',
          cardClass: 'cooling-card',
          iconGradient: 'bg-theme-ghost',
          progressGradient: 'bg-theme-muted',
          timerClass: '',
          accent: 'text-theme-muted',
        }
    }
  }, [session.status])

  // Get category emoji
  const getCategoryEmoji = () => {
    const emojiMap: Record<string, string> = {
      sauce: '🥄',
      soup: '🍲',
      meat: '🥩',
      vegetable: '🥗',
      other: '🍽️',
    }
    return emojiMap[session.item_category] || '🍽️'
  }

  return (
    <div className={cn('cooling-card !p-3', statusConfig.cardClass)}>
      {/* Header - More compact */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-md shrink-0',
            statusConfig.iconGradient
          )}>
            <span className="drop-shadow-sm">{getCategoryEmoji()}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {referenceNumber !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full bg-theme-ghost text-[10px] font-bold text-theme-muted">
                  #{referenceNumber}
                </span>
              )}
              <h3 className="font-bold text-base text-theme-primary truncate">
                {session.item_name}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-theme-muted">
              <Thermometer className="w-2.5 h-2.5" />
              <span>FSAI SC3 Protocol</span>
            </div>
          </div>
        </div>
        <span className={cn('status-badge text-[10px] py-1 px-2', statusConfig.badgeClass)}>
          {statusConfig.badge}
        </span>
      </div>

      {/* Timer Display - More integrated */}
      <div className="bg-theme-ghost/50 rounded-lg p-2.5 mb-3 flex items-center justify-between">
        <div>
          <p className="text-[9px] text-theme-muted uppercase font-bold tracking-wider mb-0.5">
            Elapsed
          </p>
          <span className={cn('text-2xl font-mono font-bold tracking-tight', statusConfig.timerClass)}>
            {elapsedTime}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-theme-muted uppercase font-bold tracking-wider mb-0.5">
            Remaining
          </p>
          <span className={cn(
            'text-xl font-mono font-bold',
            session.status === 'overdue' ? 'text-red-500 animate-pulse' : statusConfig.accent
          )}>
            {timeRemaining}
          </span>
        </div>
      </div>

      {/* Progress Bar - Thinner */}
      <div className="mb-3">
        <div className="h-1.5 bg-theme-ghost rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              statusConfig.progressGradient
            )}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-theme-muted font-medium">
          <span>{Math.round(progress)}% limit</span>
          <div className="flex gap-2">
            <span className="text-amber-500/80">90m</span>
            <span className="text-red-500/80 font-bold">120m</span>
          </div>
        </div>
      </div>

      {/* Actions - Dense grid */}
      <div className="flex gap-2">
        <button
          onClick={() => onClose(session.id)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-xs transition-all text-white',
            session.status === 'overdue' ? 'gradient-warning' : 'gradient-success'
          )}
        >
          <Snowflake className="w-4 h-4" />
          <span>Move to Fridge</span>
        </button>
        <button
          onClick={() => onDiscard(session.id)}
          className="w-10 flex items-center justify-center rounded-lg bg-theme-ghost text-theme-muted hover:bg-red-500/20 hover:text-red-500 transition-colors"
          title="Discard item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Compact version for list view - Stunning
export function CoolingSensorCardCompact({ session, onClose, onDiscard, referenceNumber }: CoolingSensorCardProps) {
  const [timeRemaining, setTimeRemaining] = useState('')

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date()
      const hardDue = new Date(session.hard_due_at)
      const remainingMs = hardDue.getTime() - now.getTime()

      if (remainingMs <= 0) {
        setTimeRemaining('OVERDUE')
      } else {
        const remainingMins = Math.ceil(remainingMs / (1000 * 60))
        setTimeRemaining(`${remainingMins}m`)
      }
    }

    calculateTime()
    const interval = setInterval(calculateTime, 10000)
    return () => clearInterval(interval)
  }, [session])

  const isOverdue = session.status === 'overdue'
  const isWarning = session.status === 'warning'

  return (
    <div className={cn(
      'flex items-center gap-4 p-4 rounded-xl transition-all card-stunning',
      isOverdue && 'cooling-card-overdue',
      isWarning && 'cooling-card-warning',
      !isOverdue && !isWarning && 'cooling-card-active'
    )}>
      <div className={cn(
        'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg',
        isOverdue ? 'gradient-danger' : isWarning ? 'gradient-warning' : 'gradient-cool'
      )}>
        {isOverdue ? (
          <AlertTriangle className="w-5 h-5 text-white" />
        ) : (
          <Snowflake className="w-5 h-5 text-white" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {referenceNumber !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-theme-ghost text-[10px] font-semibold text-theme-muted">
              #{referenceNumber}
            </span>
          )}
          <h4 className="font-semibold text-theme-primary truncate">
            {session.item_name}
          </h4>
        </div>
        <p className={cn(
          'text-sm font-medium',
          isOverdue ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-theme-muted'
        )}>
          {timeRemaining} {isOverdue ? '' : 'remaining'}
        </p>
      </div>

      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => onClose(session.id)}
          className={cn(
            'p-3 rounded-xl text-white transition-all shadow-lg hover:shadow-xl',
            isOverdue ? 'gradient-warning' : 'gradient-success'
          )}
        >
          <Check className="w-5 h-5" />
        </button>
        <button
          onClick={() => onDiscard(session.id)}
          className="p-3 rounded-xl bg-theme-ghost text-theme-muted hover:bg-red-500/20 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
