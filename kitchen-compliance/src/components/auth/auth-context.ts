import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type AuthState = 'loading' | 'unauthenticated' | 'authenticated' | 'onboarding' | 'demo'

export interface AuthContextType {
  user: User | null
  authState: AuthState
  showLanding: boolean
  setShowLanding: (show: boolean) => void
  setAuthState: (state: AuthState) => void
  handleDemoStart: () => Promise<void>
  handleExitDemo: () => void
  handleOnboardingComplete: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
