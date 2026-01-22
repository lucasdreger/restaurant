import { X, Loader2, Mail } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Provider } from '@supabase/supabase-js'

interface SignInModalProps {
  isOpen: boolean
  onClose: () => void
}

// Provider configurations with icons and colors
const PROVIDER_CONFIG: Record<string, { name: string; icon: React.ReactNode; color: string }> = {
  google: {
    name: 'Google',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
    color: 'bg-white text-gray-800 border-gray-200'
  },
  github: {
    name: 'GitHub',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
    color: 'bg-gray-900 text-white border-gray-700'
  },
  azure: {
    name: 'Microsoft',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 23 23">
        <path fill="#f25022" d="M0 0h11v11H0z"/>
        <path fill="#00a4ef" d="M12 0h11v11H12z"/>
        <path fill="#7fba00" d="M0 12h11v11H0z"/>
        <path fill="#ffb900" d="M12 12h11v11H12z"/>
      </svg>
    ),
    color: 'bg-white text-gray-800 border-gray-200'
  },
  apple: {
    name: 'Apple',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
    ),
    color: 'bg-black text-white border-gray-800'
  },
  facebook: {
    name: 'Facebook',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    color: 'bg-[#1877F2] text-white border-[#1877F2]'
  },
  twitter: {
    name: 'Twitter',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    color: 'bg-black text-white border-gray-800'
  },
  linkedin: {
    name: 'LinkedIn',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    color: 'bg-[#0A66C2] text-white border-[#0A66C2]'
  }
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [availableProviders, setAvailableProviders] = useState<Provider[]>([])
  const [showEmailSignIn, setShowEmailSignIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Detect available OAuth providers from Supabase configuration
  useEffect(() => {
    if (!isOpen || !isSupabaseConfigured()) return

    const detectProviders = async () => {
      // Check environment or just show the most common ones
      const configuredProviders = ['google'] // Default to Google
      
      // You can extend this by checking process.env or making an API call
      setAvailableProviders(configuredProviders as Provider[])
    }

    detectProviders()
  }, [isOpen])

  const handleOAuthSignIn = async (provider: Provider) => {
    if (!isSupabaseConfigured()) {
      toast.error('Authentication not configured')
      return
    }

    setIsLoading(provider)
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}`,
        },
      })

      if (error) throw error
      
      // Modal will stay open during redirect
      // Auth state change will be handled by App.tsx after redirect
    } catch (error) {
      console.error(`${provider} sign-in error:`, error)
      toast.error(`Failed to sign in with ${PROVIDER_CONFIG[provider]?.name || provider}`)
      setIsLoading(null)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isSupabaseConfigured()) {
      toast.error('Authentication not configured')
      return
    }

    setIsLoading('email')
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      
      // Close modal - auth state change will be handled by App.tsx
      onClose()
      toast.success('Signed in successfully!')
    } catch (error: any) {
      console.error('Email sign-in error:', error)
      toast.error(error.message || 'Failed to sign in')
      setIsLoading(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors z-10"
          disabled={isLoading !== null}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8">
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Welcome Back</h2>
          <p className="text-slate-400 text-center mb-8">
            Sign in to access your dashboard
          </p>

          {/* OAuth Provider Buttons */}
          <div className="space-y-3">
            {availableProviders.map((provider) => {
              const config = PROVIDER_CONFIG[provider]
              if (!config) return null

              return (
                <button
                  key={provider}
                  onClick={() => handleOAuthSignIn(provider)}
                  disabled={isLoading !== null}
                  className={`w-full px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all border ${config.color} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoading === provider ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      {config.icon}
                      Continue with {config.name}
                    </>
                  )}
                </button>
              )
            })}
          </div>

          {/* Email/Password option */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-900 text-slate-500">Or</span>
              </div>
            </div>

            {!showEmailSignIn ? (
              <button
                onClick={() => setShowEmailSignIn(true)}
                className="mt-6 w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all"
              >
                <Mail className="w-5 h-5" />
                Sign in with Email
              </button>
            ) : (
              <form onSubmit={handleEmailSignIn} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading === 'email'}
                  className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl font-semibold flex items-center justify-center gap-3 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading === 'email' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailSignIn(false)}
                  className="w-full text-sm text-slate-400 hover:text-white transition-colors"
                >
                  ← Back to other options
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <p className="text-xs text-slate-500 text-center mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}
