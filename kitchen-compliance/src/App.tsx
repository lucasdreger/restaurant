import { useState, useEffect, lazy, Suspense, startTransition } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useAppStoreShallow } from '@/store/useAppStore'
import type { VoiceProvider } from '@/store/useAppStore'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { MainLayout } from '@/components/layout/MainLayout'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { useAuth } from '@/components/auth/auth-context'
import { useCurrentSite } from '@/hooks/queries/useCurrentSite'
import { useSiteSettings } from '@/hooks/queries/useSiteSettings'
import { useRealtimeSync, type RealtimeChannelStatus } from '@/hooks/useRealtimeSync'

// Keep the auth/landing shell lean; load the dashboard bundle after auth resolves.
const Dashboard = lazy(() => import('@/components/screens/Dashboard').then((m) => ({ default: m.Dashboard })))
const HistoryScreen = lazy(() => import('@/components/screens/HistoryScreen').then((m) => ({ default: m.HistoryScreen })))
const SettingsScreen = lazy(() => import('@/components/screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })))
const ComplianceScreen = lazy(() => import('@/components/screens/ComplianceScreen').then((m) => ({ default: m.ComplianceScreen })))
const ReportsScreen = lazy(() => import('@/components/screens/ReportsScreen').then((m) => ({ default: m.ReportsScreen })))
const VenuesScreen = lazy(() => import('@/components/screens/VenuesScreen').then((m) => ({ default: m.VenuesScreen })))
const MenuEngineeringScreen = lazy(() => import('@/components/menu/MenuEngineeringScreen').then((m) => ({ default: m.MenuEngineeringScreen })))
const GoodsReceiptScreen = lazy(() => import('@/components/receipt/GoodsReceiptScreen').then((m) => ({ default: m.GoodsReceiptScreen })))
const ReceiptHistoryScreen = lazy(() => import('@/components/receipt/ReceiptHistoryScreen').then((m) => ({ default: m.ReceiptHistoryScreen })))

// Landing should be immediate (first paint). Keep onboarding lazy.
import { LandingPage } from '@/components/landing/LandingPage'
const OnboardingQuestionnaire = lazy(() => import('@/components/onboarding/OnboardingQuestionnaire').then(m => ({ default: m.OnboardingQuestionnaire })))

// Create a client
import { queryClient } from '@/lib/queryClient'

type Screen = 'home' | 'history' | 'settings' | 'compliance' | 'reports' | 'venues' | 'menu_engineering' | 'goods_receipt' | 'receipt_history'

const SCREEN_LOADING_LABELS: Record<Screen, string> = {
  home: 'Command Center',
  history: 'Cooling Logs',
  settings: 'Settings',
  compliance: 'FSAI Compliance',
  reports: 'Analytics',
  venues: 'Venues',
  menu_engineering: 'Menu Engineering',
  goods_receipt: 'Goods Receipt',
  receipt_history: 'Receipt History',
}

const preloadSecondaryScreens = () =>
  Promise.allSettled([
    import('@/components/screens/HistoryScreen'),
    import('@/components/screens/SettingsScreen'),
    import('@/components/screens/VenuesScreen'),
  ])

function RealtimeDebugBanner({
  siteStatus,
  userStatus,
}: {
  siteStatus: RealtimeChannelStatus
  userStatus: RealtimeChannelStatus
}) {
  const statusClass = (status: RealtimeChannelStatus) => {
    switch (status) {
      case 'subscribed':
        return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
      case 'connecting':
        return 'bg-amber-500/15 text-amber-600 border-amber-500/30'
      case 'timed_out':
      case 'error':
      case 'closed':
        return 'bg-red-500/15 text-red-600 border-red-500/30'
      default:
        return 'bg-slate-500/15 text-slate-500 border-slate-500/30'
    }
  }

  return (
    <div className="fixed right-3 bottom-3 z-[100] flex items-center gap-2 text-[11px] font-medium pointer-events-none">
      <div className={`px-2 py-1 rounded-md border backdrop-blur-sm ${statusClass(siteStatus)}`}>
        RT Site: {siteStatus}
      </div>
      <div className={`px-2 py-1 rounded-md border backdrop-blur-sm ${statusClass(userStatus)}`}>
        RT User: {userStatus}
      </div>
    </div>
  )
}

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)
  const { currentSite, theme, setCurrentSite, updateSettings, setIsOnline } = useAppStoreShallow((state) => ({
    currentSite: state.currentSite,
    theme: state.settings.theme,
    setCurrentSite: state.setCurrentSite,
    updateSettings: state.updateSettings,
    setIsOnline: state.setIsOnline,
  }))
  const { user, authState, showLanding, setShowLanding, handleDemoStart, handleExitDemo, handleOnboardingComplete } = useAuth()

  // Data Loading (React Query)
  const { data: siteData } = useCurrentSite()
  const { data: settingsData } = useSiteSettings(siteData?.id)
  const realtimeSync = useRealtimeSync({
    siteId: realtimeEnabled ? siteData?.id ?? currentSite?.id : undefined,
    userId: realtimeEnabled ? user?.id : undefined,
  })

  // Sync Site to Store (Legacy Compatibility)
  useEffect(() => {
    if (siteData) {
      // Only update if ID changed to avoid loops if objects are different refs
      if (siteData.id !== currentSite?.id) {
        setCurrentSite(siteData)
      }
    }
  }, [siteData, currentSite?.id, setCurrentSite])

  // Sync Settings to Store
  // NOTE: Do NOT include `settings` in deps — it causes infinite re-render loop
  // since updateSettings changes settings, which would re-trigger this effect.
  useEffect(() => {
    if (settingsData) {
      updateSettings({
        theme: (settingsData.theme as 'day' | 'night') || 'day',
        language: settingsData.language || 'en',
        // Default to OpenAI Realtime when not explicitly set server-side.
        voiceProvider: (settingsData.voice_provider as VoiceProvider) || 'realtime',
        audioModel: (settingsData.audio_model as any) || 'openai/whisper-1',
        ocrProvider: (settingsData.ocr_provider as any) || 'openrouter',
        ocrModel: (settingsData.ocr_model as any) || 'google/gemini-2.0-flash',
        ttsEnabled: settingsData.tts_enabled ?? true,
        wakeWordEnabled: settingsData.wake_word_enabled ?? false,
        activeWakeWords: settingsData.active_wake_words ?? ['luma'],
      })
    }
  }, [settingsData, updateSettings])

  // Monitor Online Status
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

  // Apply theme class
  useEffect(() => {
    const themeClass = `theme-${theme}`
    document.documentElement.classList.remove('theme-day', 'theme-night')
    document.documentElement.classList.add(themeClass)
  }, [theme])

  useEffect(() => {
    if (authState !== 'authenticated' && authState !== 'demo') return
    if (import.meta.env.DEV) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null

    const schedulePreload = () => {
      void preloadSecondaryScreens()
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(schedulePreload, { timeout: 1500 })
    } else {
      timeoutId = setTimeout(schedulePreload, 800)
    }

    return () => {
      if (timeoutId != null) clearTimeout(timeoutId)
      if (idleId != null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
    }
  }, [authState])

  useEffect(() => {
    if (authState !== 'authenticated' && authState !== 'demo') {
      setRealtimeEnabled(false)
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null

    const enableRealtime = () => {
      setRealtimeEnabled(true)
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(enableRealtime, { timeout: 2000 })
    } else {
      timeoutId = setTimeout(enableRealtime, 1200)
    }

    return () => {
      if (timeoutId != null) clearTimeout(timeoutId)
      if (idleId != null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
    }
  }, [authState])

  // Handle navigation with startTransition for smooth updates
  const handleNavigate = (screen: string) => {
    startTransition(() => {
      setCurrentScreen(screen as Screen)
    })
  }

  // Toast styles based on theme
  const toastStyle = theme === 'day'
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

  const realtimeDebugBanner = realtimeSync.debugEnabled ? (
    <RealtimeDebugBanner siteStatus={realtimeSync.siteStatus} userStatus={realtimeSync.userStatus} />
  ) : null

  // Render current screen content
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
        return <Dashboard onNavigate={handleNavigate} currentScreen={currentScreen} />
    }
  }

  // Wrap content in MainLayout for non-home screens
  const renderScreen = () => {
    if (currentScreen === 'home') {
      return (
        <Suspense fallback={<LoadingScreen variant="dashboard" label={currentSite?.name} />}>
          {renderScreenContent()}
        </Suspense>
      )
    }
    return (
      <MainLayout currentScreen={currentScreen} onNavigate={handleNavigate}>
        <Suspense fallback={<LoadingScreen variant="screen" label={SCREEN_LOADING_LABELS[currentScreen]} />}>
          {renderScreenContent()}
        </Suspense>
      </MainLayout>
    )
  }

  // If we are signing in / restoring a session, don't keep the user stuck on Landing.
  // Landing is fine while we don't have a user yet; once user exists, show the loader.
  if (authState === 'loading' && user) {
    return (
      <>
        <LoadingScreen variant="auth" label={currentSite?.name} />
        {realtimeDebugBanner}
      </>
    )
  }

  // Landing Page (unauth or pre-session-check)
  if (showLanding || authState === 'unauthenticated' || authState === 'loading') {
    const shouldShowContinue = authState !== 'unauthenticated' && authState !== 'loading'
    return (
      <>
        <LandingPage
          onSignIn={shouldShowContinue ? () => setShowLanding(false) : undefined}
          onDemoStart={handleDemoStart}
        />
        {realtimeDebugBanner}
        <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
      </>
    )
  }

  // Onboarding
  if (authState === 'onboarding' && user) {
    return (
      <>
        <Suspense fallback={<LoadingScreen variant="onboarding" />}>
          <OnboardingQuestionnaire
            userId={user.id}
            userEmail={user.email || ''}
            onComplete={handleOnboardingComplete}
          />
        </Suspense>
        {realtimeDebugBanner}
        <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
      </>
    )
  }

  // Demo Mode
  if (authState === 'demo') {
    return (
      <div className="has-demo-banner" style={{ '--banner-height': '40px' } as any}>
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
        {realtimeDebugBanner}
        <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
      </div>
    )
  }

  // Authenticated
  return (
    <>
      {renderScreen()}
      {realtimeDebugBanner}
      <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
    </>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary name="Application">
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

export default App
