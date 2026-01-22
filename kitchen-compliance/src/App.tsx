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
import type { User } from '@supabase/supabase-js'

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

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  
  // Check for demo mode via URL param (?demo=true) or dev shortcut
  const isDemoMode = () => {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('demo') === 'true' || urlParams.has('dev')
  }
  
  const [showLanding, setShowLanding] = useState(!isDemoMode()) // Skip landing if demo mode
  const [user, setUser] = useState<User | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const { setCurrentSite, setIsOnline, currentSite, settings, updateSettings, setStaffMembers } = useAppStore()

  // Check authentication status
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsCheckingAuth(false)
      return
    }

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          setUser(session.user)
          setShowLanding(false)
          
          // Check if user needs onboarding (with timeout)
          const profileCheckPromise = supabase
            .from('profiles')
            .select('onboarding_completed, current_venue_id')
            .eq('id', session.user.id)
            .maybeSingle()
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 2000)
          )
          
          try {
            const { data: profile } = await Promise.race([profileCheckPromise, timeoutPromise]) as any
            
            if (!profile || !profile.onboarding_completed) {
              setNeedsOnboarding(true)
            }
          } catch (profileError) {
            // If timeout or error, assume needs onboarding
            console.log('Profile check skipped (timeout or error):', profileError)
            setNeedsOnboarding(true)
          }
        }
      } catch (error) {
        console.error('Auth check error:', error)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        setShowLanding(false)
        
        // Check onboarding status with timeout
        const profileCheckPromise = supabase
          .from('profiles')
          .select('onboarding_completed, current_venue_id')
          .eq('id', session.user.id)
          .maybeSingle()
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 2000)
        )
        
        try {
          const { data: profile } = await Promise.race([profileCheckPromise, timeoutPromise]) as any
          
          if (!profile || !profile.onboarding_completed) {
            setNeedsOnboarding(true)
          } else {
            setNeedsOnboarding(false)
          }
        } catch (profileError) {
          console.log('Profile check skipped (timeout or error):', profileError)
          setNeedsOnboarding(true)
        }
      } else {
        setShowLanding(true)
        setNeedsOnboarding(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

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
          const { data: rawData, error } = await (supabase
            .from('sites') as any)
            .select('*')
            .limit(1)
            .single()
            
          const data = rawData as any

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
            
            // Sync subscription tier from database to store settings
            if (data.subscription_tier) {
              updateSettings({ subscriptionTier: data.subscription_tier as 'basic' | 'pro' | 'enterprise' })
            }
            return
          }
        } catch (err) {
          console.warn('Failed to fetch site from Supabase:', err)
        }
      }

      // Fallback to demo site if no data from Supabase
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
        console.log('Staff loaded:', staffData.length, 'members')
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

  // Dynamic toast styles based on theme
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

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Show onboarding for authenticated users who haven't completed it
  if (user && needsOnboarding) {
    return (
      <>
        <OnboardingQuestionnaire
          userId={user.id}
          userEmail={user.email || ''}
          onComplete={() => setNeedsOnboarding(false)}
        />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '0.875rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            },
          }}
        />
      </>
    )
  }

  // Show landing page for new visitors
  if (showLanding) {
    return (
      <>
        <LandingPage onSignIn={() => setShowLanding(false)} />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '0.875rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            },
          }}
        />
      </>
    )
  }

  return (
    <>
      {renderScreen()}
      <Toaster
        position="top-center"
        toastOptions={{
          style: toastStyle,
        }}
      />
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
