import { 
  ArrowLeft, 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Download,
  Filter,
  Snowflake,
  ThermometerSnowflake,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Building2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReportsScreenProps {
  onBack: () => void
}

// Mock analytics data
const summaryStats = {
  totalSessions: 156,
  avgCoolingTime: 78,
  complianceRate: 96.5,
  wasteReduction: 12.3,
}

const weeklyTrends = [
  { day: 'Mon', sessions: 24, compliant: 23, avgTime: 75 },
  { day: 'Tue', sessions: 28, compliant: 27, avgTime: 72 },
  { day: 'Wed', sessions: 22, compliant: 22, avgTime: 68 },
  { day: 'Thu', sessions: 26, compliant: 25, avgTime: 82 },
  { day: 'Fri', sessions: 31, compliant: 30, avgTime: 76 },
  { day: 'Sat', sessions: 18, compliant: 18, avgTime: 71 },
  { day: 'Sun', sessions: 7, compliant: 7, avgTime: 65 },
]

const categoryBreakdown = [
  { category: 'Sauces', count: 45, percentage: 29, color: 'bg-sky-500' },
  { category: 'Soups', count: 32, percentage: 21, color: 'bg-purple-500' },
  { category: 'Meats', count: 38, percentage: 24, color: 'bg-rose-500' },
  { category: 'Vegetables', count: 22, percentage: 14, color: 'bg-green-500' },
  { category: 'Other', count: 19, percentage: 12, color: 'bg-amber-500' },
]

const performanceMetrics = [
  { 
    label: 'On-Time Completion', 
    value: 94, 
    change: +2.3, 
    trend: 'up',
    icon: Clock,
    color: 'text-green-500' 
  },
  { 
    label: 'Avg Cooling Time', 
    value: 78, 
    unit: 'min',
    change: -5.1, 
    trend: 'up',
    icon: ThermometerSnowflake,
    color: 'text-blue-500' 
  },
  { 
    label: 'Waste Incidents', 
    value: 3, 
    change: -40, 
    trend: 'down',
    icon: Trash2,
    color: 'text-amber-500' 
  },
  { 
    label: 'Staff Compliance', 
    value: 98, 
    change: +1.5, 
    trend: 'up',
    icon: CheckCircle2,
    color: 'text-purple-500' 
  },
]

const topItems = [
  { name: 'Bolognese Sauce', count: 28, avgTime: 72, status: 'excellent' },
  { name: 'Chicken Stock', count: 24, avgTime: 68, status: 'excellent' },
  { name: 'Tomato Soup', count: 22, avgTime: 85, status: 'good' },
  { name: 'Roast Beef', count: 18, avgTime: 92, status: 'warning' },
  { name: 'Curry Sauce', count: 16, avgTime: 76, status: 'good' },
]

export function ReportsScreen({ onBack }: ReportsScreenProps) {
  const maxSessions = Math.max(...weeklyTrends.map(d => d.sessions))

  return (
    <div className="min-h-screen bg-theme-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-glass-heavy border-b border-glass">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-theme-ghost rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-theme-secondary" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-theme-primary">Analytics & Reports</h1>
                <p className="text-xs text-theme-muted">Insights and performance metrics</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-stunning btn-ghost">
              <Calendar className="w-4 h-4" />
              Last 7 Days
            </button>
            <button className="btn-stunning btn-ghost">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button className="btn-stunning btn-primary">
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Summary Cards */}
        <section className="mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Sessions */}
            <div className="metric-card cool">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-sky-500/10">
                  <Snowflake className="w-5 h-5 text-sky-500" />
                </div>
                <span className="status-badge status-badge-active">
                  <TrendingUp className="w-3 h-3" />
                  +8%
                </span>
              </div>
              <span className="text-3xl font-bold text-theme-primary">
                {summaryStats.totalSessions}
              </span>
              <p className="text-sm text-theme-muted mt-1">Total Sessions</p>
            </div>

            {/* Avg Cooling Time */}
            <div className="metric-card success">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Clock className="w-5 h-5 text-green-500" />
                </div>
                <span className="status-badge status-badge-safe">
                  <TrendingDown className="w-3 h-3" />
                  -5min
                </span>
              </div>
              <span className="text-3xl font-bold text-theme-primary">
                {summaryStats.avgCoolingTime}<span className="text-lg">min</span>
              </span>
              <p className="text-sm text-theme-muted mt-1">Avg Cooling Time</p>
            </div>

            {/* Compliance Rate */}
            <div className="metric-card success">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <CheckCircle2 className="w-5 h-5 text-purple-500" />
                </div>
                <span className="status-badge status-badge-safe">
                  <TrendingUp className="w-3 h-3" />
                  +2.3%
                </span>
              </div>
              <span className="text-3xl font-bold text-theme-primary">
                {summaryStats.complianceRate}%
              </span>
              <p className="text-sm text-theme-muted mt-1">Compliance Rate</p>
            </div>

            {/* Waste Reduction */}
            <div className="metric-card warning">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Trash2 className="w-5 h-5 text-amber-500" />
                </div>
                <span className="status-badge status-badge-warning">
                  <TrendingDown className="w-3 h-3" />
                  -{summaryStats.wasteReduction}%
                </span>
              </div>
              <span className="text-3xl font-bold text-theme-primary">
                €847
              </span>
              <p className="text-sm text-theme-muted mt-1">Waste Saved</p>
            </div>
          </div>
        </section>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Weekly Trend Chart */}
          <div className="lg:col-span-2 card-stunning p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-theme-primary">Weekly Sessions</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full gradient-primary" />
                  Total
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full gradient-success" />
                  Compliant
                </span>
              </div>
            </div>
            
            {/* Bar Chart */}
            <div className="flex items-end justify-between gap-2 h-48">
              {weeklyTrends.map((day) => (
                <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center gap-1">
                    {/* Total bar */}
                    <div 
                      className="w-full max-w-[40px] rounded-t-lg gradient-cool opacity-30"
                      style={{ height: `${(day.sessions / maxSessions) * 160}px` }}
                    />
                    {/* Compliant bar - overlaid */}
                    <div 
                      className="w-full max-w-[32px] rounded-t-lg gradient-success -mt-1 relative"
                      style={{ 
                        height: `${(day.compliant / maxSessions) * 160}px`,
                        marginTop: `-${(day.sessions / maxSessions) * 160}px`
                      }}
                    />
                  </div>
                  <span className="text-xs text-theme-muted font-medium">{day.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="card-stunning p-6">
            <h3 className="font-semibold text-theme-primary mb-6">By Category</h3>
            <div className="space-y-4">
              {categoryBreakdown.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-theme-primary">
                      {cat.category}
                    </span>
                    <span className="text-sm text-theme-muted">
                      {cat.count} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-theme-ghost rounded-full overflow-hidden">
                    <div 
                      className={cn('h-full rounded-full transition-all duration-500', cat.color)}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance Metrics & Top Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Metrics */}
          <section>
            <h3 className="font-semibold text-theme-primary mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              {performanceMetrics.map((metric, index) => {
                const Icon = metric.icon
                const isPositive = metric.trend === 'up' && metric.change > 0 || 
                                   metric.trend === 'down' && metric.change < 0
                
                return (
                  <div 
                    key={metric.label}
                    className={cn(
                      'card-stunning p-4 animate-scale-in',
                      `stagger-${index + 1}`
                    )}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn('p-2 rounded-lg', `${metric.color.replace('text-', 'bg-')}/10`)}>
                        <Icon className={cn('w-5 h-5', metric.color)} />
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-2xl font-bold text-theme-primary">
                          {metric.value}{metric.unit || '%'}
                        </span>
                        <p className="text-xs text-theme-muted mt-1">{metric.label}</p>
                      </div>
                      <span className={cn(
                        'text-xs font-semibold flex items-center gap-1',
                        isPositive ? 'text-green-500' : 'text-red-500'
                      )}>
                        {metric.change > 0 ? '+' : ''}{metric.change}%
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Top Items */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-theme-primary">Top Items This Week</h3>
              <button className="text-sm text-sky-500 font-medium hover:underline">
                View All
              </button>
            </div>
            <div className="space-y-3">
              {topItems.map((item, index) => (
                <div 
                  key={item.name}
                  className={cn(
                    'card-stunning p-4 animate-slide-up',
                    `stagger-${index + 1}`
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg gradient-cool flex items-center justify-center text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-medium text-theme-primary">{item.name}</h4>
                        <p className="text-xs text-theme-muted">
                          {item.count} sessions • Avg {item.avgTime}min
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      'status-badge',
                      item.status === 'excellent' && 'status-badge-safe',
                      item.status === 'good' && 'status-badge-active',
                      item.status === 'warning' && 'status-badge-warning'
                    )}>
                      {item.status === 'excellent' && <CheckCircle2 className="w-3 h-3" />}
                      {item.status === 'warning' && <AlertTriangle className="w-3 h-3" />}
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Multi-Venue Comparison (Pro Feature Preview) */}
        <section className="mt-8">
          <div className="card-stunning p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-sky-500/5" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg gradient-primary">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-theme-primary">Multi-Venue Comparison</h3>
                    <p className="text-xs text-theme-muted">Compare performance across all your venues</p>
                  </div>
                </div>
                <span className="license-badge license-pro">
                  PRO Feature
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 opacity-50">
                <div className="bg-theme-ghost rounded-xl p-4 h-24" />
                <div className="bg-theme-ghost rounded-xl p-4 h-24" />
                <div className="bg-theme-ghost rounded-xl p-4 h-24" />
              </div>
              <div className="mt-4 text-center">
                <button className="btn-stunning btn-primary">
                  Upgrade to Pro
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
