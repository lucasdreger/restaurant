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
  Package,
  Menu,
  X,
  LogOut,
  LayoutDashboard
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

// All navigation items - shared between desktop and mobile
const getNavItems = (licenseType: LicenseType) => [
  { id: 'home', label: 'Command Center', icon: Home, description: 'Live monitoring' },
  { id: 'goods_receipt', label: 'Goods Receipt', icon: Package, description: 'New delivery intake', badge: 'NEW' },
  { id: 'receipt_history', label: 'Receipt History', icon: ClipboardCheck, description: 'View deliveries & reports' },
  { id: 'menu_engineering', label: 'Menu Engineering', icon: ChefHat, description: 'Cost & Margin Control', badge: 'PRO' },
  { id: 'history', label: 'Cooling Logs', icon: History, description: 'Session history' },
  { id: 'compliance', label: 'FSAI Compliance', icon: ClipboardCheck, description: 'Audit reports' },
  { id: 'reports', label: 'Analytics', icon: BarChart3, description: 'Insights & trends' },
  { id: 'venues', label: 'Venues', icon: Building2, description: 'Multi-site management', badge: licenseType !== 'basic' ? 'NEW' : undefined },
  { id: 'settings', label: 'Settings', icon: Settings, description: 'Configuration' },
]

export function Sidebar({ currentScreen, onNavigate, siteName = 'Kitchen Ops' }: SidebarProps) {
  const { settings } = useAppStore()

  // Get subscription from store settings (synced from DB)
  const licenseType = (settings.subscriptionTier || 'basic') as LicenseType
  const licenseConfig = LICENSE_CONFIG[licenseType]
  const LicenseIcon = licenseConfig.icon

  const navItems = getNavItems(licenseType)

  return (
    <aside className="hidden lg:flex flex-col w-72 h-screen sticky top-0 bg-glass border-r border-glass backdrop-blur-xl">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-theme-secondary">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Snowflake className="w-6 h-6 text-white" />
            </div>
            {/* Subtle status indicator */}
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[hsl(var(--bg-primary))]" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-theme-primary tracking-tight">
              ChefVoice
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-teal-500">HACCP Compliance</span>
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
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="px-3 py-2 text-[11px] font-semibold text-theme-muted uppercase tracking-wider">
          Main Menu
        </p>
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150',
                isActive
                  ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20'
                  : 'text-theme-secondary hover:bg-theme-ghost hover:text-theme-primary'
              )}
            >
              <div className={cn(
                'p-2 rounded-lg transition-colors',
                isActive ? 'bg-white/20' : 'bg-theme-ghost'
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{item.label}</span>
                  {item.badge && (
                    <span className={cn(
                      'px-1.5 py-0.5 text-[9px] font-bold rounded',
                      isActive ? 'bg-white/20 text-white' : 'bg-teal-500/15 text-teal-500'
                    )}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className={cn(
                  'text-[11px] truncate',
                  isActive ? 'text-white/70' : 'text-theme-muted'
                )}>
                  {item.description}
                </p>
              </div>
            </button>
          )
        })}

        <div className="py-3">
          <div className="h-px bg-theme-secondary" />
        </div>

        <p className="px-3 py-2 text-[11px] font-semibold text-theme-muted uppercase tracking-wider">
          Management
        </p>
        {navItems.slice(4).map((item) => {
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
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150',
                isActive
                  ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20'
                  : 'text-theme-secondary hover:bg-theme-ghost hover:text-theme-primary',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className={cn(
                'p-2 rounded-lg transition-colors',
                isActive ? 'bg-white/20' : 'bg-theme-ghost'
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{item.label}</span>
                  {item.badge && !isDisabled && (
                    <span className={cn(
                      'px-1.5 py-0.5 text-[9px] font-bold rounded',
                      isActive ? 'bg-white/20 text-white' : 'bg-teal-500/15 text-teal-500'
                    )}>
                      {item.badge}
                    </span>
                  )}
                  {isDisabled && (
                    <span className="px-1.5 py-0.5 text-[9px] font-medium bg-theme-ghost text-theme-muted rounded">
                      PRO
                    </span>
                  )}
                </div>
                <p className={cn(
                  'text-[11px] truncate',
                  isActive ? 'text-white/70' : 'text-theme-muted'
                )}>
                  {item.description}
                </p>
              </div>
            </button>
          )
        })}
      </nav>

      {/* Admin Link (Dev) */}
      <div className="px-4 pb-2 mt-auto">
        <a
          href="/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-theme-secondary hover:bg-theme-ghost hover:text-theme-primary transition-all duration-150 group"
        >
          <div className="p-2 rounded-lg bg-theme-ghost group-hover:bg-indigo-500/10 transition-colors">
            <LayoutDashboard className="w-4 h-4 group-hover:text-indigo-500 transition-colors" />
          </div>
          <span className="font-medium text-sm">Admin Dashboard</span>
        </a>
      </div>

      {/* Logout Button */}
      <div className="px-4 pb-2">
        <button
          onClick={async () => {
            const { supabase } = await import('@/lib/supabase')
            const { clearKitchenComplianceAppStorage } = await import('@/lib/appStorage')
            await supabase.auth.signOut()
            // Clear only app state; never nuke all localStorage (it breaks remembered email + auth edge cases)
            clearKitchenComplianceAppStorage()
            window.location.reload() // Force reload to ensure clean slate
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-theme-secondary hover:bg-red-500/10 hover:text-red-500 transition-all duration-150 group"
        >
          <div className="p-2 rounded-lg bg-theme-ghost group-hover:bg-red-500/20 transition-colors">
            <LogOut className="w-4 h-4" />
          </div>
          <span className="font-medium text-sm">Log Out</span>
        </button>
      </div>

      {/* Active Venue Card */}
      <div className="p-4 border-t border-theme-secondary">
        <div className="p-3.5 rounded-xl bg-theme-ghost/50 border border-theme-secondary">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wide">
              Active Venue
            </p>
            {licenseType !== 'basic' && (
              <button className="p-1 hover:bg-theme-ghost rounded transition-colors">
                <ChevronDown className="w-3.5 h-3.5 text-theme-muted" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-sm shadow-teal-500/20">
              <Building2 className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="font-medium text-theme-primary text-sm truncate">
                  {siteName}
                </span>
              </div>
              <p className="text-[10px] text-theme-muted">Online • 0 alerts</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// Mobile Header with Hamburger Menu
export function MobileHeader({
  currentScreen,
  onMenuClick
}: Omit<SidebarProps, 'onNavigate' | 'siteName'> & { onMenuClick?: () => void }) {
  const { settings } = useAppStore()
  const licenseType = (settings.subscriptionTier || 'basic') as LicenseType
  const licenseConfig = LICENSE_CONFIG[licenseType]
  const LicenseIcon = licenseConfig.icon

  // Get current page title
  const navItems = getNavItems(licenseType)
  const currentItem = navItems.find(item => item.id === currentScreen)
  const pageTitle = currentItem?.label || 'Kitchen Ops'

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-glass-heavy border-b border-glass px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Hamburger Menu Button */}
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl hover:bg-theme-ghost transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6 text-theme-primary" />
        </button>

        {/* Page Title */}
        <div className="flex-1 text-center px-2">
          <h1 className="font-bold text-lg text-theme-primary truncate">
            {pageTitle}
          </h1>
          <div className="flex items-center justify-center gap-1">
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded',
              licenseType === 'basic' && 'bg-zinc-100 text-zinc-600',
              licenseType === 'pro' && 'bg-purple-100 text-purple-600',
              licenseType === 'enterprise' && 'bg-amber-100 text-amber-600'
            )}>
              <LicenseIcon className="w-2.5 h-2.5 inline mr-1" />
              {licenseConfig.label}
            </span>
          </div>
        </div>

        {/* Logo */}
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
          <Snowflake className="w-5 h-5 text-white" />
        </div>
      </div>
    </header>
  )
}

// Mobile Menu Drawer - Shows ALL navigation items
export function MobileMenuDrawer({
  isOpen,
  onClose,
  currentScreen,
  onNavigate,
  siteName = 'Kitchen Ops'
}: SidebarProps & { isOpen: boolean; onClose: () => void }) {
  const { settings } = useAppStore()
  const licenseType = (settings.subscriptionTier || 'basic') as LicenseType
  const licenseConfig = LICENSE_CONFIG[licenseType]


  const navItems = getNavItems(licenseType)

  const handleNavigate = (screenId: string) => {
    onNavigate(screenId)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="lg:hidden fixed top-0 left-0 bottom-0 w-[280px] max-w-[80vw] bg-theme-card z-50 shadow-2xl animate-slide-in-left overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-theme-primary bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
                <Snowflake className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white tracking-tight">
                  KITCHEN OPS
                </h1>
                <span className="text-xs text-white/60">HACCP PRO</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Venue Info */}
          <div className="flex items-center gap-2 text-white/80">
            <Building2 className="w-4 h-4" />
            <span className="text-sm truncate">{siteName}</span>
            <span className={cn(
              'ml-auto text-[10px] px-2 py-0.5 rounded-full',
              licenseType === 'basic' && 'bg-zinc-500/30 text-zinc-300',
              licenseType === 'pro' && 'bg-purple-500/30 text-purple-300',
              licenseType === 'enterprise' && 'bg-amber-500/30 text-amber-300'
            )}>
              {licenseConfig.label}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          <p className="px-3 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wider">
            Main Menu
          </p>

          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentScreen === item.id
            const isVenueItem = item.id === 'venues'
            const isDisabled = isVenueItem && licenseType === 'basic'

            return (
              <button
                key={item.id}
                onClick={() => !isDisabled && handleNavigate(item.id)}
                disabled={isDisabled}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all',
                  isActive
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'hover:bg-theme-ghost text-theme-primary',
                  isDisabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className={cn(
                  'p-2 rounded-lg',
                  isActive ? 'bg-white/20' : 'bg-theme-ghost'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.label}</span>
                    {item.badge && !isDisabled && (
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-bold',
                        isActive ? 'bg-white/20' : 'bg-emerald-500 text-white'
                      )}>
                        {item.badge}
                      </span>
                    )}
                    {isDisabled && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-theme-ghost text-theme-muted rounded">
                        PRO
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    'text-xs',
                    isActive ? 'text-white/70' : 'text-theme-muted'
                  )}>
                    {item.description}
                  </p>
                </div>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-theme-primary mt-auto">
          <p className="text-xs text-theme-muted text-center">
            ChefVoice Kitchen Compliance v1.0
          </p>
        </div>
      </div>
    </>
  )
}

// Mobile bottom navigation - Quick access to most important items
export function MobileNav({ currentScreen, onNavigate }: Omit<SidebarProps, 'siteName'>) {
  const quickNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'goods_receipt', label: 'GR', icon: Package },
    { id: 'receipt_history', label: 'History', icon: ClipboardCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-glass-heavy border-t border-glass safe-area-bottom z-40">
      <div className="flex justify-around items-center h-16 px-1">
        {quickNavItems.map((item) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-0 flex-1',
                isActive ? 'text-emerald-500' : 'text-theme-muted'
              )}
            >
              <div className={cn(
                'p-2 rounded-xl transition-all',
                isActive ? 'bg-emerald-500/20' : ''
              )}>
                <Icon className={cn('w-5 h-5', isActive && 'scale-110')} />
              </div>
              <span className={cn(
                'text-[10px] font-medium truncate',
                isActive ? 'text-emerald-500' : 'text-theme-muted'
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
