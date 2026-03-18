import { useEffect, useRef, useCallback } from 'react'
import { X, Bell, BellOff, ChevronRight, Clock, AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStoreShallow, getUnacknowledgedAlerts } from '@/store/useAppStore'
import type { Alert } from '@/types'

interface NotificationCenterProps {
    isOpen: boolean
    onClose: () => void
    onNavigateToSession?: (sessionId: string) => void
}

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    return `${diffDays}d ago`
}

export function NotificationCenter({ isOpen, onClose, onNavigateToSession }: NotificationCenterProps) {
    const { alerts, acknowledgeAlert } = useAppStoreShallow((state) => ({
        alerts: state.alerts,
        acknowledgeAlert: state.acknowledgeAlert,
    }))
    const panelRef = useRef<HTMLDivElement>(null)

    const unacknowledgedAlerts = getUnacknowledgedAlerts(alerts)
    const acknowledgedAlerts = alerts.filter(a => a.acknowledged)

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            return () => document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        if (isOpen) {
            setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen, onClose])

    const handleViewSession = useCallback((alert: Alert) => {
        acknowledgeAlert(alert.id)
        onNavigateToSession?.(alert.session_id)
        onClose()
    }, [acknowledgeAlert, onNavigateToSession, onClose])

    const handleDismiss = useCallback((alertId: string) => {
        acknowledgeAlert(alertId)
    }, [acknowledgeAlert])

    const handleClearAll = useCallback(() => {
        alerts.forEach(a => acknowledgeAlert(a.id))
    }, [alerts, acknowledgeAlert])

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 animate-fade-in"
                aria-hidden="true"
            />

            {/* Technical Notification Panel */}
            <div
                ref={panelRef}
                className={cn(
                    "fixed right-0 top-0 h-full w-full max-w-sm bg-theme-secondary border-l border-theme-primary shadow-2xl z-50",
                    "flex flex-col",
                    "animate-slide-in-right"
                )}
                role="dialog"
                aria-modal="true"
                aria-label="System Notifications"
            >
                {/* Technical Header */}
                <div className="flex items-center justify-between p-4 border-b border-theme-primary bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-red-500/10 flex items-center justify-center border border-red-500/20">
                            <Bell className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-theme-primary uppercase tracking-tighter">Event Monitor</h2>
                            <p className="data-label">
                                {unacknowledgedAlerts.length} UNRESOLVED THREADS
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {alerts.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-theme-muted hover:text-red-500 transition-all"
                            >
                                PURGE
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-theme-muted hover:text-theme-primary transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Matrix */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {alerts.length === 0 ? (
                        /* System Idle State */
                        <div className="flex flex-col items-center justify-center h-full text-center py-12 opacity-20">
                            <BellOff className="w-12 h-12 text-theme-muted mb-4" />
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-theme-primary">System Normal</h3>
                            <p className="text-[10px] font-mono mt-2 uppercase">No anomalous events detected.</p>
                        </div>
                    ) : (
                        <>
                            {/* Priority Feed */}
                            {unacknowledgedAlerts.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 px-1 mb-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        <h3 className="data-label">Critical Feed</h3>
                                    </div>
                                    {unacknowledgedAlerts.map((alert) => (
                                        <NotificationCard
                                            key={alert.id}
                                            alert={alert}
                                            onView={() => handleViewSession(alert)}
                                            onDismiss={() => handleDismiss(alert.id)}
                                            isNew
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Historical Log */}
                            {acknowledgedAlerts.length > 0 && (
                                <div className="space-y-2 mt-8">
                                    <h3 className="data-label px-1 opacity-40">Archived Events</h3>
                                    {acknowledgedAlerts.slice(0, 10).map((alert) => (
                                        <NotificationCard
                                            key={alert.id}
                                            alert={alert}
                                            onView={() => handleViewSession(alert)}
                                            onDismiss={() => handleDismiss(alert.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* System Diagnostics Footer */}
                <div className="p-4 border-t border-theme-primary bg-black/40">
                    <p className="text-[8px] font-mono text-white/20 uppercase tracking-widest text-center leading-relaxed">
                        Alert protocols triggered by automated HACCP boundary validation engine v1.0.2
                    </p>
                </div>
            </div>
        </>
    )
}

interface NotificationCardProps {
    alert: Alert
    onView: () => void
    onDismiss: () => void
    isNew?: boolean
}

function NotificationCard({ alert, onView, onDismiss, isNew }: NotificationCardProps) {
    const isOverdue = alert.type === 'overdue'

    return (
        <div
            className={cn(
                "relative p-3 rounded border transition-all group overflow-hidden",
                isNew
                    ? isOverdue ? "bg-red-500/10 border-red-500/30" : "bg-amber-500/10 border-amber-500/30"
                    : "bg-black/20 border-theme-primary opacity-50 grayscale hover:opacity-100 hover:grayscale-0"
            )}
        >
            <div className="flex items-start gap-3">
                {/* Identification */}
                <div
                    className={cn(
                        "w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-sm",
                        isOverdue ? "bg-red-600 text-white" : "bg-amber-600 text-slate-900"
                    )}
                >
                    {isOverdue ? (
                        <AlertTriangle className="w-4 h-4" />
                    ) : (
                        <Clock className="w-4 h-4" />
                    )}
                </div>

                {/* Telemetry Data */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <span
                            className={cn(
                                "text-[9px] font-black uppercase tracking-widest",
                                isOverdue ? "text-red-500" : "text-amber-500"
                            )}
                        >
                            {isOverdue ? "Threshold Exceeded" : "Warning Level"}
                        </span>
                        <span className="text-[8px] font-mono text-theme-muted uppercase tracking-tighter">
                            {formatRelativeTime(alert.triggered_at)}
                        </span>
                    </div>
                    <p className="text-[11px] font-bold text-theme-primary leading-tight uppercase tracking-tight">
                        {alert.message}
                    </p>
                </div>

                {/* Tactical Actions */}
                <div className="flex gap-1">
                    <button
                        onClick={onView}
                        className="w-8 h-8 flex items-center justify-center rounded border border-theme-primary bg-theme-secondary text-theme-muted hover:text-theme-primary transition-all"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    {!alert.acknowledged && (
                        <button
                            onClick={onDismiss}
                            className="w-8 h-8 flex items-center justify-center rounded border border-theme-primary bg-theme-secondary text-theme-muted hover:text-emerald-500 transition-all"
                        >
                            <Check className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Visual Priority Overlay */}
            {isNew && (
                <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1",
                    isOverdue ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-amber-500"
                )} />
            )}
        </div>
    )
}
