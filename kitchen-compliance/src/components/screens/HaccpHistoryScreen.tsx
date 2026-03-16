import { useMemo, useState } from 'react'
import { ArrowLeft, CalendarClock, Download, Flame, Snowflake, Soup, TimerReset, TriangleAlert } from 'lucide-react'
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store/useAppStore'
import { useHaccpLifecycles } from '@/hooks/queries/useHaccp'
import { cn } from '@/lib/utils'
import type { WorkflowKind } from '@/types'

type DateFilter = 'today' | 'week' | 'month' | 'all'
type KindFilter = 'all' | WorkflowKind

const KIND_META: Record<WorkflowKind, { label: string; icon: typeof Flame; color: string }> = {
  cooking: { label: 'Cook', icon: Flame, color: 'text-amber-500' },
  cooling: { label: 'Cool', icon: Snowflake, color: 'text-sky-500' },
  reheating: { label: 'Reheat', icon: Soup, color: 'text-orange-500' },
  hot_hold: { label: 'Hold', icon: TimerReset, color: 'text-rose-500' },
}

export function HaccpHistoryScreen({ onBack }: { onBack: () => void }) {
  const { currentSite } = useAppStore()
  const { data: lifecycles = [] } = useHaccpLifecycles(currentSite?.id)
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
          return isWithinInterval(anchorDate, { start: startOfDay(subDays(now, 7)), end: endOfDay(now) })
        }
        if (dateFilter === 'month') {
          return isWithinInterval(anchorDate, { start: startOfDay(subDays(now, 30)), end: endOfDay(now) })
        }
        return true
      })
      .filter((lifecycle) => {
        if (kindFilter === 'all') return true
        return lifecycle.workflows.some((workflow) => workflow.workflow_kind === kindFilter)
      })
      .sort((a, b) => new Date(b.batch.updated_at ?? b.batch.created_at).getTime() - new Date(a.batch.updated_at ?? a.batch.created_at).getTime())
  }, [dateFilter, kindFilter, lifecycles])

  const stats = useMemo(() => {
    const chains = filtered.length
    const needsAction = filtered.filter((lifecycle) => lifecycle.workflows.some((workflow) => workflow.state === 'needs_action')).length
    const discarded = filtered.filter((lifecycle) => lifecycle.workflows.some((workflow) => workflow.state === 'discarded')).length
    const holdChains = filtered.filter((lifecycle) => lifecycle.workflows.some((workflow) => workflow.workflow_kind === 'hot_hold')).length
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
    <div className="min-h-full bg-[linear-gradient(180deg,#fbfdff_0%,#eef2ff_100%)] px-4 pb-16 pt-4 text-zinc-950 dark:bg-[linear-gradient(180deg,#09090b_0%,#111827_100%)] dark:text-zinc-50 lg:px-8">
      <header className="sticky top-16 z-30 mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 rounded-[26px] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/5 lg:top-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Lifecycle History</p>
            <h1 className="text-2xl font-semibold tracking-tight">Batch chains across cook, cool, reheat, and hold.</h1>
          </div>
        </div>

        <Button variant="secondary" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </header>

      <main className="mx-auto mt-6 max-w-[1440px] space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HistoryStat label="Chains" value={stats.chains} />
          <HistoryStat label="Needs Action" value={stats.needsAction} tone="danger" />
          <HistoryStat label="Hold Chains" value={stats.holdChains} tone="warm" />
          <HistoryStat label="Discarded" value={stats.discarded} tone="danger" />
        </div>

        <section className="flex flex-wrap gap-3 rounded-[24px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'all'] as DateFilter[]).map((option) => (
              <button
                key={option}
                onClick={() => setDateFilter(option)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  dateFilter === option
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300',
                )}
              >
                {option === 'all' ? 'All time' : option}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', 'cooking', 'cooling', 'reheating', 'hot_hold'] as KindFilter[]).map((option) => (
              <button
                key={option}
                onClick={() => setKindFilter(option)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  kindFilter === option
                    ? 'bg-sky-500 text-white'
                    : 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
                )}
              >
                {option === 'all' ? 'All stages' : KIND_META[option].label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-[26px] border border-dashed border-zinc-300 bg-white/75 p-12 text-center shadow-sm dark:border-zinc-800 dark:bg-white/5">
              <CalendarClock className="mx-auto h-10 w-10 text-zinc-400" />
              <p className="mt-3 text-lg font-medium">No HACCP lifecycle records in this view.</p>
              <p className="mt-1 text-sm text-zinc-500">Adjust the filters or create a new batch from the live board.</p>
            </div>
          ) : (
            filtered.map((lifecycle) => {
              const issues = lifecycle.workflows.filter((workflow) => workflow.state === 'needs_action' || workflow.state === 'discarded')
              return (
                <article
                  key={lifecycle.batch.id}
                  className="rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Batch</p>
                      <h2 className="mt-2 text-2xl font-semibold">{lifecycle.batch.item_name}</h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {lifecycle.batch.location_label || lifecycle.batch.location_kind} · Updated{' '}
                        {format(new Date(lifecycle.batch.updated_at ?? lifecycle.batch.created_at), 'dd MMM yyyy HH:mm')}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
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
                        <div key={workflow.id} className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/70">
                          <Icon className={cn('h-4 w-4', meta.color)} />
                          <span>{meta.label}</span>
                          <span className="text-zinc-400">•</span>
                          <span className="capitalize text-zinc-500">{workflow.state.replace('_', ' ')}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-6 grid gap-3 xl:grid-cols-2">
                    {lifecycle.workflows.map((workflow) => {
                      const meta = KIND_META[workflow.workflow_kind]
                      const Icon = meta.icon

                      return (
                        <div key={workflow.id} className="rounded-[22px] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="rounded-2xl border border-white/70 bg-white/90 p-3 shadow-sm dark:border-white/10 dark:bg-white/10">
                                <Icon className={cn('h-5 w-5', meta.color)} />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{meta.label}</p>
                                <p className="text-xs text-zinc-500">{format(new Date(workflow.started_at), 'dd MMM yyyy HH:mm')}</p>
                              </div>
                            </div>
                            <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {workflow.state.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                            <div className="flex items-center justify-between">
                              <span>Temperature</span>
                              <span className="font-semibold">
                                {workflow.last_temperature != null ? `${workflow.last_temperature.toFixed(1)}C` : 'No reading'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Location</span>
                              <span className="font-semibold">{workflow.location_label || workflow.location_kind}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Due</span>
                              <span className="font-semibold">
                                {workflow.next_due_at || workflow.due_at ? format(new Date(workflow.next_due_at || workflow.due_at!), 'dd MMM HH:mm') : 'No timer'}
                              </span>
                            </div>
                            {workflow.corrective_action ? (
                              <div className="flex items-center justify-between">
                                <span>Corrective action</span>
                                <span className="font-semibold capitalize">{workflow.corrective_action.replace('_', ' ')}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </article>
              )
            })
          )}
        </section>
      </main>
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
      ? 'border-red-500/20 bg-red-500/8 text-red-600'
      : tone === 'warm'
        ? 'border-amber-500/20 bg-amber-500/8 text-amber-600'
        : 'border-zinc-200 bg-white text-zinc-950 dark:border-white/10 dark:bg-white/5 dark:text-zinc-50'

  return (
    <div className={cn('rounded-[22px] border p-4 shadow-sm', toneClass)}>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}
