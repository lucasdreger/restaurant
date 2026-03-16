import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Download,
  Filter,
  Snowflake,
  Thermometer,
  Trash2,
  User,
  Workflow,
} from 'lucide-react'
import { format, endOfDay, isWithinInterval, startOfDay, subDays } from 'date-fns'
import { LegacyHaccpHistoryPanel } from '@/components/haccp/LegacyHaccpHistoryPanel'
import { Button } from '@/components/ui/Button'
import { useCoolingHistory } from '@/hooks/queries/useCooling'
import { useHaccpLifecycles } from '@/hooks/queries/useHaccp'
import { cn, getTimeDifferenceMinutes } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { CoolingSession } from '@/types'

interface HistoryScreenProps {
  onBack: () => void
}

type DateFilter = 'today' | 'week' | 'month' | 'all'
type StatusFilter = 'all' | 'completed' | 'overdue' | 'discarded'
type HistoryMode = 'haccp' | 'cooling'

export function HistoryScreen({ onBack }: HistoryScreenProps) {
  const { currentSite } = useAppStore()
  const { data: lifecycles = [] } = useHaccpLifecycles(currentSite?.id)
  const { data: coolingSessions = [] } = useCoolingHistory(currentSite?.id)
  const [historyMode, setHistoryMode] = useState<HistoryMode>('haccp')
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const closedCoolingSessions = useMemo(
    () => coolingSessions.filter((session) => session.closed_at),
    [coolingSessions],
  )

  const filteredSessions = useMemo(() => {
    let sessions = [...closedCoolingSessions]
    const now = new Date()

    if (dateFilter === 'today') {
      sessions = sessions.filter((session) =>
        isWithinInterval(new Date(session.closed_at!), {
          start: startOfDay(now),
          end: endOfDay(now),
        }),
      )
    } else if (dateFilter === 'week') {
      sessions = sessions.filter((session) =>
        isWithinInterval(new Date(session.closed_at!), {
          start: startOfDay(subDays(now, 7)),
          end: endOfDay(now),
        }),
      )
    } else if (dateFilter === 'month') {
      sessions = sessions.filter((session) =>
        isWithinInterval(new Date(session.closed_at!), {
          start: startOfDay(subDays(now, 30)),
          end: endOfDay(now),
        }),
      )
    }

    if (statusFilter === 'completed') {
      sessions = sessions.filter((session) => session.close_action === 'in_fridge')
    } else if (statusFilter === 'overdue') {
      sessions = sessions.filter(
        (session) =>
          session.status === 'overdue' ||
          getTimeDifferenceMinutes(new Date(session.started_at), new Date(session.closed_at!)) > 120,
      )
    } else if (statusFilter === 'discarded') {
      sessions = sessions.filter((session) => session.close_action === 'discarded')
    }

    return sessions.sort(
      (a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime(),
    )
  }, [closedCoolingSessions, dateFilter, statusFilter])

  const stats = useMemo(() => {
    const total = filteredSessions.length
    const onTime = filteredSessions.filter(
      (session) =>
        session.close_action === 'in_fridge' &&
        getTimeDifferenceMinutes(new Date(session.started_at), new Date(session.closed_at!)) <= 120,
    ).length
    const late = filteredSessions.filter(
      (session) =>
        getTimeDifferenceMinutes(new Date(session.started_at), new Date(session.closed_at!)) > 120,
    ).length
    const discarded = filteredSessions.filter((session) => session.close_action === 'discarded').length

    return { total, onTime, late, discarded }
  }, [filteredSessions])

  const handleExportCooling = () => {
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

    const rows = filteredSessions.map((session) => {
      const duration = session.closed_at
        ? getTimeDifferenceMinutes(new Date(session.started_at), new Date(session.closed_at))
        : 0
      const tempCompliant =
        session.end_temperature !== undefined ? (session.end_temperature < 8 ? 'Yes' : 'No') : ''

      return [
        format(new Date(session.started_at), 'yyyy-MM-dd'),
        `"${session.item_name}"`,
        session.item_category,
        format(new Date(session.started_at), 'HH:mm'),
        session.closed_at ? format(new Date(session.closed_at), 'HH:mm') : '',
        duration.toString(),
        session.end_temperature !== undefined ? session.end_temperature.toString() : '',
        tempCompliant,
        session.status,
        session.close_action || '',
        session.closed_by || '',
        session.exception_reason ? `"${session.exception_reason}"` : '',
      ]
    })

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `fsai-sc3-cooling-${format(new Date(), 'yyyy-MM-dd')}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-full bg-theme-primary text-theme-primary">
      <header className="safe-area-top sticky top-0 z-40 border-b border-theme-header bg-theme-header">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="lg:hidden rounded-xl p-2 text-theme-primary transition-colors hover:bg-theme-ghost"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-theme-primary">Compliance History</h1>
              <p className="text-xs text-theme-muted">
                {historyMode === 'haccp'
                  ? 'Cook, cool, reheat and hold lifecycle records'
                  : 'Legacy cooling session register'}
              </p>
            </div>
          </div>

          {historyMode === 'cooling' ? (
            <Button variant="secondary" size="sm" onClick={handleExportCooling}>
              <Download className="w-5 h-5 mr-2" />
              Export
            </Button>
          ) : null}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          <HistoryModeCard
            active={historyMode === 'haccp'}
            icon={Workflow}
            label="HACCP Lifecycle"
            detail={`${lifecycles.length} batch chain${lifecycles.length === 1 ? '' : 's'}`}
            onClick={() => setHistoryMode('haccp')}
          />
          <HistoryModeCard
            active={historyMode === 'cooling'}
            icon={Snowflake}
            label="Cooling Logs"
            detail={`${closedCoolingSessions.length} closed session${closedCoolingSessions.length === 1 ? '' : 's'}`}
            onClick={() => setHistoryMode('cooling')}
          />
        </div>

        {historyMode === 'haccp' ? (
          <LegacyHaccpHistoryPanel lifecycles={lifecycles} />
        ) : (
          <>
            <div className="mb-6 space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {(['today', 'week', 'month', 'all'] as DateFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDateFilter(filter)}
                    className={cn(
                      'flex-shrink-0 rounded-xl px-4 py-2 font-medium transition-colors',
                      dateFilter === filter
                        ? 'bg-sky-500 text-white'
                        : 'bg-theme-ghost text-theme-secondary hover:bg-theme-elevated',
                    )}
                  >
                    {filter === 'today' && 'Today'}
                    {filter === 'week' && 'This Week'}
                    {filter === 'month' && 'This Month'}
                    {filter === 'all' && 'All Time'}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {(['all', 'completed', 'overdue', 'discarded'] as StatusFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={cn(
                      'flex-shrink-0 rounded-xl px-4 py-2 font-medium transition-colors flex items-center gap-2',
                      statusFilter === filter
                        ? 'bg-theme-elevated text-theme-primary'
                        : 'bg-theme-ghost text-theme-muted hover:bg-theme-elevated',
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

            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="rounded-xl border border-theme-primary bg-theme-card p-3 text-center">
                <p className="text-2xl font-bold text-theme-primary">{stats.total}</p>
                <p className="text-xs text-theme-muted">Total</p>
              </div>
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-green-500">{stats.onTime}</p>
                <p className="text-xs text-theme-muted">On Time</p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-amber-500">{stats.late}</p>
                <p className="text-xs text-theme-muted">Late</p>
              </div>
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-red-500">{stats.discarded}</p>
                <p className="text-xs text-theme-muted">Discarded</p>
              </div>
            </div>

            <div className="space-y-3">
              {filteredSessions.length === 0 ? (
                <div className="py-12 text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-theme-muted" />
                  <p className="text-theme-secondary">No sessions found for this period</p>
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <HistoryItem key={session.id} session={session} />
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function HistoryModeCard({
  active,
  icon: Icon,
  label,
  detail,
  onClick,
}: {
  active: boolean
  icon: typeof Workflow
  label: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-shrink-0 rounded-2xl border px-4 py-3 text-left transition-colors',
        active
          ? 'border-sky-500/40 bg-sky-500 text-white'
          : 'border-theme-primary bg-theme-card text-theme-secondary hover:bg-theme-elevated',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="font-semibold">{label}</span>
      </div>
      <p className={cn('mt-1 text-xs', active ? 'text-white/80' : 'text-theme-muted')}>{detail}</p>
    </button>
  )
}

function HistoryItem({ session }: { session: CoolingSession }) {
  const duration = session.closed_at
    ? getTimeDifferenceMinutes(new Date(session.started_at), new Date(session.closed_at))
    : 0
  const isLate = duration > 120
  const tempCompliant = session.end_temperature !== undefined && session.end_temperature < 8

  const icon =
    session.close_action === 'discarded' ? (
      <Trash2 className="w-5 h-5 text-red-500" />
    ) : isLate ? (
      <AlertTriangle className="w-5 h-5 text-amber-500" />
    ) : (
      <CheckCircle className="w-5 h-5 text-green-500" />
    )

  return (
    <div className="rounded-xl border border-theme-primary bg-theme-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="font-bold text-theme-primary">{session.item_name}</p>
            <p className="text-sm text-theme-muted">
              {format(new Date(session.started_at), 'MMM d, HH:mm')} {'->'}{' '}
              {session.closed_at ? format(new Date(session.closed_at), 'HH:mm') : ''}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className={cn('font-mono font-bold', isLate ? 'text-amber-500' : 'text-green-500')}>
            {duration}m
          </p>
          <p className="text-xs capitalize text-theme-muted">{session.close_action?.replace('_', ' ')}</p>
        </div>
      </div>

      {(session.end_temperature !== undefined || session.closed_by) ? (
        <div className="mt-3 flex items-center gap-4 text-sm">
          {session.end_temperature !== undefined ? (
            <div className="flex items-center gap-1.5">
              <Thermometer className={cn('w-4 h-4', tempCompliant ? 'text-emerald-500' : 'text-amber-500')} />
              <span className={cn('font-mono font-medium', tempCompliant ? 'text-emerald-500' : 'text-amber-500')}>
                {session.end_temperature}°C
              </span>
              <span className={cn('text-xs', tempCompliant ? 'text-emerald-500' : 'text-amber-500')}>
                {tempCompliant ? '✓' : '!'}
              </span>
            </div>
          ) : null}

          {session.closed_by ? (
            <div className="flex items-center gap-1.5 text-theme-secondary">
              <User className="w-4 h-4" />
              <span>{session.closed_by}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {session.exception_reason ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-theme-secondary">
          <span className="font-medium text-amber-500">Exception:</span> {session.exception_reason}
        </div>
      ) : null}
    </div>
  )
}
