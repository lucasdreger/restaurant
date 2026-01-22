import { useState, useMemo } from 'react'
import { ArrowLeft, Calendar, Download, CheckCircle, AlertTriangle, Trash2, Filter, Thermometer, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store/useAppStore'
import type { CoolingSession } from '@/types'
import { cn, getTimeDifferenceMinutes } from '@/lib/utils'
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns'

interface HistoryScreenProps {
  onBack: () => void
}

type DateFilter = 'today' | 'week' | 'month' | 'all'
type StatusFilter = 'all' | 'completed' | 'overdue' | 'discarded'

export function HistoryScreen({ onBack }: HistoryScreenProps) {
  const { coolingSessions } = useAppStore()
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let sessions = coolingSessions.filter((s) => s.closed_at) // Only closed sessions

    // Date filter
    const now = new Date()
    if (dateFilter === 'today') {
      sessions = sessions.filter((s) =>
        isWithinInterval(new Date(s.closed_at!), {
          start: startOfDay(now),
          end: endOfDay(now),
        })
      )
    } else if (dateFilter === 'week') {
      sessions = sessions.filter((s) =>
        isWithinInterval(new Date(s.closed_at!), {
          start: startOfDay(subDays(now, 7)),
          end: endOfDay(now),
        })
      )
    } else if (dateFilter === 'month') {
      sessions = sessions.filter((s) =>
        isWithinInterval(new Date(s.closed_at!), {
          start: startOfDay(subDays(now, 30)),
          end: endOfDay(now),
        })
      )
    }

    // Status filter
    if (statusFilter === 'completed') {
      sessions = sessions.filter((s) => s.close_action === 'in_fridge')
    } else if (statusFilter === 'overdue') {
      sessions = sessions.filter(
        (s) =>
          s.status === 'overdue' ||
          getTimeDifferenceMinutes(new Date(s.started_at), new Date(s.closed_at!)) > 120
      )
    } else if (statusFilter === 'discarded') {
      sessions = sessions.filter((s) => s.close_action === 'discarded')
    }

    return sessions.sort(
      (a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime()
    )
  }, [coolingSessions, dateFilter, statusFilter])

  // Summary stats
  const stats = useMemo(() => {
    const total = filteredSessions.length
    const onTime = filteredSessions.filter(
      (s) =>
        s.close_action === 'in_fridge' &&
        getTimeDifferenceMinutes(new Date(s.started_at), new Date(s.closed_at!)) <= 120
    ).length
    const late = filteredSessions.filter(
      (s) =>
        getTimeDifferenceMinutes(new Date(s.started_at), new Date(s.closed_at!)) > 120
    ).length
    const discarded = filteredSessions.filter((s) => s.close_action === 'discarded').length

    return { total, onTime, late, discarded }
  }, [filteredSessions])

  const handleExport = () => {
    // Generate CSV export (FSAI SC3 compliant format)
    const headers = [
      'Date',
      'Item',
      'Category',
      'Started',
      'Closed',
      'Duration (min)',
      'End Temp (°C)',
      'Temp Compliant',
      'Status',
      'Action',
      'Staff',
      'Exception',
    ]
    const rows = filteredSessions.map((s) => {
      const duration = s.closed_at
        ? getTimeDifferenceMinutes(new Date(s.started_at), new Date(s.closed_at))
        : 0
      const tempCompliant = s.end_temperature !== undefined ? (s.end_temperature < 8 ? 'Yes' : 'No') : ''
      return [
        format(new Date(s.started_at), 'yyyy-MM-dd'),
        `"${s.item_name}"`, // Quote to handle commas in names
        s.item_category,
        format(new Date(s.started_at), 'HH:mm'),
        s.closed_at ? format(new Date(s.closed_at), 'HH:mm') : '',
        duration.toString(),
        s.end_temperature !== undefined ? s.end_temperature.toString() : '',
        tempCompliant,
        s.status,
        s.close_action || '',
        s.closed_by || '',
        s.exception_reason ? `"${s.exception_reason}"` : '',
      ]
    })

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fsai-sc3-cooling-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-theme-primary">
      {/* Header */}
      <header className="safe-area-top bg-theme-header border-b border-theme-header sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-theme-ghost rounded-xl transition-colors text-theme-primary"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-theme-primary">Cooling History</h1>
          </div>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="w-5 h-5 mr-2" />
            Export
          </Button>
        </div>
      </header>

      <main className="p-4">
        {/* Filters */}
        <div className="mb-6 space-y-3">
          {/* Date Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(['today', 'week', 'month', 'all'] as DateFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={cn(
                  'flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-colors',
                  dateFilter === filter
                    ? 'bg-sky-500 text-white'
                    : 'bg-theme-ghost text-theme-secondary hover:bg-theme-elevated'
                )}
              >
                {filter === 'today' && 'Today'}
                {filter === 'week' && 'This Week'}
                {filter === 'month' && 'This Month'}
                {filter === 'all' && 'All Time'}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(['all', 'completed', 'overdue', 'discarded'] as StatusFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={cn(
                  'flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2',
                  statusFilter === filter
                    ? 'bg-theme-elevated text-theme-primary'
                    : 'bg-theme-ghost text-theme-muted hover:bg-theme-elevated'
                )}
              >
                {filter === 'all' && <Filter className="w-4 h-4" />}
                {filter === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                {filter === 'overdue' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                {filter === 'discarded' && <Trash2 className="w-4 h-4 text-red-500" />}
                <span className="capitalize">{filter}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-theme-card rounded-xl p-3 text-center border border-theme-primary">
            <p className="text-2xl font-bold text-theme-primary">{stats.total}</p>
            <p className="text-xs text-theme-muted">Total</p>
          </div>
          <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/30">
            <p className="text-2xl font-bold text-green-500">{stats.onTime}</p>
            <p className="text-xs text-theme-muted">On Time</p>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-3 text-center border border-amber-500/30">
            <p className="text-2xl font-bold text-amber-500">{stats.late}</p>
            <p className="text-xs text-theme-muted">Late</p>
          </div>
          <div className="bg-red-500/10 rounded-xl p-3 text-center border border-red-500/30">
            <p className="text-2xl font-bold text-red-500">{stats.discarded}</p>
            <p className="text-xs text-theme-muted">Discarded</p>
          </div>
        </div>

        {/* Sessions List */}
        <div className="space-y-3">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-theme-muted mx-auto mb-3" />
              <p className="text-theme-secondary">No sessions found for this period</p>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <HistoryItem key={session.id} session={session} />
            ))
          )}
        </div>
      </main>
    </div>
  )
}

