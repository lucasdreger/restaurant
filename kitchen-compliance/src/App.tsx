import { useState, useEffect, lazy, Suspense, startTransition } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useAppStore } from '@/store/useAppStore'
import type { VoiceProvider } from '@/store/useAppStore'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { MainLayout } from '@/components/layout/MainLayout'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { useAuth } from '@/components/auth/auth-context'
import { useCurrentSite } from '@/hooks/queries/useCurrentSite'
import { useSiteSettings } from '@/hooks/queries/useSiteSettings'
import { useKiosk } from '@/hooks/useKiosk'
import { useRealtimeSync, type RealtimeChannelStatus } from '@/hooks/useRealtimeSync'
import { PinPad } from '@/components/auth/PinPad'

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

// Landing should be immediate (first paint). Keep onboarding lazy.
import { LandingPage } from '@/components/landing/LandingPage'
const OnboardingQuestionnaire = lazy(() => import('@/components/onboarding/OnboardingQuestionnaire').then(m => ({ default: m.OnboardingQuestionnaire })))

// Create a client
import { queryClient } from '@/lib/queryClient'

type Screen = 'home' | 'history' | 'settings' | 'compliance' | 'reports' | 'venues' | 'menu_engineering' | 'goods_receipt' | 'receipt_history'

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
  const { currentSite, settings, setCurrentSite, updateSettings, setIsOnline } = useAppStore()
  const { user, authState, showLanding, setShowLanding, handleDemoStart, handleExitDemo, handleOnboardingComplete } = useAuth()

  // Data Loading (React Query)
  const { data: siteData } = useCurrentSite()
  const { data: settingsData } = useSiteSettings(siteData?.id)
  const realtimeSync = useRealtimeSync({ siteId: siteData?.id ?? currentSite?.id, userId: user?.id })

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
    const themeClass = `theme-${settings.theme}`
    document.documentElement.classList.remove('theme-day', 'theme-night')
    document.documentElement.classList.add(themeClass)
  }, [settings.theme])

  // Custom hooks
  const { showPinPad, handlePinSubmit, pinError, pinLoading } = useKiosk(currentSite, authState === 'authenticated' || authState === 'demo')

  // Handle navigation with startTransition for smooth updates
  const handleNavigate = (screen: string) => {
    startTransition(() => {
      setCurrentScreen(screen as Screen)
    })
  }

  // Toast styles based on theme
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
      return renderScreenContent()
    }
    return (
      <MainLayout currentScreen={currentScreen} onNavigate={handleNavigate}>
        {renderScreenContent()}
      </MainLayout>
    )
  }

  // Kiosk PIN Overlay
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
            <button onClick={handleExitDemo} className="text-muted-foreground hover:text-foreground text-sm">
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
        {realtimeDebugBanner}
      </div>
    )
  }

  // If we are signing in / restoring a session, don't keep the user stuck on Landing.
  // Landing is fine while we don't have a user yet; once user exists, show the loader.
  if (authState === 'loading' && user) {
    return (
      <>
        <LoadingScreen />
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
        <Suspense fallback={<LoadingScreen />}>
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
