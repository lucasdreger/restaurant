import { useState } from 'react'
import { 
  ArrowLeft, 
  Building2, 
  Plus,
  Search,
  MoreVertical,
  MapPin,
  Users,
  Snowflake,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Settings,
  TrendingUp,
  Wifi,
  WifiOff,
  Crown,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface VenuesScreenProps {
  onBack: () => void
}

// Mock venues data
const venues = [
  {
    id: '1',
    name: 'Main Kitchen - Dublin',
    address: '123 Grafton Street, Dublin 2',
    status: 'online',
    activeSessions: 3,
    complianceScore: 98,
    staffCount: 8,
    lastActivity: '2 min ago',
    alerts: 0,
  },
  {
    id: '2',
    name: 'Cork Branch',
    address: '45 Patrick Street, Cork',
    status: 'online',
    activeSessions: 1,
    complianceScore: 95,
    staffCount: 5,
    lastActivity: '15 min ago',
    alerts: 1,
  },
  {
    id: '3',
    name: 'Galway Kitchen',
    address: '78 Shop Street, Galway',
    status: 'offline',
    activeSessions: 0,
    complianceScore: 92,
    staffCount: 4,
    lastActivity: '2 hours ago',
    alerts: 2,
  },
  {
    id: '4',
    name: 'Limerick Central',
    address: '12 O\'Connell Street, Limerick',
    status: 'online',
    activeSessions: 2,
    complianceScore: 97,
    staffCount: 6,
    lastActivity: '5 min ago',
    alerts: 0,
  },
]

const aggregatedStats = {
  totalVenues: 4,
  activeVenues: 3,
  totalSessions: 6,
  avgCompliance: 95.5,
  totalAlerts: 3,
  totalStaff: 23,
}

export function VenuesScreen({ onBack }: VenuesScreenProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null)

  const filteredVenues = venues.filter(venue =>
    venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    venue.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getScoreColor = (score: number) => {
    if (score >= 95) return 'text-green-500'
    if (score >= 80) return 'text-amber-500'
    return 'text-red-500'
  }

  return (
    <div className="min-h-full bg-theme-primary text-theme-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-glass-heavy border-b border-glass">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16">
          <div className="flex items-center gap-4">
            {/* Back button - only show on mobile/tablet */}
            <button
              onClick={onBack}
              className="lg:hidden p-2 hover:bg-theme-ghost rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-theme-secondary" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-theme-primary">Venues</h1>
                <p className="text-xs text-theme-muted">Multi-site management</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none z-10" />
              <input
                type="text"
                placeholder="Search venues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-stunning !pl-10 w-64"
              />
            </div>
            <button className="btn-stunning btn-primary">
              <Plus className="w-4 h-4" />
              Add Venue
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Aggregated Stats */}
        <section className="mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Total Venues */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-sky-500/10">
                  <Building2 className="w-5 h-5 text-sky-500" />
                </div>
              </div>
              <span className="text-2xl font-bold text-theme-primary">
                {aggregatedStats.totalVenues}
              </span>
              <p className="text-xs text-theme-muted mt-1">Total Venues</p>
            </div>

            {/* Active Venues */}
            <div className="metric-card success">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Wifi className="w-5 h-5 text-green-500" />
                </div>
              </div>
              <span className="text-2xl font-bold text-theme-primary">
                {aggregatedStats.activeVenues}
              </span>
              <p className="text-xs text-theme-muted mt-1">Online Now</p>
            </div>

            {/* Active Sessions */}
            <div className="metric-card cool">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-sky-500/10">
                  <Snowflake className="w-5 h-5 text-sky-500" />
                </div>
              </div>
              <span className="text-2xl font-bold text-theme-primary">
                {aggregatedStats.totalSessions}
              </span>
              <p className="text-xs text-theme-muted mt-1">Active Sessions</p>
            </div>

            {/* Avg Compliance */}
            <div className="metric-card success">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                </div>
              </div>
              <span className="text-2xl font-bold text-theme-primary">
                {aggregatedStats.avgCompliance}%
              </span>
              <p className="text-xs text-theme-muted mt-1">Avg Compliance</p>
            </div>

            {/* Total Alerts */}
            <div className="metric-card warning">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
              </div>
              <span className="text-2xl font-bold text-theme-primary">
                {aggregatedStats.totalAlerts}
              </span>
              <p className="text-xs text-theme-muted mt-1">Active Alerts</p>
            </div>

            {/* Total Staff */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-theme-ghost">
                  <Users className="w-5 h-5 text-theme-secondary" />
                </div>
              </div>
              <span className="text-2xl font-bold text-theme-primary">
                {aggregatedStats.totalStaff}
              </span>
              <p className="text-xs text-theme-muted mt-1">Total Staff</p>
            </div>
          </div>
        </section>

        {/* Venues Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-theme-primary">All Venues</h2>
            <div className="flex items-center gap-2">
              <button className="btn-stunning btn-ghost text-sm">
                Grid View
              </button>
              <button className="btn-stunning btn-ghost text-sm">
                List View
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVenues.map((venue, index) => (
              <div
                key={venue.id}
                className={cn(
                  'card-stunning p-5 cursor-pointer animate-scale-in',
                  selectedVenue === venue.id && 'ring-2 ring-sky-500',
                  `stagger-${index + 1}`
                )}
                onClick={() => setSelectedVenue(venue.id === selectedVenue ? null : venue.id)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      venue.status === 'online' ? 'gradient-success' : 'bg-theme-ghost'
                    )}>
                      <Building2 className={cn(
                        'w-6 h-6',
                        venue.status === 'online' ? 'text-white' : 'text-theme-muted'
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-theme-primary">{venue.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-theme-muted">
                        <MapPin className="w-3 h-3" />
                        {venue.address}
                      </div>
                    </div>
                  </div>
                  <button 
                    className="p-2 hover:bg-theme-ghost rounded-lg transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4 text-theme-muted" />
                  </button>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={cn(
                    'status-badge',
                    venue.status === 'online' ? 'status-badge-safe' : 'status-badge-warning'
                  )}>
                    {venue.status === 'online' ? (
                      <Wifi className="w-3 h-3" />
                    ) : (
                      <WifiOff className="w-3 h-3" />
                    )}
                    {venue.status}
                  </span>
                  {venue.alerts > 0 && (
                    <span className="status-badge status-badge-danger">
                      <AlertTriangle className="w-3 h-3" />
                      {venue.alerts} alert{venue.alerts > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-1 text-xs text-theme-muted mb-1">
                      <Snowflake className="w-3 h-3" />
                      Sessions
                    </div>
                    <span className="text-lg font-bold text-theme-primary">
                      {venue.activeSessions}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-xs text-theme-muted mb-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Compliance
                    </div>
                    <span className={cn('text-lg font-bold', getScoreColor(venue.complianceScore))}>
                      {venue.complianceScore}%
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-xs text-theme-muted mb-1">
                      <Users className="w-3 h-3" />
                      Staff
                    </div>
                    <span className="text-lg font-bold text-theme-primary">
                      {venue.staffCount}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-theme-primary">
                  <div className="flex items-center gap-1 text-xs text-theme-muted">
                    <Clock className="w-3 h-3" />
                    Last activity: {venue.lastActivity}
                  </div>
                  <button 
                    className="btn-stunning btn-ghost text-xs py-1.5 px-3"
                    onClick={(e) => {
                      e.stopPropagation()
                      // Navigate to venue dashboard
                    }}
                  >
                    <Settings className="w-3 h-3" />
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Upgrade Banner (shown for Pro users who can add more) */}
        <section className="mt-8">
          <div className="card-stunning p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-rose-500/5" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl gradient-warning">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-theme-primary">Need more venues?</h3>
                  <p className="text-sm text-theme-muted">
                    Upgrade to Enterprise for unlimited venues and advanced features
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-4">
                  <p className="text-xs text-theme-muted">Current Plan</p>
                  <span className="license-badge license-pro">
                    <Crown className="w-2.5 h-2.5" />
                    Pro
                  </span>
                </div>
                <button className="btn-stunning btn-primary">
                  Upgrade Plan
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Consolidated Logs Preview */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-theme-primary">Consolidated Activity</h2>
            <button className="text-sm text-sky-500 font-medium hover:underline">
              View Full Logs
            </button>
          </div>
          <div className="card-stunning p-6">
            <div className="space-y-4">
              {[
                { venue: 'Main Kitchen - Dublin', action: 'Cooling started', item: 'Bolognese Sauce', time: '2 min ago', status: 'active' },
                { venue: 'Cork Branch', action: 'Session completed', item: 'Chicken Stock', time: '15 min ago', status: 'success' },
                { venue: 'Limerick Central', action: 'Warning triggered', item: 'Tomato Soup', time: '20 min ago', status: 'warning' },
                { venue: 'Main Kitchen - Dublin', action: 'Cooling started', item: 'Curry Sauce', time: '25 min ago', status: 'active' },
                { venue: 'Main Kitchen - Dublin', action: 'Session completed', item: 'Gravy', time: '45 min ago', status: 'success' },
              ].map((log, index) => (
                <div 
                  key={index}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-xl bg-theme-ghost animate-slide-up',
                    `stagger-${index + 1}`
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      log.status === 'active' && 'bg-sky-500',
                      log.status === 'success' && 'bg-green-500',
                      log.status === 'warning' && 'bg-amber-500 animate-pulse'
                    )} />
                    <div>
                      <p className="text-sm font-medium text-theme-primary">
                        {log.action}: <span className="text-theme-secondary">{log.item}</span>
                      </p>
                      <p className="text-xs text-theme-muted">{log.venue}</p>
                    </div>
                  </div>
                  <span className="text-xs text-theme-muted">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
