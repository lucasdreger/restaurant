import { Wifi, WifiOff, Clock, AlertTriangle, CheckCircle, Settings } from 'lucide-react'
import { useAppStore, getActiveSessions, getOverdueSessions } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { useEffect, useState, useMemo } from 'react'

interface StatusHeaderProps {
  onSettingsClick?: () => void
}

export function StatusHeader({ onSettingsClick }: StatusHeaderProps) {
  const { isOnline, currentSite, coolingSessions, settings } = useAppStore()
  const [currentTime, setCurrentTime] = useState(new Date())

  // Use memoized selectors
  const activeSessions = useMemo(() => getActiveSessions(coolingSessions), [coolingSessions])
  const overdueSessions = useMemo(() => getOverdueSessions(coolingSessions), [coolingSessions])

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const hasOverdue = overdueSessions.length > 0
  const hasActive = activeSessions.length > 0

  return (
    <header className="safe-area-top bg-theme-card/95 backdrop-blur-sm border-b border-theme-primary sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Site Name & Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {hasOverdue ? (
              <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
            ) : hasActive ? (
              <div className="status-dot status-dot-safe" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-400" />
            )}
            <span className="font-bold text-lg">
              {settings.restaurantName || currentSite?.name || 'Kitchen'}
            </span>
          </div>
        </div>

        {/* Center: Clock */}
        <div className="flex items-center gap-2 text-theme-secondary">
          <Clock className="w-5 h-5" />
          <span className="font-mono text-xl font-medium">
            {currentTime.toLocaleTimeString('en-IE', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </span>
        </div>

        {/* Right: Status Icons */}
        <div className="flex items-center gap-3">
          {/* Active Sessions Count */}
          {hasActive && (
            <div
              className={cn(
                'flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium',
                hasOverdue
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-sky-500/20 text-sky-400'
              )}
            >
              <span>{activeSessions.length}</span>
              <span>cooling</span>
            </div>
          )}

          {/* Connection Status */}
          <div
            className={cn(
              'p-2 rounded-lg',
              isOnline ? 'text-green-400' : 'text-red-400 bg-red-500/10'
            )}
            title={isOnline ? 'Online' : 'Offline - data will sync later'}
          >
            {isOnline ? (
              <Wifi className="w-5 h-5" />
            ) : (
              <WifiOff className="w-5 h-5 animate-pulse" />
            )}
          </div>

          {/* Settings */}
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="p-2 hover:bg-theme-ghost rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-theme-muted" />
            </button>
          )}
        </div>
      </div>

      {/* Overdue Warning Banner */}
      {hasOverdue && (
        <div className="bg-red-500/20 border-t border-red-500/30 px-4 py-2 animate-pulse">
          <p className="text-center text-red-400 font-bold">
            🚨 {overdueSessions.length} item{overdueSessions.length > 1 ? 's' : ''} OVERDUE - Action required!
          </p>
        </div>
      )}
    </header>
  )
}
