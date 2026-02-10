import { useState, useEffect, useRef, lazy, Suspense, startTransition } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster, toast } from 'sonner'
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
import { ReceiptHistoryScreen } from '@/components/receipt/ReceiptHistoryScreen'

// Lazy load only auth/onboarding screens (used less frequently)
const LandingPage = lazy(() => import('@/components/landing/LandingPage').then(m => ({ default: m.LandingPage })))
const OnboardingQuestionnaire = lazy(() => import('@/components/onboarding/OnboardingQuestionnaire').then(m => ({ default: m.OnboardingQuestionnaire })))
import { supabase, isSupabaseConfigured, DEMO_SITE_ID } from '@/lib/supabase'
import { getSiteSettings } from '@/services/settingsService'
import { getStaffMembers, verifyPin } from '@/services/staffService'
import { PinPad } from '@/components/auth/PinPad'
import { fetchCoolingSessions } from '@/services/coolingService'
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

type Screen = 'home' | 'history' | 'settings' | 'compliance' | 'reports' | 'venues' | 'menu_engineering' | 'goods_receipt' | 'receipt_history'

// Fallback demo site (used when Supabase not available)
const FALLBACK_DEMO_SITE: Site = {
  id: DEMO_SITE_ID,
  name: 'Luma Executive Kitchen',
  address: 'Grand Canal Dock, Dublin 2, Ireland',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

type AuthState = 'loading' | 'unauthenticated' | 'authenticated' | 'onboarding' | 'demo'

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [showLanding, setShowLanding] = useState(true)
  const { setCurrentSite, setIsOnline, currentSite, settings, updateSettings, setStaffMembers, setCoolingSessions, setIsDemo, isDemo } = useAppStore()

  // Track component mount state
  const isMounted = useRef(true)
  useEffect(() => {
    return () => { isMounted.current = false }
  }, [])

  // Sync authState to ref for usage in effects
  const authStateRef = useRef(authState)
  const currentAuthUserRef = useRef<string | null>(null)

  useEffect(() => {
    authStateRef.current = authState
  }, [authState])

  // Main authentication effect - runs once on mount
  useEffect(() => {
    // Handle persisted demo mode
    if (isDemo) {
      if (authState !== 'demo') {
        console.log('🎮 Restoring demo session')
        setAuthState('demo')
        setShowLanding(false)
      }
      return
    }

    // Skip auth check if we're already in demo state
    if (authStateRef.current === 'demo') {
      return
    }

    if (!isSupabaseConfigured()) {
      console.log('🔧 Supabase not configured - showing landing')
      setAuthState('unauthenticated')
      return
    }

    // Track if auth check has started (no timeout - user said they don't care about delays)
    let profileCheckInProgress = false

    // Function to check profile and determine auth state
    const checkProfileAndSetState = async (session: Session) => {
      // Prevent duplicate calls
      if (profileCheckInProgress) {
        console.log('⏳ Profile check already in progress, skipping duplicate call')
        return
      }

      // Update ref immediately to block other listeners synchronously
      currentAuthUserRef.current = session.user.id
      profileCheckInProgress = true

      try {
        console.log('🔍 Checking profile for:', session.user.email)

        // Race against a timeout - if it hangs, we MUST release the user
        const profilePromise = supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', session.user.id)
          .maybeSingle()

        const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
          setTimeout(() => resolve({ timeout: true }), 5000)
        )

        const result = await Promise.race([profilePromise, timeoutPromise])

        if ('timeout' in result) {
          console.warn('⚠️ Profile check timed out - defaulting to unauthenticated to avoid hang')
          toast.error('Connection timed out. Please sign in again.')

          // UI Update FIRST - Don't wait for network
          setUser(null)
          setAuthState('unauthenticated')
          setShowLanding(true)
          currentAuthUserRef.current = null // Clear ref on failure

          // Cleanup in background (fire and forget)
          localStorage.clear()
          sessionStorage.setItem('manual_logout', 'true')
          supabase.auth.signOut().catch(e => console.error('SignOut error:', e))
          return
        }

        const { data: profile, error } = result as any

        console.log('👤 Profile check result:', { profile, error })

        if (error) {
          console.error('Profile query error:', error)
          // On error, show onboarding to be safe
          setAuthState('onboarding')
        } else if (!profile || !profile.onboarding_completed) {
          console.log('⚠️ Onboarding incomplete or profile missing')
          // New company → questionnaire
          setAuthState('onboarding')
        } else {
          console.log('✅ Profile verified - routing to Dashboard')
          // Existing company → dashboard
          setAuthState('authenticated')
          // Unlock Kiosk Mode for the authenticated user (Manager/Owner)
          useAppStore.getState().unlockKiosk(session.user.id)
        }
        setShowLanding(false)
      } catch (err) {
        console.error('Profile check error:', err)
        setAuthState('onboarding')
        setShowLanding(false)
        currentAuthUserRef.current = null // Clear ref on error
      } finally {
        profileCheckInProgress = false
      }
    }

    // Initial session check - runs once on mount
    const initAuth = async () => {
      console.log('🔍 Initializing auth...')

      // Check for manual logout flag to break loops
      if (sessionStorage.getItem('manual_logout')) {
        console.log('🛑 Manual logout flag detected - forcing sign out')
        sessionStorage.removeItem('manual_logout')
        await supabase.auth.signOut().catch(console.error)
        localStorage.clear()

        setUser(null)
        setAuthState('unauthenticated')
        setShowLanding(true)
        currentAuthUserRef.current = null
        return
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession()

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
          currentAuthUserRef.current = null
        }
      } catch (err: any) {
        console.error('Auth init error:', err)
        setAuthState('unauthenticated')
        currentAuthUserRef.current = null
      }
    }

    initAuth()

    // Listen for auth state changes (sign in/out events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth event:', event, session?.user?.email)

        // Don't change state if we're in demo mode
        if (authStateRef.current === 'demo') {
          console.log('🎮 In demo mode - ignoring auth event')
          return
        }

        // Deduplicate INITIAL_SESSION vs SIGNED_IN race
        if (event === 'INITIAL_SESSION') {
          // initAuth handles this manually to ensure profile check
          return
        }

        // Only process explicit sign in/out events, not duplicates
        if (event === 'SIGNED_IN' && session?.user) {
          // Check if we are already processing/authenticated with this user
          if (currentAuthUserRef.current === session.user.id) {
            console.log('🔄 User already authenticated/processing - ignoring duplicate SIGNED_IN')
            return
          }

          setUser(session.user)
          await checkProfileAndSetState(session)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setAuthState('unauthenticated')
          setShowLanding(true)
          currentAuthUserRef.current = null
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
        }
        // Note: INITIAL_SESSION is handled by initAuth(), don't duplicate
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, []) // Run once, depend on refs

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

    const loadStaffAndCooling = async () => {
      try {
        const staffData = await getStaffMembers(currentSite.id)
        setStaffMembers(staffData.map(s => ({
          id: s.id,
          name: s.name,
          initials: s.initials || '',
          role: s.role as 'manager' | 'chef' | 'staff',
          active: s.active ?? true,
          site_id: s.site_id,
          staff_code: s.staff_code ?? null,
          created_at: s.created_at,
        })))
      } catch (err) {
        console.warn('Failed to fetch staff:', err)
      }

      try {
        const sessions = await fetchCoolingSessions(currentSite.id)
        // Only overwrite localStorage if we got valid data from DB
        // This prevents empty DB results from wiping local sessions
        if (sessions && sessions.length > 0) {
          console.log(`❄️ Loaded ${sessions.length} cooling sessions from database`)
          setCoolingSessions(sessions)
        } else {
          // Check if we have local sessions for this site
          const { coolingSessions: localSessions } = useAppStore.getState()
          const siteLocalSessions = localSessions.filter(s => s.site_id === currentSite.id)
          if (siteLocalSessions.length > 0) {
            console.log(`❄️ Using ${siteLocalSessions.length} local cooling sessions`)
          } else {
            console.log('❄️ No cooling sessions found in DB or localStorage')
          }
        }
      } catch (err) {
        console.warn('Failed to fetch cooling sessions, keeping local data:', err)
      }
    }

    loadStaffAndCooling()
  }, [currentSite?.id, setStaffMembers, setCoolingSessions])

  // Load site settings (API keys + preferences) when site changes
  useEffect(() => {
    if (!currentSite?.id) return

    const loadSiteSettings = async () => {
      try {
        const settingsRecord = await getSiteSettings(currentSite.id)
        if (!settingsRecord) return

        updateSettings({
          theme: (settingsRecord.theme as 'day' | 'night') || settings.theme,
          language: settingsRecord.language || settings.language,
          voiceProvider: (settingsRecord.voice_provider as 'browser' | 'openai' | 'openrouter') || settings.voiceProvider,
          audioModel: (settingsRecord.audio_model as any) || settings.audioModel,
          openaiApiKey: settingsRecord.openai_api_key ?? settings.openaiApiKey,
          openrouterApiKey: settingsRecord.openrouter_api_key ?? settings.openrouterApiKey,
          ocrProvider: (settingsRecord.ocr_provider as any) || settings.ocrProvider,
          ocrModel: (settingsRecord.ocr_model as any) || settings.ocrModel,
          ttsEnabled: settingsRecord.tts_enabled ?? settings.ttsEnabled,
          wakeWordEnabled: settingsRecord.wake_word_enabled ?? settings.wakeWordEnabled,
          activeWakeWords: settingsRecord.active_wake_words ?? settings.activeWakeWords,
        })
      } catch (error) {
        console.warn('Failed to load site settings:', error)
      }
    }

    loadSiteSettings()
  }, [currentSite?.id])

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



  // Handle onboarding complete
  const handleOnboardingComplete = () => {
    setAuthState('authenticated')
    setShowLanding(false)
  }

  // Handle demo mode start - Auto login with persistent demo user
  const handleDemoStart = async () => {
    console.log('🎮 Starting Demo Mode - Auto Login')
    setShowLanding(false)

    // Enter demo mode immediately to avoid loading limbo
    const { resetDataLoaded, setCurrentSite, updateSettings, setStaffMembers, setCoolingSessions, setIsDemo } = useAppStore.getState()
    setIsDemo(true)

    // Clear everything first to avoid site leakage
    resetDataLoaded()
    setCurrentSite(FALLBACK_DEMO_SITE)
    updateSettings({ subscriptionTier: 'pro' })
    setAuthState('demo')

    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured - staying in offline demo mode')
      return
    }

    try {
      // Sign in with persistent demo credentials
      // Note: We attempt login but proceed even on failure (fallback to anon key + demo RLS)
      // This bypasses transient Supabase Auth 500 errors like 'Database error querying schema'
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'demo@chefvoice.app',
        password: 'demo123!@#',
      })

      if (authError) {
        console.warn('⚠️ Demo authentication failed, proceeding with anon-bypass:', authError.message)
      } else {
        console.log('✅ Demo user authenticated:', authData.user?.email)
      }

      // Small delay to ensure session/headers are ready if login succeeded
      await new Promise(resolve => setTimeout(resolve, 300))

      try {
        // Fetch data from Supabase for the demo site
        const [settingsRecord, staffData, coolingData] = await Promise.all([
          getSiteSettings(FALLBACK_DEMO_SITE.id),
          getStaffMembers(FALLBACK_DEMO_SITE.id),
          fetchCoolingSessions(FALLBACK_DEMO_SITE.id)
        ])

        if (settingsRecord) {
          updateSettings({
            theme: (settingsRecord.theme as 'day' | 'night') || settings.theme,
            language: settingsRecord.language || settings.language,
            voiceProvider: (settingsRecord.voice_provider as 'browser' | 'openai' | 'openrouter') || settings.voiceProvider,
            audioModel: (settingsRecord.audio_model as any) || settings.audioModel,
            openaiApiKey: settingsRecord.openai_api_key ?? settings.openaiApiKey,
            openrouterApiKey: settingsRecord.openrouter_api_key ?? settings.openrouterApiKey,
            ocrProvider: (settingsRecord.ocr_provider as any) || settings.ocrProvider,
            ocrModel: (settingsRecord.ocr_model as any) || settings.ocrModel,
            ttsEnabled: settingsRecord.tts_enabled ?? settings.ttsEnabled,
            wakeWordEnabled: settingsRecord.wake_word_enabled ?? settings.wakeWordEnabled,
            activeWakeWords: settingsRecord.active_wake_words ?? settings.activeWakeWords,
          })
        }

        if (staffData && staffData.length > 0) {
          console.log(`👥 Loaded ${staffData.length} demo staff members`)
          setStaffMembers(
            staffData.map((staff) => ({
              id: staff.id,
              name: staff.name,
              initials: staff.initials || staff.name.substring(0, 2).toUpperCase(),
              role: staff.role as 'manager' | 'chef' | 'staff',
              active: staff.active ?? true,
              site_id: staff.site_id,
              staff_code: staff.staff_code ?? null,
              created_at: staff.created_at,
            }))
          )
        } else {
          console.warn('⚠️ No demo staff found in database')
        }

        if (coolingData && coolingData.length > 0) {
          console.log(`❄️ Loaded ${coolingData.length} demo cooling sessions from database`)
          setCoolingSessions(coolingData)
        } else {
          console.log('❄️ No demo cooling sessions found in database - keeping local sessions')
          // Do NOT wipe local sessions to verify persistence
        }
      } catch (err) {
        console.warn('Failed to load demo site data:', err)
      }
    } catch (err) {
      console.error('Demo mode error:', err)
    }
  }

  // Handle exit demo
  const handleExitDemo = () => {
    console.log('🚪 Exiting Demo Mode')
    setIsDemo(false)
    setAuthState('unauthenticated')
    setCurrentSite(null as any)
    setStaffMembers([])
    setShowLanding(true)
  }

  // Kiosk PIN Logic
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinLoading, setPinLoading] = useState(false)
  const { kioskMode, kioskLocked, lockKiosk, unlockKiosk, staffMembers } = useAppStore()

  const handlePinSubmit = async (pin: string) => {
    if (!currentSite?.id) return
    setPinLoading(true)
    setPinError(null)

    try {
      // Find staff by PIN locally first (faster) checking active staff
      // logic: we have staffMembers in store, we can check there
      const staff = staffMembers.find(s => s.staff_code === pin || (s as any).pin === pin)

      // If found locally, verify
      if (staff) {
        if (!staff.active) {
          setPinError('Staff member is inactive')
          setPinLoading(false)
          return
        }
        unlockKiosk(staff.id)
        toast.success(`Welcome back, ${staff.name.split(' ')[0]}!`)
        setPinLoading(false)
        return
      }

      // Fallback to server verify (for security or if local is stale)
      const verifiedStaff = await verifyPin(currentSite.id, pin)
      if (verifiedStaff) {
        unlockKiosk(verifiedStaff.id)
        toast.success(`Welcome back, ${verifiedStaff.name.split(' ')[0]}!`)
      } else {
        setPinError('Invalid PIN code')
      }
    } catch (err) {
      console.error('PIN verify error:', err)
      setPinError('Error verifying PIN')
    } finally {
      setPinLoading(false)
    }
  }

  // Auto-lock on idle (5 minutes)
  useEffect(() => {
    if (!kioskMode || kioskLocked) return

    let timeout: NodeJS.Timeout
    const resetTimer = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        console.log('🔒 Kiosk auto-lock triggered')
        lockKiosk()
      }, 5 * 60 * 1000) // 5 minutes
    }

    // Events to monitor
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => document.addEventListener(e, resetTimer))

    resetTimer()

    return () => {
      clearTimeout(timeout)
      events.forEach(e => document.removeEventListener(e, resetTimer))
    }
  }, [kioskMode, kioskLocked, lockKiosk])

  // If in Kiosk Mode and Locked, show PinPad overlay
  // But ONLY if we are authenticated (or in demo mode) and have a site loaded
  const showPinPad = kioskMode && kioskLocked && (authState === 'authenticated' || authState === 'demo') && currentSite

  if (showPinPad) {
    return (
      <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
        <PinPad
          onSuccess={handlePinSubmit}
          error={pinError}
          isLoading={pinLoading}
          label={currentSite?.name ? `${currentSite.name}` : "Kiosk Locked"}
        />
        <div className="mt-8 flex gap-4">
          {authState === 'demo' && (
            <button
              onClick={handleExitDemo}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Exit Demo
            </button>
          )}
          <button
            onClick={() => useAppStore.getState().setKioskMode(false)}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Exit Kiosk Mode (Dev)
          </button>
        </div>
      </div>
    )
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
      case 'receipt_history':
        return <ReceiptHistoryScreen onBack={() => setCurrentScreen('home')} onNavigate={handleNavigate} />
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

  // Loading fallback component with timeout escape hatch
  const LoadingFallback = () => {
    const [showEscape, setShowEscape] = useState(false)

    useEffect(() => {
      const timer = setTimeout(() => setShowEscape(true), 5000)
      return () => clearTimeout(timer)
    }, [])

    return (
      <div className="min-h-screen bg-theme-primary flex flex-col items-center justify-center p-4">
        <div className="text-center mb-8">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-theme-muted text-sm animate-pulse">Loading Kitchen Compliance...</p>
        </div>

        {showEscape && (
          <div className="animate-fade-in text-center">
            <p className="text-xs text-theme-muted mb-3">Taking longer than expected?</p>
            <button
              onClick={async () => {
                const { supabase } = await import('@/lib/supabase')
                sessionStorage.setItem('manual_logout', 'true')
                localStorage.clear()
                // Fire and forget sign out, then reload immediately
                supabase.auth.signOut().catch(console.error)
                window.location.reload()
              }}
              className="px-4 py-2 bg-theme-bg border border-theme-primary rounded-lg text-theme-muted text-xs hover:text-theme-primary transition-colors"
            >
              Reload Application
            </button>
          </div>
        )}
      </div>
    )
  }

  // Loading state
  if (authState === 'loading') {
    return <LoadingFallback />
  }

  // Always show landing first
  if (showLanding) {
    const shouldShowContinue = authState !== 'unauthenticated'
    return (
      <>
        <Suspense fallback={<LoadingFallback />}>
          <LandingPage
            onSignIn={shouldShowContinue ? () => setShowLanding(false) : undefined}
            onDemoStart={handleDemoStart}
          />
        </Suspense>
        <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
      </>
    )
  }

  // Unauthenticated - show landing
  if (authState === 'unauthenticated') {
    return (
      <>
        <Suspense fallback={<LoadingFallback />}>
          <LandingPage onSignIn={() => { }} onDemoStart={handleDemoStart} />
        </Suspense>
        <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
      </>
    )
  }

  // Demo mode - show dashboard with demo banner (no Suspense - screens are direct imports)
  if (authState === 'demo') {
    // Ensure demo mode always uses the correct site ID (in case of stale localStorage)
    if (currentSite?.id !== FALLBACK_DEMO_SITE.id) {
      console.log('🔄 Fixing demo site ID:', currentSite?.id, '→', FALLBACK_DEMO_SITE.id)
      setCurrentSite(FALLBACK_DEMO_SITE)
    }

    return (
      <div className="has-demo-banner" style={{ '--banner-height': '40px' } as any}>
        {/* Demo Banner */}
        <div className="fixed top-0 left-0 right-0 h-10 z-[60] bg-emerald-500 text-white py-2 px-4 text-center text-sm font-semibold flex items-center justify-center">
          <span>🎮 Demo Mode - Explore freely! Data saves to demo database.</span>
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
      </div>
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
