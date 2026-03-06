import { type ComponentType, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Building2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
  Waves,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type VenueRow = {
  id: string
  name: string
  address: string | null
  created_at: string | null
  created_by: string | null
  subscription_tier?: 'basic' | 'pro' | 'enterprise' | null
}

type SiteRow = {
  id: string
  subscription_tier: 'basic' | 'pro' | 'enterprise' | null
}

type VenueMemberRow = {
  venue_id: string
  user_id: string
}

type CoolingSessionRow = {
  id: string
  site_id: string
  status: string
  started_at: string
  closed_at: string | null
  hard_due_at: string
}

type GoodsReceiptRow = {
  id: string
  site_id: string
  received_at: string
  created_at: string | null
  status: 'draft' | 'completed' | 'flagged' | 'voided' | null
  temperature_compliant: boolean | null
  ocr_raw_text: string | null
}

type ComplianceLogRow = {
  site_id: string | null
  source: 'app' | 'voice' | 'iot_sensor' | 'manager_audit' | null
  status: 'pass' | 'fail' | 'rectified' | 'pending' | null
  created_at: string | null
}

type ComplianceReportRow = {
  site_id: string
  report_date: string
  overall_compliance_rate: number | null
}

type AlertRow = {
  id: string
  session_id: string
  acknowledged: boolean | null
  triggered_at: string
}

type VenueMetrics = {
  venueId: string
  venueName: string
  location: string
  tier: string
  members: number
  sessions30d: number
  overdueOpen: number
  receipts30d: number
  flaggedReceipts30d: number
  apiRequests30d: number
  ocrRequests30d: number
  voiceEvents30d: number
  iotEvents30d: number
  complianceRate: number | null
  lastComplianceReportRate: number | null
  lastActivityAt: string | null
}

type DashboardData = {
  generatedAt: string
  totalVenues: number
  activeVenues7d: number
  totalUsers: number
  unacknowledgedAlerts30d: number
  apiRequests30d: number
  complianceFailures30d: number
  tierCounts: Record<'basic' | 'pro' | 'enterprise' | 'unknown', number>
  activityByDay: Array<{ day: string; sessions: number; receipts: number; api: number }>
  topVenuesByApi: VenueMetrics[]
  venueMetrics: VenueMetrics[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function toIso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * DAY_MS).toISOString()
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatDateTime(value: string | null): string {
  if (!value) return 'No activity'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isOnTime(closedAt: string | null, hardDueAt: string): boolean {
  if (!closedAt) return false
  return new Date(closedAt).getTime() <= new Date(hardDueAt).getTime()
}

async function fetchDashboardData(): Promise<DashboardData> {
  const last7Iso = toIso(7)
  const last30Iso = toIso(30)
  const last14Iso = toIso(14)
  const last90Date = new Date(Date.now() - 90 * DAY_MS).toISOString().slice(0, 10)

  const preferredVenuesRes = await supabase
    .from('venues')
    .select('id,name,address,subscription_tier,created_at,created_by')
    .order('created_at', { ascending: false })

  let venues: VenueRow[] = []
  if (!preferredVenuesRes.error) {
    venues = (preferredVenuesRes.data ?? []) as VenueRow[]
  } else {
    // Fallback for environments with older/different venue schema.
    const fallbackVenuesRes = await supabase.from('venues').select('*').order('created_at', { ascending: false })
    if (fallbackVenuesRes.error) {
      throw fallbackVenuesRes.error
    }
    const rawVenues = (fallbackVenuesRes.data ?? []) as Array<Record<string, unknown>>
    venues = rawVenues.map((row) => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? 'Unnamed venue'),
      address: typeof row.address === 'string' ? row.address : null,
      created_at: typeof row.created_at === 'string' ? row.created_at : null,
      created_by: typeof row.created_by === 'string' ? row.created_by : null,
      subscription_tier:
        row.subscription_tier === 'basic' || row.subscription_tier === 'pro' || row.subscription_tier === 'enterprise'
          ? row.subscription_tier
          : null,
    }))
  }

  const [
    sitesRes,
    membersRes,
    sessionsRes,
    receiptsRes,
    complianceLogsRes,
    complianceReportsRes,
    alertsRes,
  ] = await Promise.all([
    supabase.from('sites').select('id,subscription_tier'),
    supabase.from('venue_members').select('venue_id,user_id'),
    supabase
      .from('cooling_sessions')
      .select('id,site_id,status,started_at,closed_at,hard_due_at')
      .gte('started_at', last30Iso),
    supabase
      .from('goods_receipts')
      .select('id,site_id,received_at,created_at,status,temperature_compliant,ocr_raw_text')
      .gte('received_at', last30Iso),
    supabase
      .from('compliance_logs')
      .select('site_id,source,status,created_at')
      .gte('created_at', last30Iso),
    supabase
      .from('compliance_reports')
      .select('site_id,report_date,overall_compliance_rate')
      .gte('report_date', last90Date),
    supabase
      .from('alerts')
      .select('id,session_id,acknowledged,triggered_at')
      .gte('triggered_at', last30Iso),
  ])

  if (sitesRes.error) {
    // Some environments may not expose sites to this role; keep dashboard operational.
    console.warn('Sites query failed, falling back to venue-level tier only:', sitesRes.error.message)
  }
  if (membersRes.error) throw membersRes.error
  if (sessionsRes.error) throw sessionsRes.error
  if (receiptsRes.error) throw receiptsRes.error
  if (complianceLogsRes.error) throw complianceLogsRes.error
  if (complianceReportsRes.error) throw complianceReportsRes.error
  if (alertsRes.error) throw alertsRes.error

  const sites = ((sitesRes.data ?? []) as SiteRow[])
  const members = (membersRes.data ?? []) as VenueMemberRow[]
  const sessions = (sessionsRes.data ?? []) as CoolingSessionRow[]
  const receipts = (receiptsRes.data ?? []) as GoodsReceiptRow[]
  const complianceLogs = (complianceLogsRes.data ?? []) as ComplianceLogRow[]
  const complianceReports = (complianceReportsRes.data ?? []) as ComplianceReportRow[]
  const alerts = (alertsRes.data ?? []) as AlertRow[]

  const membersByVenue = new Map<string, number>()
  const uniqueUsers = new Set<string>()

  for (const member of members) {
    membersByVenue.set(member.venue_id, (membersByVenue.get(member.venue_id) ?? 0) + 1)
    uniqueUsers.add(member.user_id)
  }

  for (const venue of venues) {
    if (venue.created_by) uniqueUsers.add(venue.created_by)
  }

  const reportsBySite = new Map<string, ComplianceReportRow[]>()
  for (const report of complianceReports) {
    const bucket = reportsBySite.get(report.site_id) ?? []
    bucket.push(report)
    reportsBySite.set(report.site_id, bucket)
  }

  for (const [, reportList] of reportsBySite) {
    reportList.sort((a, b) => b.report_date.localeCompare(a.report_date))
  }

  const sessionsBySite = new Map<string, CoolingSessionRow[]>()
  const receiptsBySite = new Map<string, GoodsReceiptRow[]>()
  const logsBySite = new Map<string, ComplianceLogRow[]>()

  for (const session of sessions) {
    const bucket = sessionsBySite.get(session.site_id) ?? []
    bucket.push(session)
    sessionsBySite.set(session.site_id, bucket)
  }

  for (const receipt of receipts) {
    const bucket = receiptsBySite.get(receipt.site_id) ?? []
    bucket.push(receipt)
    receiptsBySite.set(receipt.site_id, bucket)
  }

  for (const log of complianceLogs) {
    if (!log.site_id) continue
    const bucket = logsBySite.get(log.site_id) ?? []
    bucket.push(log)
    logsBySite.set(log.site_id, bucket)
  }

  const siteTierByVenueId = new Map<string, SiteRow['subscription_tier']>()
  for (const site of sites) {
    siteTierByVenueId.set(site.id, site.subscription_tier)
  }

  const venueMetrics: VenueMetrics[] = venues.map((venue) => {
    const venueSessions = sessionsBySite.get(venue.id) ?? []
    const venueReceipts = receiptsBySite.get(venue.id) ?? []
    const venueLogs = logsBySite.get(venue.id) ?? []

    const closedSessions = venueSessions.filter((s) => s.closed_at !== null)
    const onTimeClosed = closedSessions.filter((s) => isOnTime(s.closed_at, s.hard_due_at))

    const ocrRequests30d = venueReceipts.filter((r) => Boolean(r.ocr_raw_text)).length
    const voiceEvents30d = venueLogs.filter((l) => l.source === 'voice').length
    const iotEvents30d = venueLogs.filter((l) => l.source === 'iot_sensor').length
    const apiRequests30d = ocrRequests30d + voiceEvents30d + iotEvents30d

    const activityTimes: string[] = []
    for (const session of venueSessions) activityTimes.push(session.started_at)
    for (const receipt of venueReceipts) activityTimes.push(receipt.received_at || receipt.created_at || '')
    for (const log of venueLogs) if (log.created_at) activityTimes.push(log.created_at)

    const lastActivityAt =
      activityTimes
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null

    const latestComplianceReportRate = reportsBySite.get(venue.id)?.[0]?.overall_compliance_rate ?? null

    const complianceRate =
      closedSessions.length === 0 ? null : Math.round((onTimeClosed.length / closedSessions.length) * 100)

    const location = venue.address || 'Address not set'

    return {
      venueId: venue.id,
      venueName: venue.name,
      location,
      tier: siteTierByVenueId.get(venue.id) ?? venue.subscription_tier ?? 'unknown',
      members: membersByVenue.get(venue.id) ?? 0,
      sessions30d: venueSessions.length,
      overdueOpen: venueSessions.filter((s) => s.status === 'overdue').length,
      receipts30d: venueReceipts.length,
      flaggedReceipts30d: venueReceipts.filter(
        (r) => r.status === 'flagged' || r.temperature_compliant === false
      ).length,
      apiRequests30d,
      ocrRequests30d,
      voiceEvents30d,
      iotEvents30d,
      complianceRate,
      lastComplianceReportRate: latestComplianceReportRate,
      lastActivityAt,
    }
  })

  const tierCounts: Record<'basic' | 'pro' | 'enterprise' | 'unknown', number> = {
    basic: 0,
    pro: 0,
    enterprise: 0,
    unknown: 0,
  }

  for (const metric of venueMetrics) {
    if (metric.tier === 'basic' || metric.tier === 'pro' || metric.tier === 'enterprise') {
      tierCounts[metric.tier] += 1
    } else {
      tierCounts.unknown += 1
    }
  }

  const activeVenueIds7d = new Set<string>()
  for (const session of sessions) {
    if (new Date(session.started_at).getTime() >= new Date(last7Iso).getTime()) {
      activeVenueIds7d.add(session.site_id)
    }
  }
  for (const receipt of receipts) {
    if (new Date(receipt.received_at).getTime() >= new Date(last7Iso).getTime()) {
      activeVenueIds7d.add(receipt.site_id)
    }
  }
  for (const log of complianceLogs) {
    if (log.site_id && log.created_at && new Date(log.created_at).getTime() >= new Date(last7Iso).getTime()) {
      activeVenueIds7d.add(log.site_id)
    }
  }

  const unacknowledgedAlerts30d = alerts.filter((a) => !a.acknowledged).length
  const apiRequests30d = venueMetrics.reduce((sum, v) => sum + v.apiRequests30d, 0)
  const complianceFailures30d = complianceLogs.filter((log) => log.status === 'fail').length

  const topVenuesByApi = [...venueMetrics].sort((a, b) => b.apiRequests30d - a.apiRequests30d).slice(0, 5)

  const activityBuckets = new Map<string, { sessions: number; receipts: number; api: number }>()
  for (let i = 13; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10)
    activityBuckets.set(day, { sessions: 0, receipts: 0, api: 0 })
  }

  for (const session of sessions) {
    if (new Date(session.started_at).getTime() < new Date(last14Iso).getTime()) continue
    const day = session.started_at.slice(0, 10)
    const bucket = activityBuckets.get(day)
    if (bucket) bucket.sessions += 1
  }

  for (const receipt of receipts) {
    const timestamp = receipt.received_at || receipt.created_at
    if (!timestamp || new Date(timestamp).getTime() < new Date(last14Iso).getTime()) continue
    const day = timestamp.slice(0, 10)
    const bucket = activityBuckets.get(day)
    if (!bucket) continue
    bucket.receipts += 1
    if (receipt.ocr_raw_text) bucket.api += 1
  }

  for (const log of complianceLogs) {
    if (!log.created_at || new Date(log.created_at).getTime() < new Date(last14Iso).getTime()) continue
    if (log.source !== 'voice' && log.source !== 'iot_sensor') continue
    const day = log.created_at.slice(0, 10)
    const bucket = activityBuckets.get(day)
    if (bucket) bucket.api += 1
  }

  const activityByDay = Array.from(activityBuckets.entries()).map(([day, values]) => ({
    day,
    sessions: values.sessions,
    receipts: values.receipts,
    api: values.api,
  }))

  return {
    generatedAt: new Date().toISOString(),
    totalVenues: venues.length,
    activeVenues7d: activeVenueIds7d.size,
    totalUsers: uniqueUsers.size,
    unacknowledgedAlerts30d,
    apiRequests30d,
    complianceFailures30d,
    tierCounts,
    activityByDay,
    topVenuesByApi,
    venueMetrics: venueMetrics.sort((a, b) => b.apiRequests30d - a.apiRequests30d),
  }
}

