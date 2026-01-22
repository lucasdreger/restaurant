import { 
  Snowflake, 
  History, 
  Settings, 
  ClipboardCheck, 
  BarChart3, 
  Home,
  Building2,
  ChevronDown,
  Sparkles,
  Crown,
  Zap,
  ChefHat,
  Package
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

interface SidebarProps {
  currentScreen: string
  onNavigate: (screen: string) => void
  siteName?: string
}

// License types for multi-venue feature
type LicenseType = 'basic' | 'pro' | 'enterprise'

const LICENSE_CONFIG: Record<LicenseType, { label: string; maxVenues: number; icon: typeof Sparkles }> = {
  basic: { label: 'Basic', maxVenues: 1, icon: Sparkles },
  pro: { label: 'Pro', maxVenues: 5, icon: Crown },
  enterprise: { label: 'Enterprise', maxVenues: 999, icon: Zap },
}

export function Sidebar({ currentScreen, onNavigate, siteName = 'Kitchen Ops' }: SidebarProps) {
  const { settings } = useAppStore()
  
  // Get subscription from store settings (synced from DB)
  const licenseType = (settings.subscriptionTier || 'basic') as LicenseType
  const licenseConfig = LICENSE_CONFIG[licenseType]
  const LicenseIcon = licenseConfig.icon

  const navItems = [
    { id: 'home', label: 'Command Center', icon: Home, description: 'Live monitoring' },
    { id: 'goods_receipt', label: 'Goods Receipt', icon: Package, description: 'Delivery intake & OCR', badge: 'NEW' },
    { id: 'menu_engineering', label: 'Menu Engineering', icon: ChefHat, description: 'Cost & Margin Control', badge: 'PRO' },
    { id: 'history', label: 'Cooling Logs', icon: History, description: 'Session history' },
    { id: 'compliance', label: 'FSAI Compliance', icon: ClipboardCheck, description: 'Audit reports' },
    { id: 'reports', label: 'Analytics', icon: BarChart3, description: 'Insights & trends' },
    { id: 'venues', label: 'Venues', icon: Building2, description: 'Multi-site management', badge: licenseType !== 'basic' ? 'NEW' : undefined },
    { id: 'settings', label: 'Settings', icon: Settings, description: 'Configuration' },
  ]

  return (
    <aside className="hidden lg:flex flex-col w-72 sidebar-stunning h-screen sticky top-0">
      {/* Logo/Brand with gradient */}
      <div className="p-6 border-b border-theme-primary">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
              <Snowflake className="w-7 h-7 text-white" />
            </div>
            {/* Floating animation element */}
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-lg animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-theme-primary tracking-tight">
              KITCHEN OPS
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold gradient-text">HACCP PRO</span>
              <span className={cn(
                'license-badge',
                licenseType === 'basic' && 'license-basic',
                licenseType === 'pro' && 'license-pro',
                licenseType === 'enterprise' && 'license-enterprise'
              )}>
                <LicenseIcon className="w-2.5 h-2.5" />
                {licenseConfig.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <p className="px-3 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wider">
          Main Menu
        </p>
        {navItems.slice(0, 4).map((item, index) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'sidebar-item w-full text-left animate-slide-in',
                isActive && 'active',
                `stagger-${index + 1}`
              )}
            >
              <div className={cn(
                'p-2 rounded-lg transition-colors',
                isActive ? 'bg-white/20' : 'bg-theme-ghost'
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold gradient-primary text-white rounded">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className={cn(
                  'text-xs truncate',
                  isActive ? 'text-white/70' : 'text-theme-muted'
                )}>
                  {item.description}
                </p>
              </div>
            </button>
          )
        })}

        <div className="py-3">
          <div className="h-px bg-theme-primary" />
        </div>

        <p className="px-3 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wider">
          Management
        </p>
        {navItems.slice(4).map((item, index) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id
          const isVenueItem = item.id === 'venues'
          const isDisabled = isVenueItem && licenseType === 'basic'
          
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onNavigate(item.id)}
              disabled={isDisabled}
              className={cn(
                'sidebar-item w-full text-left animate-slide-in',
                isActive && 'active',
                isDisabled && 'opacity-50 cursor-not-allowed',
                `stagger-${index + 5}`
              )}
            >
              <div className={cn(
                'p-2 rounded-lg transition-colors',
                isActive ? 'bg-white/20' : 'bg-theme-ghost'
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold gradient-primary text-white rounded">
                      {item.badge}
                    </span>
                  )}
                  {isDisabled && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-theme-ghost text-theme-muted rounded">
                      PRO
                    </span>
                  )}
                </div>
                <p className={cn(
                  'text-xs truncate',
                  isActive ? 'text-white/70' : 'text-theme-muted'
                )}>
                  {item.description}
                </p>
              </div>
            </button>
          )
        })}
      </nav>

      {/* Active Venue Card */}
      <div className="p-4 border-t border-theme-primary">
        <div className="card-glass p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-theme-muted uppercase tracking-wide">
              Active Venue
            </p>
            {licenseType !== 'basic' && (
              <button className="p-1 hover:bg-theme-ghost rounded transition-colors">
                <ChevronDown className="w-4 h-4 text-theme-muted" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-success flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                <span className="font-semibold text-theme-primary text-sm truncate">
                  {siteName}
                </span>
              </div>
              <p className="text-xs text-theme-muted">Online • 0 alerts</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// Mobile bottom navigation with stunning design
export function MobileNav({ currentScreen, onNavigate }: Omit<SidebarProps, 'siteName'>) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'history', label: 'Logs', icon: History },
    { id: 'compliance', label: 'FSAI', icon: ClipboardCheck },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-glass-heavy border-t border-glass safe-area-bottom z-50">
      <div className="flex justify-around items-center h-16 px-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-0 flex-1',
                isActive ? 'text-white' : 'text-theme-muted'
              )}
            >
              <div className={cn(
                'p-2 rounded-xl transition-all',
                isActive ? 'gradient-primary shadow-lg' : ''
              )}>
                <Icon className={cn('w-5 h-5', isActive && 'scale-110')} />
              </div>
              <span className={cn(
                'text-[10px] font-medium truncate',
                isActive ? 'text-theme-primary' : 'text-theme-muted'
              )}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
