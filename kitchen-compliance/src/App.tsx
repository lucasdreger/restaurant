import { useState, useEffect, useRef, lazy, Suspense, startTransition } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useAppStore } from '@/store/useAppStore'
import { MainLayout } from '@/components/layout/MainLayout'

// Direct imports for fast navigation (main app screens)
import { Dashboard } from '@/components/screens/Dashboard'
import { HistoryScreen } from '@/components/screens/HistoryScreen'
import { SettingsScreen } from '@/components/screens/SettingsScreen'
import { ComplianceScreen } from '@/components/screens/ComplianceScreen'
import { ReportsScreen } from '@/components/screens/ReportsScreen'
import { VenuesScreen } from '@/components/screens/VenuesScreen'
import { MenuEngineeringScreen } from '@/components/menu/MenuEngineeringScreen'
import { GoodsReceiptScreen } from '@/components/receipt/GoodsReceiptScreen'

// Lazy load only auth/onboarding screens (used less frequently)
const LandingPage = lazy(() => import('@/components/landing/LandingPage').then(m => ({ default: m.LandingPage })))
const OnboardingQuestionnaire = lazy(() => import('@/components/onboarding/OnboardingQuestionnaire').then(m => ({ default: m.OnboardingQuestionnaire })))
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getStaffMembers } from '@/services/settingsService'
import type { Site } from '@/types'
import type { User, Session } from '@supabase/supabase-js'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

type Screen = 'home' | 'history' | 'settings' | 'compliance' | 'reports' | 'venues' | 'menu_engineering' | 'goods_receipt'

// Fallback demo site (used when Supabase not available)
const FALLBACK_DEMO_SITE: Site = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Demo Kitchen',
  address: '123 Restaurant Street',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

