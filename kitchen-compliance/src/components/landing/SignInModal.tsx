import { X, Loader2, Mail } from 'lucide-react'
import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { toast } from 'sonner'

interface SignInModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [showEmailSignIn, setShowEmailSignIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleGoogleSignIn = async () => {
    console.log('🔐 Google Sign-in attempt')
    
    if (!isSupabaseConfigured()) {
      console.error('❌ Supabase not configured')
      toast.error('Authentication not configured')
      return
    }

    setIsLoading('google')
    
    try {
      const redirectUrl = window.location.origin
      console.log('📡 Redirecting to Google OAuth with redirect:', redirectUrl)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        console.error('❌ Google OAuth error:', error)
        throw error
      }
      
      console.log('✅ Google OAuth initiated:', data)
      // Browser will redirect to Google
    } catch (error: any) {
      console.error('❌ Google sign-in failed:', error)
      toast.error(error.message || 'Failed to sign in with Google')
      setIsLoading(null)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isSupabaseConfigured()) {
      toast.error('Authentication not configured')
      return
    }

    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }

    setIsLoading('email')
    
    try {
      console.log('📧 Email sign-in attempt:', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('❌ Email sign-in error:', error)
        throw error
      }
      
      console.log('✅ Email sign-in successful:', data.user?.email)
      toast.success('Signed in successfully!')
      onClose()
    } catch (error: any) {
      console.error('❌ Email sign-in failed:', error)
      toast.error(error.message || 'Failed to sign in')
      setIsLoading(null)
    }
  }

  const handleEmailSignUp = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('Authentication not configured')
      return
    }

    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsLoading('signup')
    
    try {
      console.log('📧 Email sign-up attempt:', email)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })

      if (error) {
        console.error('❌ Sign-up error:', error)
        throw error
      }
      
      console.log('✅ Sign-up successful:', data)
      
      if (data.user && !data.user.confirmed_at) {
        toast.success('Check your email for a confirmation link!')
      } else {
        toast.success('Account created successfully!')
        onClose()
      }
    } catch (error: any) {
      console.error('❌ Sign-up failed:', error)
      toast.error(error.message || 'Failed to create account')
    } finally {
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
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Welcome</h2>
          <p className="text-slate-400 text-center mb-8">
            Sign in to access your dashboard
          </p>

          {/* Google Sign-In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading !== null}
            className="w-full px-6 py-4 bg-white text-gray-800 border border-gray-200 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading === 'google' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Divider */}
          <div className="my-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-900 text-slate-500">Or continue with email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          {!showEmailSignIn ? (
            <button
              onClick={() => setShowEmailSignIn(true)}
              className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all text-white"
            >
              <Mail className="w-5 h-5" />
              Sign in with Email
            </button>
          ) : (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
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
                  autoComplete="current-password"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isLoading !== null}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl font-semibold flex items-center justify-center gap-3 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
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
                  onClick={handleEmailSignUp}
                  disabled={isLoading !== null}
                  className="px-6 py-4 bg-slate-700 rounded-xl font-semibold hover:bg-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
                >
                  {isLoading === 'signup' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Sign Up'
                  )}
                </button>
              </div>
              
              <button
                type="button"
                onClick={() => setShowEmailSignIn(false)}
                className="w-full text-sm text-slate-400 hover:text-white transition-colors"
              >
                ← Back to other options
              </button>
            </form>
          )}

          {/* Footer */}
          <p className="text-xs text-slate-500 text-center mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}
