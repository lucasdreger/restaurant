import { Shield, Bell, Search, CheckCircle, Clock, AlertTriangle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
  complianceStatus: 'ready' | 'warning' | 'critical'
  lastAudit?: string
  autoLogging?: boolean
  notificationCount?: number
  onNotificationsClick?: () => void
}

export function DashboardHeader({ 
  complianceStatus = 'ready', 
  lastAudit = 'Today',
  autoLogging = true,
  notificationCount = 0,
  onNotificationsClick 
}: DashboardHeaderProps) {
  const statusConfig = {
    ready: {
      gradient: 'gradient-success',
      bgLight: 'bg-green-500/10',
      text: 'text-green-500',
      icon: CheckCircle,
      label: 'INSPECTION READY',
      sublabel: 'FSAI ALIGNED',
    },
    warning: {
      gradient: 'gradient-warning',
      bgLight: 'bg-amber-500/10',
      text: 'text-amber-500',
      icon: Clock,
      label: 'ATTENTION NEEDED',
      sublabel: 'REVIEW REQUIRED',
    },
    critical: {
      gradient: 'gradient-danger',
      bgLight: 'bg-red-500/10',
      text: 'text-red-500',
      icon: AlertTriangle,
      label: 'ACTION REQUIRED',
      sublabel: 'NON-COMPLIANT',
    },
  }

  const config = statusConfig[complianceStatus]
  const StatusIcon = config.icon

  return (
    <header className="bg-glass-heavy border-b border-glass px-4 lg:px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Legal Status Badge - Stunning Version */}
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl',
          config.bgLight
        )}>
          <div className={cn('p-2 rounded-lg', config.gradient)}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <StatusIcon className={cn('w-4 h-4', config.text)} />
              <p className={cn('text-sm font-bold', config.text)}>
                {config.label}
              </p>
            </div>
            <p className="text-xs text-theme-muted">
              {config.sublabel} • Last Audit: {lastAudit}
            </p>
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-3">
          {autoLogging && (
            <div className="flex items-center gap-2 px-3 py-2 bg-theme-card rounded-xl border border-theme-primary shadow-theme-sm">
              <div className="relative">
                <Zap className="w-4 h-4 text-green-500" />
                <div className="absolute inset-0 animate-ping">
                  <Zap className="w-4 h-4 text-green-500 opacity-50" />
                </div>
              </div>
              <span className="text-xs font-semibold text-theme-primary">
                AUTO-LOGGING
              </span>
            </div>
          )}
          
          <button 
            onClick={onNotificationsClick}
            className="relative p-2.5 rounded-xl bg-theme-card border border-theme-primary hover:shadow-theme-md transition-all"
            title="View notifications"
          >
            <Bell className="w-5 h-5 text-theme-secondary" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 gradient-danger rounded-full text-[10px] text-white font-bold flex items-center justify-center shadow-lg animate-pulse">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search and Actions Row - Desktop */}
      <div className="hidden md:flex items-center gap-4 mt-4">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-theme-primary to-theme-secondary">
            Kitchen Command Center
          </h1>
          <p className="text-sm text-theme-muted">Real-time cooling compliance monitoring</p>
        </div>
        <div className="flex-1 max-w-md ml-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none" />
            <input
              type="text"
              placeholder="    Search records, items, staff..."
              className="input-stunning pl-11"
            />
          </div>
        </div>
      </div>

      {/* Mobile Title */}
      <div className="md:hidden mt-4">
        <h1 className="text-xl font-bold text-theme-primary">
          Command Center
        </h1>
        <p className="text-xs text-theme-muted">Real-time cooling compliance</p>
      </div>
    </header>
  )
}

// Progress card component for daily compliance cycles - Stunning Version
interface ProgressCardProps {
  title: string
  subtitle?: string
  value: number | string
  maxValue?: number
  status: 'complete' | 'in-progress' | 'pending' | 'warning'
  onClick?: () => void
}

export function ProgressCard({ title, subtitle, value, maxValue = 100, status, onClick }: ProgressCardProps) {
  const statusConfig = {
    complete: {
      gradient: 'gradient-success',
      bgLight: 'bg-green-500/5',
      progressBg: 'gradient-success',
      text: 'text-green-500',
      icon: CheckCircle,
    },
    'in-progress': {
      gradient: 'gradient-warning',
      bgLight: 'bg-amber-500/5',
      progressBg: 'gradient-warning',
      text: 'text-amber-500',
      icon: Clock,
    },
    pending: {
      gradient: 'bg-theme-ghost',
      bgLight: 'bg-theme-ghost',
      progressBg: 'bg-theme-muted',
      text: 'text-theme-muted',
      icon: Clock,
    },
    warning: {
      gradient: 'gradient-danger',
      bgLight: 'bg-red-500/5',
      progressBg: 'gradient-danger',
      text: 'text-red-500',
      icon: AlertTriangle,
    },
  }

  const config = statusConfig[status]
  const percentage = typeof value === 'number' ? (value / maxValue) * 100 : 0
  const StatusIcon = config.icon

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 min-w-[160px] p-4 rounded-xl text-left transition-all card-stunning',
        'hover:shadow-theme-lg hover:-translate-y-0.5',
        config.bgLight
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-theme-muted uppercase tracking-wide">
          {title}
        </p>
        <StatusIcon className={cn('w-4 h-4', config.text)} />
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className={cn('text-3xl font-bold', config.text)}>
          {typeof value === 'number' ? value : value}
        </span>
        {typeof value === 'number' && (
          <span className={cn('text-lg font-semibold', config.text)}>%</span>
        )}
      </div>
      {typeof value === 'number' && (
        <div className="h-2 bg-theme-ghost rounded-full overflow-hidden">
          <div 
            className={cn('h-full rounded-full transition-all duration-700', config.progressBg)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
      {subtitle && (
        <p className="text-xs text-theme-muted mt-2 truncate">
          {subtitle}
        </p>
      )}
    </button>
  )
}
