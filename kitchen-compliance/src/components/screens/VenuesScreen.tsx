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
  Crown,
  Zap,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth/auth-context'
import { useUserVenues } from '@/hooks/queries/useVenues'
import { useVenueStats } from '@/hooks/queries/useVenueStats'
import { useAppStore } from '@/store/useAppStore'
import { toast } from 'sonner'
import type { Site } from '@/types'

interface VenuesScreenProps {
  onBack: () => void
}

export function VenuesScreen({ onBack }: VenuesScreenProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null)

  const { user } = useAuth()
  const { currentSite, setCurrentSite } = useAppStore()

  // Real Data Fetching
  const { data: venues, isLoading: venuesLoading } = useUserVenues(user?.id)

  // Get stats for all venues
  const venueIds = venues?.map(v => v.id) || []
  const { data: venueStats, isLoading: statsLoading } = useVenueStats(venueIds)

  const isLoading = venuesLoading || statsLoading

  const filteredVenues = venues?.filter(venue =>
    venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (venue.address && venue.address.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || []

  // Derived Stats
  const totalSessionsCount = Object.values(venueStats || {}).reduce((acc: number, curr: any) => acc + (curr.activeSessions || 0), 0)
  const avgCompliance = 98 // Placeholder for now until rigorous calc
  const totalAlerts = 0 // Placeholder
  const totalStaff = Object.values(venueStats || {}).reduce((acc: number, curr: any) => acc + (curr.staffCount || 0), 0)

  const getScoreColor = (score: number) => {
    if (score >= 95) return 'text-green-500'
    if (score >= 80) return 'text-amber-500'
    return 'text-red-500'
  }

  const handleManageSite = (venue: Site) => {
    if (venue.id === currentSite?.id) {
      toast.info(`You are already managing ${venue.name}`)
      return
    }
    // Switch active site
    setCurrentSite(venue)
    toast.success(`Switched to ${venue.name}`)
    // Navigate home
    onBack()
  }

  const handleAddVenue = () => {
    toast.info("Create Venue feature coming in next update!", { icon: "🏗️" })
  }

  return (
    <div className="min-h-full bg-theme-primary text-theme-primary animate-in fade-in duration-300">
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
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none z-10" />
              <input
                type="text"
                placeholder="Search venues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-stunning !pl-10 w-64"
              />
            </div>
            <button
              onClick={handleAddVenue}
              className="btn-stunning btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">Add Venue</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 lg:p-6 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-theme-muted">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p>Loading your venues...</p>
          </div>
        ) : (
          <>
            {/* Aggregated Stats */}
            <section className="mb-8">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Venues */}
                <div className="metric-card">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-sky-500/10">
                      <Building2 className="w-5 h-5 text-sky-500" />
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-theme-primary">
                    {venues?.length || 0}
                  </span>
                  <p className="text-xs text-theme-muted mt-1">Total Venues</p>
                </div>

                {/* Active Sessions */}
                <div className="metric-card cool">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-sky-500/10">
                      <Snowflake className="w-5 h-5 text-sky-500" />
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-theme-primary">
                    {totalSessionsCount}
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
                    {avgCompliance}%
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
                    {totalAlerts}
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
                    {totalStaff}
                  </span>
                  <p className="text-xs text-theme-muted mt-1">Total Staff</p>
                </div>
              </div>
            </section>

            {/* Venues Grid */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-theme-primary">Your Venues</h2>
                <div className="flex items-center gap-2">
                  <button className="btn-stunning btn-ghost text-sm">
                    Grid View
                  </button>
                </div>
              </div>

              {filteredVenues.length === 0 ? (
                <div className="text-center py-12 bg-theme-ghost/30 rounded-xl border border-dashed border-theme-secondary">
                  <Building2 className="w-12 h-12 text-theme-muted mx-auto mb-3 opacity-50" />
                  <h3 className="text-lg font-medium text-theme-primary">No venues found</h3>
                  <p className="text-theme-muted text-sm mb-4">Try adjusting your search or add a new venue.</p>
                  <button onClick={handleAddVenue} className="btn-stunning btn-primary">
                    Add First Venue
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredVenues.map((venue: Site, index: number) => {
                    const stats = venueStats?.[venue.id] || { activeSessions: 0, complianceScore: 0, staffCount: 0, lastActivity: null, alerts: 0, venueId: venue.id }
                    const isCurrent = currentSite?.id === venue.id

                    return (
                      <div
                        key={venue.id}
                        className={cn(
                          'card-stunning p-5 cursor-pointer animate-scale-in transition-all duration-200',
                          isCurrent && 'ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/10',
                          selectedVenue === venue.id && !isCurrent && 'ring-2 ring-sky-500',
                          `stagger-${(index % 5) + 1}`
                        )}
                        onClick={() => setSelectedVenue(venue.id === selectedVenue ? null : venue.id)}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                              isCurrent ? 'gradient-primary text-white' : 'bg-theme-ghost text-theme-muted'
                            )}>
                              <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-theme-primary flex items-center gap-2">
                                {venue.name}
                                {isCurrent && (
                                  <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                    Active
                                  </span>
                                )}
                              </h3>
                              <div className="flex items-center gap-1 text-xs text-theme-muted">
                                <MapPin className="w-3 h-3" />
                                {venue.address || 'No address set'}
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

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <div className="flex items-center gap-1 text-xs text-theme-muted mb-1">
                              <Snowflake className="w-3 h-3" />
                              Sessions
                            </div>
                            <span className="text-lg font-bold text-theme-primary">
                              {stats.activeSessions}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-xs text-theme-muted mb-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Compliance
                            </div>
                            <span className={cn('text-lg font-bold', getScoreColor(stats.complianceScore || 98))}>
                              {stats.complianceScore || 98}%
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-xs text-theme-muted mb-1">
                              <Users className="w-3 h-3" />
                              Staff
                            </div>
                            <span className="text-lg font-bold text-theme-primary">
                              {stats.staffCount}
                            </span>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-4 border-t border-theme-primary">
                          <div className="flex items-center gap-1 text-xs text-theme-muted">
                            <Clock className="w-3 h-3" />
                            Last activity: {stats.lastActivity ? new Date(stats.lastActivity).toLocaleDateString() : 'N/A'}
                          </div>
                          <button
                            className={cn(
                              "btn-stunning text-xs py-1.5 px-3 transition-colors",
                              isCurrent
                                ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                                : "btn-ghost"
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleManageSite(venue)
                            }}
                          >
                            <Settings className="w-3 h-3" />
                            {isCurrent ? 'Current Site' : 'Manage Site'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Upgrade Banner (shown for Pro users who can add more) */}
            <section className="mt-8">
              <div className="card-stunning p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-rose-500/5" />
                <div className="relative flex items-center justify-between flex-wrap gap-4">
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
                    <div className="text-right mr-4 hidden sm:block">
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
          </>
        )}
      </main>
    </div>
  )
}
