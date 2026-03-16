import { useMemo, useState } from 'react'
import { CalendarClock, Download, Flame, Snowflake, Soup, TimerReset, TriangleAlert } from 'lucide-react'
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { WorkflowKind } from '@/types'
import type { HaccpLifecycle } from '@/services/haccpService'

type DateFilter = 'today' | 'week' | 'month' | 'all'
type KindFilter = 'all' | WorkflowKind

interface LegacyHaccpHistoryPanelProps {
  lifecycles: HaccpLifecycle[]
}

const KIND_META: Record<WorkflowKind, { label: string; icon: typeof Flame; color: string }> = {
  cooking: { label: 'Cook', icon: Flame, color: 'text-amber-500' },
  cooling: { label: 'Cool', icon: Snowflake, color: 'text-sky-500' },
  reheating: { label: 'Reheat', icon: Soup, color: 'text-orange-500' },
  hot_hold: { label: 'Hold', icon: TimerReset, color: 'text-red-500' },
}

export function LegacyHaccpHistoryPanel({ lifecycles }: LegacyHaccpHistoryPanelProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')

  const filtered = useMemo(() => {
    const now = new Date()

    return lifecycles
      .filter((lifecycle) => {
        const anchorDate = new Date(lifecycle.batch.updated_at ?? lifecycle.batch.created_at)

        if (dateFilter === 'today') {
          return isWithinInterval(anchorDate, { start: startOfDay(now), end: endOfDay(now) })
        }

        if (dateFilter === 'week') {
          return isWithinInterval(anchorDate, {
            start: startOfDay(subDays(now, 7)),
            end: endOfDay(now),
          })
        }

        if (dateFilter === 'month') {
          return isWithinInterval(anchorDate, {
            start: startOfDay(subDays(now, 30)),
            end: endOfDay(now),
          })
        }

        return true
      })
      .filter((lifecycle) => {
        if (kindFilter === 'all') return true
        return lifecycle.workflows.some((workflow) => workflow.workflow_kind === kindFilter)
      })
      .sort(
        (a, b) =>
          new Date(b.batch.updated_at ?? b.batch.created_at).getTime() -
          new Date(a.batch.updated_at ?? a.batch.created_at).getTime(),
      )
  }, [dateFilter, kindFilter, lifecycles])

  const stats = useMemo(() => {
    const chains = filtered.length
    const needsAction = filtered.filter((lifecycle) =>
      lifecycle.workflows.some((workflow) => workflow.state === 'needs_action'),
    ).length
    const discarded = filtered.filter((lifecycle) =>
      lifecycle.workflows.some((workflow) => workflow.state === 'discarded'),
    ).length
    const holdChains = filtered.filter((lifecycle) =>
      lifecycle.workflows.some((workflow) => workflow.workflow_kind === 'hot_hold'),
    ).length

    return { chains, needsAction, discarded, holdChains }
  }, [filtered])

  const handleExport = () => {
    const headers = ['Item', 'Batch ID', 'Chain', 'Current Location', 'Last Temp', 'Updated At', 'Issues']
    const rows = filtered.map((lifecycle) => [
      `"${lifecycle.batch.item_name}"`,
      lifecycle.batch.id,
      `"${lifecycle.workflows.map((workflow) => workflow.workflow_kind).join(' -> ')}"`,
      `"${lifecycle.batch.location_label || lifecycle.batch.location_kind}"`,
      lifecycle.batch.last_temperature != null ? lifecycle.batch.last_temperature.toFixed(1) : '',
      lifecycle.batch.updated_at ?? lifecycle.batch.created_at,
      lifecycle.workflows.some((workflow) => workflow.state === 'needs_action') ? 'needs_action' : '',
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `chefvoice-haccp-history-${format(new Date(), 'yyyy-MM-dd')}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-purple-500/15 flex items-center justify-center">
              <span className="text-purple-500 text-xs">H</span>
            </div>
            <h2 className="text-xs font-semibold text-theme-secondary uppercase tracking-wide">
              HACCP Lifecycle History
            </h2>
          </div>
          <p className="text-lg font-semibold text-theme-primary">
            Full batch chains across cook, cool, reheat and hold.
          </p>
          <p className="text-sm text-theme-muted mt-1">
            Review the full lifecycle without leaving the legacy reporting layout.
          </p>
        </div>

        <Button variant="secondary" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export HACCP CSV
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['today', 'week', 'month', 'all'] as DateFilter[]).map((option) => (
            <button
              key={option}
              onClick={() => setDateFilter(option)}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-colors',
                dateFilter === option
                  ? 'bg-sky-500 text-white'
                  : 'bg-theme-ghost text-theme-secondary hover:bg-theme-elevated',
              )}
            >
              {option === 'today' && 'Today'}
              {option === 'week' && 'This Week'}
              {option === 'month' && 'This Month'}
              {option === 'all' && 'All Time'}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['all', 'cooking', 'cooling', 'reheating', 'hot_hold'] as KindFilter[]).map((option) => (
            <button
              key={option}
              onClick={() => setKindFilter(option)}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-colors',
                kindFilter === option
                  ? 'bg-theme-elevated text-theme-primary'
                  : 'bg-theme-ghost text-theme-muted hover:bg-theme-elevated',
              )}
            >
              {option === 'all' ? 'All stages' : KIND_META[option].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <HistoryStat label="Chains" value={stats.chains} />
        <HistoryStat label="Needs Action" value={stats.needsAction} tone="danger" />
        <HistoryStat label="Hold Chains" value={stats.holdChains} tone="warm" />
        <HistoryStat label="Discarded" value={stats.discarded} tone="danger" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-theme-card rounded-2xl border border-theme-primary p-10 text-center">
          <CalendarClock className="w-12 h-12 text-theme-muted mx-auto mb-3" />
          <p className="text-lg font-semibold text-theme-primary">No HACCP lifecycle records in this view.</p>
          <p className="text-sm text-theme-muted mt-2">Adjust the filters or create a new batch from the dashboard.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((lifecycle) => {
            const issues = lifecycle.workflows.filter(
              (workflow) => workflow.state === 'needs_action' || workflow.state === 'discarded',
            )

            return (
              <article
                key={lifecycle.batch.id}
                className="rounded-2xl border border-theme-primary bg-theme-card p-5 shadow-theme-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">Batch</p>
                    <h3 className="mt-2 text-2xl font-semibold text-theme-primary">{lifecycle.batch.item_name}</h3>
                    <p className="mt-1 text-sm text-theme-secondary">
                      {lifecycle.batch.location_label || lifecycle.batch.location_kind} • Updated{' '}
                      {format(new Date(lifecycle.batch.updated_at ?? lifecycle.batch.created_at), 'dd MMM yyyy HH:mm')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-theme-ghost px-3 py-1 text-sm font-medium text-theme-secondary">
                      {lifecycle.workflows.length} workflow{lifecycle.workflows.length === 1 ? '' : 's'}
                    </span>
                    {issues.length > 0 ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-600">
                        <TriangleAlert className="h-4 w-4" />
                        {issues.length} issue{issues.length === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {lifecycle.workflows.map((workflow) => {
                    const meta = KIND_META[workflow.workflow_kind]
                    const Icon = meta.icon

                    return (
                      <div
                        key={workflow.id}
                        className="inline-flex items-center gap-2 rounded-full border border-theme-primary bg-glass px-3 py-2 text-sm"
                      >
                        <Icon className={cn('h-4 w-4', meta.color)} />
                        <span className="text-theme-primary">{meta.label}</span>
                        <span className="text-theme-muted">•</span>
                        <span className="capitalize text-theme-secondary">{workflow.state.replace(/_/g, ' ')}</span>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 grid gap-3 xl:grid-cols-2">
                  {lifecycle.workflows.map((workflow) => {
                    const meta = KIND_META[workflow.workflow_kind]
                    const Icon = meta.icon

                    return (
                      <div
                        key={workflow.id}
                        className="rounded-2xl border border-theme-primary bg-glass p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-theme-secondary p-3">
                              <Icon className={cn('h-5 w-5', meta.color)} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-theme-primary">{meta.label}</p>
                              <p className="text-xs text-theme-muted">
                                {format(new Date(workflow.started_at), 'dd MMM yyyy HH:mm')}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-theme-ghost px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-theme-secondary">
                            {workflow.state.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-theme-secondary">
                          <div className="flex items-center justify-between gap-4">
                            <span>Temperature</span>
                            <span className="font-semibold text-theme-primary">
                              {workflow.last_temperature != null ? `${workflow.last_temperature.toFixed(1)}C` : 'No reading'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>Location</span>
                            <span className="font-semibold text-theme-primary">
                              {workflow.location_label || workflow.location_kind}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>Due</span>
                            <span className="font-semibold text-theme-primary">
                              {workflow.next_due_at || workflow.due_at
                                ? format(new Date(workflow.next_due_at || workflow.due_at!), 'dd MMM HH:mm')
                                : 'No timer'}
                            </span>
                          </div>
                          {workflow.corrective_action ? (
                            <div className="flex items-center justify-between gap-4">
                              <span>Corrective action</span>
                              <span className="font-semibold capitalize text-theme-primary">
                                {workflow.corrective_action.replace(/_/g, ' ')}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HistoryStat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'danger' | 'warm'
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-500/30 bg-red-500/10 text-red-600'
      : tone === 'warm'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-600'
        : 'border-theme-primary bg-theme-card text-theme-primary'

  return (
    <div className={cn('rounded-xl border p-4 text-center', toneClass)}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}