function StatCard({
  label,
  value,
  help,
  icon: Icon,
}: {
  label: string
  value: string
  help: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="rounded-lg bg-slate-100 p-2">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
      </div>
      <p className="text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{help}</p>
    </div>
  )
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    setError(null)
    try {
      const nextData = await fetchDashboardData()
      setData(nextData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load live admin metrics.'
      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load(false)
  }, [load])

  const maxDailyActivity = useMemo(() => {
    if (!data) return 1
    const peak = Math.max(...data.activityByDay.map((d) => d.sessions + d.receipts + d.api), 1)
    return peak
  }, [data])

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading live Supabase metrics...</span>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">Could not load admin dashboard</h1>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <button
          onClick={() => void load(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Operations Control Center</h1>
            <p className="mt-1 text-sm text-slate-300">
              Real-time business telemetry from Supabase across venues, compliance, and automation load.
            </p>
            <p className="mt-2 text-xs text-slate-400">Last refresh: {formatDateTime(data.generatedAt)}</p>
          </div>
          <button
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 self-start rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Live refresh warning: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Venues"
          value={formatCompact(data.totalVenues)}
          help={`${data.activeVenues7d} active in the last 7 days`}
          icon={Building2}
        />
        <StatCard
          label="Users With Access"
          value={formatCompact(data.totalUsers)}
          help="Unique owners and venue members"
          icon={Users}
        />
        <StatCard
          label="API Requests (30d)"
          value={formatCompact(data.apiRequests30d)}
          help="OCR + Voice + IoT ingestion events"
          icon={Waves}
        />
        <StatCard
          label="Open Alerts (30d)"
          value={formatCompact(data.unacknowledgedAlerts30d)}
          help={`${data.complianceFailures30d} failed compliance logs in period`}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">14-Day Activity Pulse</h2>
              <p className="text-xs text-slate-500">Sessions started, receipts captured, and API events per day.</p>
            </div>
            <Activity className="h-4 w-4 text-slate-500" />
          </div>
          <div className="space-y-2">
            {data.activityByDay.map((point) => {
              const total = point.sessions + point.receipts + point.api
              const width = `${Math.max((total / maxDailyActivity) * 100, 2)}%`
              return (
                <div key={point.day} className="grid grid-cols-[90px_1fr_110px] items-center gap-3 text-xs">
                  <span className="font-medium text-slate-600">
                    {new Date(point.day).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width }} />
                  </div>
                  <span className="text-right text-slate-500">
                    {total} total ({point.api} API)
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Plan Mix</h2>
          <p className="mb-4 text-xs text-slate-500">Current venue subscription footprint.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-600">Basic</span>
              <span className="font-semibold text-slate-900">{data.tierCounts.basic}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-600">Pro</span>
              <span className="font-semibold text-slate-900">{data.tierCounts.pro}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-600">Enterprise</span>
              <span className="font-semibold text-slate-900">{data.tierCounts.enterprise}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-600">Unknown</span>
              <span className="font-semibold text-slate-900">{data.tierCounts.unknown}</span>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Data source: `venues.subscription_tier`
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">API Demand by Venue (30d)</h2>
            <p className="text-xs text-slate-500">Top venues by OCR + Voice + IoT activity.</p>
          </div>
          <ShieldCheck className="h-4 w-4 text-slate-500" />
        </div>
        <div className="space-y-3">
          {data.topVenuesByApi.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No API activity found in the last 30 days.
            </div>
          )}
          {data.topVenuesByApi.map((venue) => (
            <div key={venue.venueId} className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{venue.venueName}</p>
                  <p className="text-xs text-slate-500">{venue.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-slate-900">{venue.apiRequests30d}</p>
                  <p className="text-xs text-slate-500">API events</p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                <div className="rounded bg-slate-50 px-2 py-1">OCR: {venue.ocrRequests30d}</div>
                <div className="rounded bg-slate-50 px-2 py-1">Voice: {venue.voiceEvents30d}</div>
                <div className="rounded bg-slate-50 px-2 py-1">IoT: {venue.iotEvents30d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Venue Health Grid</h2>
        <p className="mb-4 text-xs text-slate-500">
          Operational view to spot compliance risk, workload spikes, and staffing coverage.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Venue</th>
                <th className="px-3 py-2">Members</th>
                <th className="px-3 py-2">Sessions 30d</th>
                <th className="px-3 py-2">Overdue</th>
                <th className="px-3 py-2">Receipts 30d</th>
                <th className="px-3 py-2">Flagged Receipts</th>
                <th className="px-3 py-2">API Requests</th>
                <th className="px-3 py-2">Compliance</th>
                <th className="px-3 py-2">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {data.venueMetrics.map((venue) => (
                <tr key={venue.venueId} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">{venue.venueName}</p>
                    <p className="text-xs text-slate-500">{venue.location}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{venue.members}</td>
                  <td className="px-3 py-3 text-slate-700">{venue.sessions30d}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        venue.overdueOpen > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {venue.overdueOpen}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{venue.receipts30d}</td>
                  <td className="px-3 py-3 text-slate-700">{venue.flaggedReceipts30d}</td>
                  <td className="px-3 py-3 font-medium text-slate-900">{venue.apiRequests30d}</td>
                  <td className="px-3 py-3">
                    <span className="text-slate-700">
                      {venue.lastComplianceReportRate !== null
                        ? `${Math.round(venue.lastComplianceReportRate)}% report`
                        : venue.complianceRate !== null
                          ? `${venue.complianceRate}% from sessions`
                          : 'No data'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDateTime(venue.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
