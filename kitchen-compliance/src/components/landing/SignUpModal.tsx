import { useState } from 'react'
import { X, ArrowRight, ArrowLeft, CheckCircle, Building2, User, CreditCard, Loader2, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { toast } from 'sonner'

interface SignUpModalProps {
  isOpen: boolean
  onClose: () => void
  selectedTier: 'tier1' | 'tier2' | 'tier3'
}

type SignUpStep = 'contact' | 'restaurant' | 'payment' | 'complete'

const TIER_NAMES = {
  tier1: 'Starter',
  tier2: 'Professional',
  tier3: 'Enterprise'
}

const TIER_PRICES = {
  tier1: '€29/month',
  tier2: '€79/month',
  tier3: '€199/month'
}

export function SignUpModal({ isOpen, onClose, selectedTier }: SignUpModalProps) {
  const [step, setStep] = useState<SignUpStep>('contact')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form data
  const [formData, setFormData] = useState({
    // Contact info
    ownerName: '',
    email: '',
    phone: '',
    
    // Restaurant info
    restaurantName: '',
    restaurantType: 'restaurant',
    address: '',
    city: '',
    country: 'Ireland',
    
    // Selected tier
    tier: selectedTier
  })

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('Authentication not configured')
      return
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
        },
      })

      if (error) throw error
      
      // Close modal - auth state change will be handled by App.tsx
      onClose()
    } catch (error) {
      console.error('Google sign-in error:', error)
      toast.error('Failed to sign in with Google')
    }
  }

  // Handle Email Sign-Up (for later implementation)
  const handleEmailSignUp = async () => {
    if (!canProceed() || !isSupabaseConfigured()) return

    setIsSubmitting(true)
    
    try {
      // For now, just use Google OAuth
      // Email/password signup can be added later
      toast.info('Please use Google Sign-In for now')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Validate current step
  const canProceed = () => {
    switch (step) {
      case 'contact':
        return formData.ownerName.trim() && formData.email.trim() && formData.email.includes('@')
      case 'restaurant':
        return formData.restaurantName.trim() && formData.address.trim() && formData.city.trim()
      case 'payment':
        return true // Stripe handles this
      default:
        return false
    }
  }

  // Handle form submission
  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    try {
      // 1. Create customer in Supabase (if configured and table exists)
      if (isSupabaseConfigured()) {
        try {
          const { data: customerData, error: customerError } = await (supabase
            .from('customers') as any)
            .insert({
              owner_name: formData.ownerName,
              email: formData.email,
              phone: formData.phone || null,
              restaurant_name: formData.restaurantName,
              restaurant_type: formData.restaurantType,
              address: formData.address,
              city: formData.city,
              country: formData.country,
              subscription_tier: formData.tier,
              trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
              status: 'trial',
              created_at: new Date().toISOString()
            })
            .select()
            .single()

          if (customerError) {
            // Log but don't fail - table might not exist yet
            console.warn('Customer creation skipped (table may not exist):', customerError.message)
          } else {
            console.log('Customer created:', customerData)
          }
        } catch (dbError) {
          // Database insert failed but we can still continue with demo mode
          console.warn('Database insert failed, continuing in demo mode:', dbError)
        }
      }

      // 2. Send email notification (log for now)
      await sendNotificationEmail()

      // 3. Move to complete step
      setStep('complete')
      toast.success('Account created successfully!')
      
    } catch (error) {
      console.error('Sign up error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Send email notification to admin
  const sendNotificationEmail = async () => {
    // Using Supabase Edge Function or external service
    // For now, log the data - in production, integrate with email service
    console.log('📧 New customer notification:', {
      to: 'info@lucasdreger.com',
      subject: `New Trial Sign Up: ${formData.restaurantName}`,
      body: {
        owner: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        restaurant: formData.restaurantName,
        type: formData.restaurantType,
        location: `${formData.city}, ${formData.country}`,
        tier: TIER_NAMES[formData.tier],
        price: TIER_PRICES[formData.tier]
      }
    })

    // In production, call Supabase Edge Function:
    // await supabase.functions.invoke('send-email', {
    //   body: { ... }
    // })
  }

  const handleNextStep = () => {
    if (step === 'contact') setStep('restaurant')
    else if (step === 'restaurant') setStep('payment')
    else if (step === 'payment') handleSubmit()
  }

  const handlePrevStep = () => {
    if (step === 'restaurant') setStep('contact')
    else if (step === 'payment') setStep('restaurant')
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
      <div className="relative w-full max-w-lg bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Start Your Free Trial</h2>
              <p className="text-sm text-slate-400">
                {TIER_NAMES[selectedTier]} Plan • 30 days free
              </p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-6">
            {['contact', 'restaurant', 'payment', 'complete'].map((s, idx) => (
              <div key={s} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  step === s 
                    ? "bg-emerald-500 text-white" 
                    : ['contact', 'restaurant', 'payment'].indexOf(step) > idx || step === 'complete'
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-slate-800 text-slate-500"
                )}>
                  {['contact', 'restaurant', 'payment'].indexOf(step) > idx || step === 'complete' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                {idx < 3 && (
                  <div className={cn(
                    "w-12 h-1 mx-1 rounded-full transition-all",
                    ['contact', 'restaurant', 'payment'].indexOf(step) > idx || step === 'complete'
                      ? "bg-emerald-500"
                      : "bg-slate-800"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          {/* Step 1: Sign In Options */}
          {step === 'contact' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold text-white mb-4 text-center">
                Get Started
              </h3>

              {/* Google Sign-In Button */}
              <button
                onClick={handleGoogleSignIn}
                className="w-full px-6 py-4 bg-white text-gray-800 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-gray-50 transition-all border border-gray-200"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-slate-900 text-slate-500">Or continue with email</span>
                </div>
              </div>
              
              {/* Email Sign-Up (Coming Soon) */}
              <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl text-center">
                <Mail className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                <p className="text-sm text-slate-400">
                  Email sign-up coming soon
                </p>
              </div>

              <p className="text-xs text-slate-500 text-center mt-4">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          )}

          {/* Step 2: Restaurant Info */}
          {step === 'restaurant' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                Restaurant Details
              </h3>
              
              <div>
                <label className="text-sm text-slate-400 block mb-1.5">Restaurant Name *</label>
                <input
                  type="text"
                  value={formData.restaurantName}
                  onChange={(e) => updateField('restaurantName', e.target.value)}
                  placeholder="The Golden Fork"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 block mb-1.5">Business Type</label>
                <select
                  value={formData.restaurantType}
                  onChange={(e) => updateField('restaurantType', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="restaurant">Restaurant</option>
                  <option value="cafe">Café</option>
                  <option value="hotel">Hotel Kitchen</option>
                  <option value="catering">Catering Company</option>
                  <option value="food_truck">Food Truck</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm text-slate-400 block mb-1.5">Address *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="123 Main Street"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1.5">City *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="Dublin"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1.5">Country</label>
                  <select
                    value={formData.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="Ireland">Ireland</option>
                    <option value="UK">United Kingdom</option>
                    <option value="Germany">Germany</option>
                    <option value="France">France</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Payment Info */}
          {step === 'payment' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Payment Setup
              </h3>
              
              {/* Summary */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300">Plan</span>
                  <span className="font-bold text-white">{TIER_NAMES[selectedTier]}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300">Price</span>
                  <span className="font-bold text-emerald-400">{TIER_PRICES[selectedTier]}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-emerald-500/30">
                  <span className="text-slate-300">Due Today</span>
                  <span className="font-bold text-white">€0.00</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Your card won't be charged until your 30-day trial ends.
                </p>
              </div>

              {/* Stripe Placeholder */}
              <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl text-center">
                <CreditCard className="w-10 h-10 mx-auto mb-3 text-slate-500" />
                <p className="text-slate-400 text-sm">
                  Stripe payment form will be integrated here
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  For demo purposes, click "Complete Setup" to proceed
                </p>
              </div>

              <p className="text-xs text-slate-500 text-center">
                🔒 Secured by Stripe • Cancel anytime during trial
              </p>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && (
            <div className="text-center py-8 animate-fade-in">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Welcome Aboard! 🎉</h3>
              <p className="text-slate-400 mb-6">
                Your {TIER_NAMES[selectedTier]} trial is now active.
                <br />Check your email for login details.
              </p>
              <div className="p-4 bg-slate-800/50 rounded-xl text-left">
                <p className="text-sm text-slate-300 mb-2">
                  <strong>Restaurant:</strong> {formData.restaurantName}
                </p>
                <p className="text-sm text-slate-300">
                  <strong>Trial ends:</strong> {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex items-center justify-between">
          {step !== 'contact' && step !== 'complete' ? (
            <button
              onClick={handlePrevStep}
              className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step !== 'complete' && (
            <button
              onClick={handleNextStep}
              disabled={!canProceed() || isSubmitting}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all",
                canProceed() && !isSubmitting
                  ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-emerald-500/30"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : step === 'payment' ? (
                <>
                  Complete Setup
                  <CheckCircle className="w-4 h-4" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}

          {step === 'complete' && (
            <button
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl font-bold hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
            >
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