type AuthState = 'loading' | 'unauthenticated' | 'authenticated' | 'onboarding' | 'demo'

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [user, setUser] = useState<User | null>(null)
  const { setCurrentSite, setIsOnline, currentSite, settings, updateSettings, setStaffMembers } = useAppStore()

  // Main authentication effect - runs once on mount
  useEffect(() => {
    // Skip auth check if we're in demo mode
    if (authState === 'demo') {
      console.log('🎮 In demo mode - skipping auth check')
      return
    }

    if (!isSupabaseConfigured()) {
      console.log('🔧 Supabase not configured - showing landing')
      setAuthState('unauthenticated')
      return
    }

    let mounted = true
    let authStateRef: AuthState = authState // Track state locally to avoid stale closure
    
    // Skip if already determined (not loading)
    if (authState !== 'loading') {
      return
    }
    
    // Timeout to prevent infinite loading - show landing after 1.5 seconds
    const loadingTimeout = setTimeout(() => {
      if (mounted && authStateRef === 'loading') {
        console.log('⏰ Auth check timeout - showing landing')
        setAuthState('unauthenticated')
        authStateRef = 'unauthenticated'
      }
    }, 1500)

    // Function to check profile and determine auth state
    const checkProfileAndSetState = async (session: Session) => {
      if (!mounted) return
      
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', session.user.id)
          .maybeSingle() as { data: { onboarding_completed: boolean } | null; error: any }
        
        if (!mounted) return
        
        console.log('👤 Profile check:', { profile, error })
        
        if (error || !profile || !profile.onboarding_completed) {
          setAuthState('onboarding')
          authStateRef = 'onboarding'
        } else {
          setAuthState('authenticated')
          authStateRef = 'authenticated'
        }
      } catch (err) {
        console.error('Profile check error:', err)
        if (mounted) {
          setAuthState('onboarding')
          authStateRef = 'onboarding'
        }
      }
    }

    // Initial session check
    const initAuth = async () => {
      console.log('🔍 Initializing auth...')
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        console.log('📊 Initial session:', { 
          hasSession: !!session, 
          email: session?.user?.email,
          error: error?.message 
        })
        
        if (session?.user) {
          setUser(session.user)
          await checkProfileAndSetState(session)
        } else {
          setAuthState('unauthenticated')
          authStateRef = 'unauthenticated'
        }
      } catch (err) {
        console.error('Auth init error:', err)
        if (mounted) {
          setAuthState('unauthenticated')
          authStateRef = 'unauthenticated'
        }
      }
    }

    initAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth event:', event, session?.user?.email)
        
        if (!mounted) return
        
        // Don't change state if we're in demo mode
        if (authStateRef === 'demo') {
          console.log('🎮 In demo mode - ignoring auth event')
          return
        }
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await checkProfileAndSetState(session)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setAuthState('unauthenticated')
          authStateRef = 'unauthenticated'
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
        } else if (event === 'INITIAL_SESSION' && session?.user) {
          // Handle OAuth redirect - session already established
          setUser(session.user)
          await checkProfileAndSetState(session)
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [authState]) // Re-run when authState changes to handle demo mode

  // Apply theme class to document
  useEffect(() => {
    const themeClass = `theme-${settings.theme}`
    document.documentElement.classList.remove('theme-day', 'theme-night')
    document.documentElement.classList.add(themeClass)
  }, [settings.theme])

  // Track if we've fetched site data
  const hasFetchedSite = useRef(false)

  // Fetch user's venue and set as currentSite (runs when user is authenticated)
  useEffect(() => {
    // Only fetch when user is authenticated and we haven't fetched yet
    if (authState !== 'authenticated' || !user || hasFetchedSite.current) return
    hasFetchedSite.current = true

    const fetchUserVenue = async () => {
      if (!isSupabaseConfigured()) {
        setCurrentSite(FALLBACK_DEMO_SITE)
        return
      }

      try {
        // Get user's profile to find their current_venue_id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('current_venue_id')
          .eq('id', user.id)
          .single() as { data: { current_venue_id: string | null } | null; error: any }

        if (profileError) {
          console.warn('Failed to fetch profile:', profileError)
          setCurrentSite(FALLBACK_DEMO_SITE)
          return
        }

        if (profile?.current_venue_id) {
          // Fetch the venue details
          const { data: venue, error: venueError } = await supabase
            .from('venues')
            .select('*')
            .eq('id', profile.current_venue_id)
            .single() as { data: any; error: any }

          if (!venueError && venue) {
            console.log('✅ Loaded user venue:', venue.name)
            // Map venue to Site interface
            setCurrentSite({
              id: venue.id,
              name: venue.name,
              address: venue.address || undefined,
              kiosk_pin: venue.kiosk_pin || undefined,
              alert_email: venue.alert_email || undefined,
              alert_phone: venue.alert_phone || undefined,
              created_at: venue.created_at || new Date().toISOString(),
              updated_at: venue.updated_at || new Date().toISOString(),
            })
            
            if (venue.subscription_tier) {
              updateSettings({ subscriptionTier: venue.subscription_tier as 'basic' | 'pro' | 'enterprise' })
            }
            return
          }
        }

        // Fallback: try to find any venue created by this user
        const { data: ownedVenue, error: ownedError } = await supabase
          .from('venues')
          .select('*')
          .eq('created_by', user.id)
          .limit(1)
          .single() as { data: any; error: any }

        if (!ownedError && ownedVenue) {
          console.log('✅ Loaded owned venue:', ownedVenue.name)
          setCurrentSite({
            id: ownedVenue.id,
            name: ownedVenue.name,
            address: ownedVenue.address || undefined,
            kiosk_pin: ownedVenue.kiosk_pin || undefined,
            alert_email: ownedVenue.alert_email || undefined,
            alert_phone: ownedVenue.alert_phone || undefined,
            created_at: ownedVenue.created_at || new Date().toISOString(),
            updated_at: ownedVenue.updated_at || new Date().toISOString(),
          })
          
          if (ownedVenue.subscription_tier) {
            updateSettings({ subscriptionTier: ownedVenue.subscription_tier as 'basic' | 'pro' | 'enterprise' })
          }
          return
        }

        console.warn('No venue found for user, using demo site')
        setCurrentSite(FALLBACK_DEMO_SITE)
      } catch (err) {
        console.warn('Failed to fetch venue:', err)
        setCurrentSite(FALLBACK_DEMO_SITE)
      }
    }

    fetchUserVenue()
  }, [authState, user, setCurrentSite, updateSettings])

  // Load staff members when site changes
  useEffect(() => {
    if (!currentSite?.id) return

    const loadStaff = async () => {
      try {
        const staffData = await getStaffMembers(currentSite.id)
        setStaffMembers(staffData.map(s => ({
          id: s.id,
          name: s.name,
          initials: s.initials || '',
          role: s.role as 'manager' | 'chef' | 'staff',
          active: s.active ?? true,
          site_id: s.site_id,
          created_at: s.created_at,
        })))
      } catch (err) {
        console.warn('Failed to fetch staff:', err)
      }
    }

    loadStaff()
  }, [currentSite?.id, setStaffMembers])

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setIsOnline])

  // Handle navigation with startTransition for smooth updates
  const handleNavigate = (screen: string) => {
    startTransition(() => {
      setCurrentScreen(screen as Screen)
    })
  }

  // Handle logout
  const handleLogout = async () => {
    console.log('🚪 Logging out...')
    await supabase.auth.signOut()
  }

  // Handle onboarding complete
  const handleOnboardingComplete = () => {
    setAuthState('authenticated')
  }

  // Handle demo mode start
  const handleDemoStart = () => {
    console.log('🎮 Starting Demo Mode')
    
    // Set demo site data
    const DEMO_SITE = {
      id: 'demo-site-123',
      name: 'Demo Restaurant',
      address: '123 Demo Street, Dublin, Ireland',
      kiosk_pin: '1234',
      alert_email: 'demo@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    setCurrentSite(DEMO_SITE)
    
    // Set demo staff members
    setStaffMembers([
      { id: 'demo-staff-1', name: 'John Chef', initials: 'JC', role: 'chef', active: true, site_id: 'demo-site-123', created_at: new Date().toISOString() },
      { id: 'demo-staff-2', name: 'Mary Manager', initials: 'MM', role: 'manager', active: true, site_id: 'demo-site-123', created_at: new Date().toISOString() },
      { id: 'demo-staff-3', name: 'Sam Staff', initials: 'SS', role: 'staff', active: true, site_id: 'demo-site-123', created_at: new Date().toISOString() },
    ])
    
    // Update settings for demo
    updateSettings({ subscriptionTier: 'pro' })
    
    setAuthState('demo')
  }

  // Handle exit demo
  const handleExitDemo = () => {
    console.log('🚪 Exiting Demo Mode')
    setAuthState('unauthenticated')
    setCurrentSite(null as any)
    setStaffMembers([])
  }

  // Render current screen content (without layout wrapper - MainLayout handles that)
  const renderScreenContent = () => {
    switch (currentScreen) {
      case 'history':
        return <HistoryScreen onBack={() => setCurrentScreen('home')} />
      case 'settings':
        return <SettingsScreen onBack={() => setCurrentScreen('home')} />
      case 'compliance':
        return <ComplianceScreen onBack={() => setCurrentScreen('home')} />
      case 'reports':
        return <ReportsScreen onBack={() => setCurrentScreen('home')} />
      case 'menu_engineering':
        return <MenuEngineeringScreen onBack={() => setCurrentScreen('home')} />
      case 'goods_receipt':
        return <GoodsReceiptScreen onBack={() => setCurrentScreen('home')} onNavigate={handleNavigate} />
      case 'venues':
        return <VenuesScreen onBack={() => setCurrentScreen('home')} />
      case 'home':
      default:
        // Dashboard has its own layout with sidebar - render directly
        return (
          <Dashboard
            onNavigate={handleNavigate}
            currentScreen={currentScreen}
          />
        )
    }
  }

  // Wrap content in MainLayout for non-home screens
  const renderScreen = () => {
    // Dashboard already has its own layout with sidebar
    if (currentScreen === 'home') {
      return renderScreenContent()
    }
    
    // Other screens get wrapped in MainLayout for consistent sidebar on desktop
    return (
      <MainLayout 
        currentScreen={currentScreen} 
        onNavigate={handleNavigate}
      >
        {renderScreenContent()}
      </MainLayout>
    )
  }

  // Toast styles
  const toastStyle = settings.theme === 'day' 
    ? {
        background: '#ffffff',
        color: '#1e293b',
        border: '1px solid #e2e8f0',
        borderRadius: '0.875rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      }
    : {
        background: '#1e293b',
        color: '#f8fafc',
        border: '1px solid #334155',
        borderRadius: '0.875rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      }

  // Loading state
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // Loading fallback component
  const LoadingFallback = () => (
    <div className="min-h-screen bg-theme-primary flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-theme-muted text-sm">Loading...</p>
      </div>
    </div>
  )

  // Unauthenticated - show landing
  if (authState === 'unauthenticated') {
    return (
      <>
        <Suspense fallback={<LoadingFallback />}>
          <LandingPage onSignIn={() => {}} onDemoStart={handleDemoStart} />
        </Suspense>
        <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
      </>
    )
  }

  // Demo mode - show dashboard with demo banner (no Suspense - screens are direct imports)
  if (authState === 'demo') {
    return (
      <>
        {/* Demo Banner */}
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-black py-2 px-4 text-center text-sm font-semibold">
          🎮 Demo Mode - Explore freely! Data won't be saved.
          <button
            onClick={handleExitDemo}
            className="ml-4 px-3 py-1 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
          >
            Exit Demo
          </button>
        </div>
        <div className="pt-10">
          {renderScreen()}
        </div>
        <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
      </>
    )
  }

  // Onboarding needed
  if (authState === 'onboarding' && user) {
    return (
      <>
        <Suspense fallback={<LoadingFallback />}>
          <OnboardingQuestionnaire
            userId={user.id}
            userEmail={user.email || ''}
            onComplete={handleOnboardingComplete}
          />
        </Suspense>
        <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
      </>
    )
  }

  // Authenticated - show dashboard (no Suspense - screens are direct imports for instant navigation)
  return (
    <>
      <button
        onClick={handleLogout}
        className="fixed top-4 right-4 z-50 px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
      >
        🚪 Logout
      </button>
      {renderScreen()}
      <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
    </>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

export default App
