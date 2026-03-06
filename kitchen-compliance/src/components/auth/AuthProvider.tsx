import React, { useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured, DEMO_SITE_ID } from '@/lib/supabase'
import { clearKitchenComplianceAppStorage } from '@/lib/appStorage'
import type { User, Session } from '@supabase/supabase-js'
import { useAppStore } from '@/store/useAppStore'
import type { VoiceProvider } from '@/store/useAppStore'
import { getSiteSettings } from '@/services/settingsService'
import { AuthContext } from './auth-context'

import type { AuthState } from './auth-context'

// Fallback demo site (used when Supabase not available)
const FALLBACK_DEMO_SITE = {
    id: DEMO_SITE_ID,
    name: 'Luma Executive Kitchen',
    address: 'Grand Canal Dock, Dublin 2, Ireland',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [authState, setAuthState] = useState<AuthState>('loading')
    const [user, setUser] = useState<User | null>(null)
    const [showLanding, setShowLanding] = useState(true)

    const { isDemo, setIsDemo, setCurrentSite, settings } = useAppStore()

    // Sync authState to ref for usage in effects
    const authStateRef = useRef(authState)
    const currentAuthUserRef = useRef<string | null>(null)

    useEffect(() => {
        authStateRef.current = authState
    }, [authState])

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
        const { resetDataLoaded, setCurrentSite, updateSettings, setIsDemo } = useAppStore.getState()
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
            const demoEmail = import.meta.env.VITE_DEMO_USER_EMAIL
            const demoPassword = import.meta.env.VITE_DEMO_USER_PASSWORD

            if (demoEmail && demoPassword) {
                // Optional explicit demo auth; if not configured we stay in restricted demo mode.
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email: demoEmail,
                    password: demoPassword,
                })

                if (authError) {
                    console.warn('⚠️ Demo authentication failed, proceeding with restricted demo mode:', authError.message)
                } else {
                    console.log('✅ Demo user authenticated:', authData.user?.email)
                }
            } else {
                console.warn('Demo credentials are not configured; using restricted demo mode')
            }

            // Small delay to ensure session/headers are ready if login succeeded
            await new Promise(resolve => setTimeout(resolve, 300))

            try {
                // Fetch data from Supabase for the demo site
                const settingsRecord = await getSiteSettings(FALLBACK_DEMO_SITE.id)

                if (settingsRecord) {
                    updateSettings({
                        theme: (settingsRecord.theme as 'day' | 'night') || settings.theme,
                        language: settingsRecord.language || settings.language,
                        voiceProvider: (settingsRecord.voice_provider as VoiceProvider) || settings.voiceProvider,
                        audioModel: (settingsRecord.audio_model as any) || settings.audioModel,
                        ocrProvider: (settingsRecord.ocr_provider as any) || settings.ocrProvider,
                        ocrModel: (settingsRecord.ocr_model as any) || settings.ocrModel,
                        ttsEnabled: settingsRecord.tts_enabled ?? settings.ttsEnabled,
                        wakeWordEnabled: settingsRecord.wake_word_enabled ?? settings.wakeWordEnabled,
                        activeWakeWords: settingsRecord.active_wake_words ?? settings.activeWakeWords,
                    })
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
        setCurrentSite(null)
        setShowLanding(true)
    }

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

        const PROFILE_CHECK_TIMEOUT_MS = 8000
        // Track if auth check has started
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

                // Bound profile lookup so auth state never hangs forever.
                const profilePromise = supabase
                    .from('profiles')
                    .select('onboarding_completed')
                    .eq('id', session.user.id)
                    .maybeSingle()
                    .then((result) => ({ kind: 'result' as const, result }))

                const timeoutPromise = new Promise<{ kind: 'timeout' }>((resolve) => {
                    setTimeout(() => resolve({ kind: 'timeout' }), PROFILE_CHECK_TIMEOUT_MS)
                })

                const raced = await Promise.race([profilePromise, timeoutPromise])

                if (raced.kind === 'timeout') {
                    console.warn(`⚠️ Profile check timed out after ${PROFILE_CHECK_TIMEOUT_MS}ms, continuing as authenticated`)
                    setAuthState('authenticated')
                    setShowLanding(false)
                    useAppStore.getState().unlockKiosk(session.user.id)
                    return
                }

                const profile = raced.result.data as { onboarding_completed?: boolean } | null
                const error = raced.result.error

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
                // Clear only app state; do NOT clear all localStorage.
                clearKitchenComplianceAppStorage()

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
                    if (currentAuthUserRef.current === session.user.id) {
                        console.log('🔄 Initial session already being processed - skipping duplicate check')
                        return
                    }
                    setUser(session.user)
                    await checkProfileAndSetState(session)
                } else {
                    setAuthState('unauthenticated')
                    currentAuthUserRef.current = null
                }
            } catch (err) {
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
                    // Immediately leave the landing UI; profile check can take a moment.
                    setShowLanding(false)

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

    return (
        <AuthContext.Provider value={{
            user,
            authState,
            showLanding,
            setShowLanding,
            setAuthState,
            handleDemoStart,
            handleExitDemo,
            handleOnboardingComplete
        }}>
            {children}
        </AuthContext.Provider>
    )
}