function HistoryItem({ session }: { session: CoolingSession }) {
  const duration = session.closed_at
    ? getTimeDifferenceMinutes(new Date(session.started_at), new Date(session.closed_at))
    : 0
  const isLate = duration > 120
  const tempCompliant = session.end_temperature !== undefined && session.end_temperature < 8

  const statusIcon = {
    closed: <CheckCircle className="w-5 h-5 text-green-500" />,
    overdue: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    discarded: <Trash2 className="w-5 h-5 text-red-500" />,
  }

  const icon = session.close_action === 'discarded' 
    ? statusIcon.discarded 
    : isLate 
    ? statusIcon.overdue 
    : statusIcon.closed

  return (
    <div className="bg-theme-card rounded-xl p-4 border border-theme-primary">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="font-bold text-theme-primary">{session.item_name}</p>
            <p className="text-sm text-theme-muted">
              {format(new Date(session.started_at), 'MMM d, HH:mm')} →{' '}
              {session.closed_at && format(new Date(session.closed_at), 'HH:mm')}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className={cn(
              'font-mono font-bold',
              isLate ? 'text-amber-500' : 'text-green-500'
            )}
          >
            {duration}m
          </p>
          <p className="text-xs text-theme-muted capitalize">
            {session.close_action?.replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Temperature & Staff Info Row */}
      {(session.end_temperature !== undefined || session.closed_by) && (
        <div className="mt-3 flex items-center gap-4 text-sm">
          {session.end_temperature !== undefined && (
            <div className="flex items-center gap-1.5">
              <Thermometer className={cn(
                'w-4 h-4',
                tempCompliant ? 'text-emerald-500' : 'text-amber-500'
              )} />
              <span className={cn(
                'font-mono font-medium',
                tempCompliant ? 'text-emerald-500' : 'text-amber-500'
              )}>
                {session.end_temperature}°C
              </span>
              {tempCompliant ? (
                <span className="text-emerald-500 text-xs">✓</span>
              ) : (
                <span className="text-amber-500 text-xs">!</span>
              )}
            </div>
          )}
          {session.closed_by && (
            <div className="flex items-center gap-1.5 text-theme-secondary">
              <User className="w-4 h-4" />
              <span>{session.closed_by}</span>
            </div>
          )}
        </div>
      )}

      {/* Exception Note */}
      {session.exception_reason && (
        <div className="mt-2 p-2 bg-theme-secondary rounded-lg text-sm text-theme-secondary">
          <span className="text-theme-muted">Exception:</span> {session.exception_reason}
        </div>
      )}
    </div>
  )
}
