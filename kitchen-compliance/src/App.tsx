import { useState, useEffect, useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { Dashboard } from '@/components/screens/Dashboard'
import { HistoryScreen } from '@/components/screens/HistoryScreen'
import { SettingsScreen } from '@/components/screens/SettingsScreen'
import { ComplianceScreen } from '@/components/screens/ComplianceScreen'
import { ReportsScreen } from '@/components/screens/ReportsScreen'
import { VenuesScreen } from '@/components/screens/VenuesScreen'
import { MenuEngineeringScreen } from '@/components/menu/MenuEngineeringScreen'
import { GoodsReceiptScreen } from '@/components/receipt/GoodsReceiptScreen'
import { LandingPage } from '@/components/landing/LandingPage'
import { OnboardingQuestionnaire } from '@/components/onboarding/OnboardingQuestionnaire'
import { useAppStore } from '@/store/useAppStore'
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

type AuthState = 'loading' | 'unauthenticated' | 'authenticated' | 'onboarding'

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [user, setUser] = useState<User | null>(null)
  const { setCurrentSite, setIsOnline, currentSite, settings, updateSettings, setStaffMembers } = useAppStore()

  // Main authentication effect
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      console.log('🔧 Supabase not configured - showing landing')
      setAuthState('unauthenticated')
      return
    }

    let mounted = true
    
    // Timeout to prevent infinite loading - show landing after 2 seconds
    const loadingTimeout = setTimeout(() => {
      if (mounted && authState === 'loading') {
        console.log('⏰ Auth check timeout - showing landing')
        setAuthState('unauthenticated')
      }
    }, 2000)

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
        } else {
          setAuthState('authenticated')
        }
      } catch (err) {
        console.error('Profile check error:', err)
        if (mounted) setAuthState('onboarding')
      }
    }

    // Initial session check with timeout
    const initAuth = async () => {
      console.log('🔍 Initializing auth...')
      
      try {
        // Race between getSession and a timeout
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => resolve(null), 1500)
        )
        
        const result = await Promise.race([sessionPromise, timeoutPromise])
        
        if (!result || !mounted) {
          console.log('⏰ Session check timeout')
          if (mounted) setAuthState('unauthenticated')
          return
        }
        
        const { data: { session }, error } = result
        
        console.log('📊 Initial session:', { 
          hasSession: !!session, 
          email: session?.user?.email,
          error: error?.message 
        })
        
        if (session?.user) {
          setUser(session.user)
          await checkProfileAndSetState(session)
        } else {
          if (mounted) setAuthState('unauthenticated')
        }
      } catch (err) {
        console.error('Auth init error:', err)
        if (mounted) setAuthState('unauthenticated')
      }
    }

    initAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth event:', event, session?.user?.email)
        
        if (!mounted) return
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await checkProfileAndSetState(session)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setAuthState('unauthenticated')
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [authState])

  // Apply theme class to document
  useEffect(() => {
    const themeClass = `theme-${settings.theme}`
    document.documentElement.classList.remove('theme-day', 'theme-night')
    document.documentElement.classList.add(themeClass)
  }, [settings.theme])

  // Track if we've fetched site data
  const hasFetchedSite = useRef(false)

  // Fetch site from Supabase or use fallback (runs once on mount)
  useEffect(() => {
    if (hasFetchedSite.current) return
    hasFetchedSite.current = true

    const fetchSite = async () => {
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase
            .from('sites')
            .select('*')
            .limit(1)
            .single() as { data: any; error: any }

          if (!error && data) {
            setCurrentSite({
              id: data.id,
              name: data.name,
              address: data.address || undefined,
              kiosk_pin: data.kiosk_pin || undefined,
              alert_email: data.alert_email || undefined,
              alert_phone: data.alert_phone || undefined,
              created_at: data.created_at || new Date().toISOString(),
              updated_at: data.updated_at || new Date().toISOString(),
            })
            
            if (data.subscription_tier) {
              updateSettings({ subscriptionTier: data.subscription_tier as 'basic' | 'pro' | 'enterprise' })
            }
            return
          }
        } catch (err) {
          console.warn('Failed to fetch site:', err)
        }
      }
      setCurrentSite(FALLBACK_DEMO_SITE)
    }

    fetchSite()
  }, [setCurrentSite, updateSettings])

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

  // Handle navigation
  const handleNavigate = (screen: string) => {
    setCurrentScreen(screen as Screen)
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

  // Render current screen
  const renderScreen = () => {
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
        return <GoodsReceiptScreen onBack={() => setCurrentScreen('home')} />
      case 'venues':
        return <VenuesScreen onBack={() => setCurrentScreen('home')} />
      case 'home':
      default:
        return (
          <Dashboard
            onNavigate={handleNavigate}
            currentScreen={currentScreen}
          />
        )
    }
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

  // Unauthenticated - show landing
  if (authState === 'unauthenticated') {
    return (
      <>
        <LandingPage onSignIn={() => {}} />
        <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
      </>
    )
  }

  // Onboarding needed
  if (authState === 'onboarding' && user) {
    return (
      <>
        <OnboardingQuestionnaire
          userId={user.id}
          userEmail={user.email || ''}
          onComplete={handleOnboardingComplete}
        />
        <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
      </>
    )
  }

  // Authenticated - show dashboard
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
