import { useState } from 'react'
import { ArrowRight, ArrowLeft, CheckCircle, Building2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface OnboardingQuestionnaireProps {
  userId: string
  userEmail: string
  onComplete: () => void
}

type OnboardingStep = 'restaurant' | 'details' | 'team' | 'complete'

export function OnboardingQuestionnaire({ userId, userEmail, onComplete }: OnboardingQuestionnaireProps) {
  const [step, setStep] = useState<OnboardingStep>('restaurant')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form data
  const [formData, setFormData] = useState({
    // Restaurant info
    restaurantName: '',
    restaurantType: 'restaurant',
    address: '',
    city: '',
    country: 'Ireland',
    
    // Business details
    seatingCapacity: '',
    avgDailyCovers: '',
    openingDate: '',
    hasMultipleLocations: false,
    numberOfLocations: '1',
    
    // Team info
    numberOfStaff: '',
    hasKitchenManager: true,
    currentComplianceMethod: 'paper',
    challenges: [] as string[]
  })

  // Available challenges
  const availableChallenges = [
    { id: 'temp_checks', label: 'Forgetting temperature checks', icon: '🌡️' },
    { id: 'lost_paperwork', label: 'Lost or incomplete paperwork', icon: '📋' },
    { id: 'time_consuming', label: 'Time-consuming manual logs', icon: '⏱️' },
    { id: 'inspection_ready', label: 'Missing records during inspections', icon: '🔍' },
    { id: 'staff_training', label: 'Staff training gaps', icon: '👥' },
    { id: 'food_waste', label: 'Food waste tracking', icon: '🗑️' },
    { id: 'supplier_management', label: 'Supplier compliance tracking', icon: '🚚' },
    { id: 'cleaning_schedules', label: 'Cleaning schedule management', icon: '🧹' },
  ]

  const toggleChallenge = (challengeId: string) => {
    setFormData(prev => ({
      ...prev,
      challenges: prev.challenges.includes(challengeId)
        ? prev.challenges.filter(id => id !== challengeId)
        : [...prev.challenges, challengeId]
    }))
  }

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Validate current step
  const canProceed = () => {
    switch (step) {
      case 'restaurant':
        return formData.restaurantName.trim() && formData.address.trim() && formData.city.trim()
      case 'details':
        return formData.seatingCapacity && formData.avgDailyCovers
      case 'team':
        return formData.numberOfStaff && formData.challenges.length > 0
      default:
        return false
    }
  }

  // Handle form submission
  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    try {
      // 1. Create restaurant/venue in Supabase
      const venueData = {
        name: formData.restaurantName,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        venue_type: formData.restaurantType,
        seating_capacity: parseInt(formData.seatingCapacity) || null,
        avg_daily_covers: parseInt(formData.avgDailyCovers) || null,
        number_of_staff: parseInt(formData.numberOfStaff) || null,
        has_kitchen_manager: formData.hasKitchenManager,
        compliance_method: formData.currentComplianceMethod,
        main_pain_point: formData.challenges.join(', '),
        opening_date: formData.openingDate || null,
        created_by: userId
      }

      console.log('Creating venue with data:', venueData)

      const { data: restaurantData, error: restaurantError } = await (supabase
        .from('venues') as any)
        .insert(venueData)
        .select()
        .single()

      if (restaurantError) {
        console.error('Restaurant creation error:', restaurantError)
        console.error('Error details:', JSON.stringify(restaurantError, null, 2))
        toast.error(`Failed to create restaurant: ${restaurantError.message || 'Unknown error'}`)
        setIsSubmitting(false)
        return
      }

      console.log('Restaurant created successfully:', restaurantData)

      // 2. Create user profile if it doesn't exist
      const { error: profileError } = await (supabase
        .from('profiles') as any)
        .upsert({
          id: userId,
          email: userEmail,
          role: 'owner',
          current_venue_id: restaurantData?.id,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })

      if (profileError) {
        console.warn('Profile update warning:', profileError)
      }

      // 3. Link user to venue
      const { error: memberError } = await (supabase
        .from('venue_members') as any)
        .insert({
          venue_id: restaurantData?.id,
          user_id: userId,
          role: 'owner',
          created_at: new Date().toISOString()
        })

      if (memberError) {
        console.warn('Venue member link warning:', memberError)
      }

      // 4. Move to complete step
      setStep('complete')
      toast.success('Restaurant setup complete!')
      
      // Auto-complete after 2 seconds
      setTimeout(() => {
        onComplete()
      }, 2000)
      
    } catch (error) {
      console.error('Onboarding error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNextStep = () => {
    if (step === 'restaurant') setStep('details')
    else if (step === 'details') setStep('team')
    else if (step === 'team') handleSubmit()
  }

  const handlePrevStep = () => {
    if (step === 'details') setStep('restaurant')
    else if (step === 'team') setStep('details')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Welcome! Let's Set Up Your Restaurant</h2>
              <p className="text-sm text-slate-400">
                This will only take 2 minutes
              </p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-6">
            {['restaurant', 'details', 'team', 'complete'].map((s, idx) => (
              <div key={s} className="flex items-center flex-1">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  step === s 
                    ? "bg-emerald-500 text-white" 
                    : ['restaurant', 'details', 'team'].indexOf(step) > idx || step === 'complete'
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-slate-800 text-slate-500"
                )}>
                  {['restaurant', 'details', 'team'].indexOf(step) > idx || step === 'complete' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    idx + 1
                  )}
                </div>
                {idx < 3 && (
                  <div className={cn(
                    "flex-1 h-1 mx-2 rounded-full transition-all",
                    ['restaurant', 'details', 'team'].indexOf(step) > idx || step === 'complete'
                      ? "bg-emerald-500"
                      : "bg-slate-800"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-8">
          {/* Step 1: Restaurant Info */}
          {step === 'restaurant' && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-xl font-semibold text-white mb-6">Tell us about your restaurant</h3>
              
              <div>
                <label className="text-sm text-slate-400 block mb-2">Restaurant Name *</label>
                <input
                  type="text"
                  value={formData.restaurantName}
                  onChange={(e) => updateField('restaurantName', e.target.value)}
                  placeholder="The Golden Fork"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 block mb-2">Business Type</label>
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
                  <option value="bakery">Bakery</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm text-slate-400 block mb-2">Address *</label>
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
                  <label className="text-sm text-slate-400 block mb-2">City *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="Dublin"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Country</label>
                  <select
                    value={formData.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="Ireland">Ireland</option>
                    <option value="UK">United Kingdom</option>
                    <option value="Germany">Germany</option>
                    <option value="France">France</option>
                    <option value="Spain">Spain</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Business Details */}
          {step === 'details' && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-xl font-semibold text-white mb-6">Business Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Seating Capacity *</label>
                  <input
                    type="number"
                    value={formData.seatingCapacity}
                    onChange={(e) => updateField('seatingCapacity', e.target.value)}
                    placeholder="50"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Avg. Daily Covers *</label>
                  <input
                    type="number"
                    value={formData.avgDailyCovers}
                    onChange={(e) => updateField('avgDailyCovers', e.target.value)}
                    placeholder="80"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-slate-400 block mb-2">Opening Date (optional)</label>
                <input
                  type="date"
                  value={formData.openingDate}
                  onChange={(e) => updateField('openingDate', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 block mb-3">Do you have multiple locations?</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => updateField('hasMultipleLocations', false)}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-xl border-2 transition-all",
                      !formData.hasMultipleLocations
                        ? "bg-emerald-500/20 border-emerald-500 text-white"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                    )}
                  >
                    No, single location
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('hasMultipleLocations', true)}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-xl border-2 transition-all",
                      formData.hasMultipleLocations
                        ? "bg-emerald-500/20 border-emerald-500 text-white"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                    )}
                  >
                    Yes, multiple
                  </button>
                </div>
              </div>
              
              {formData.hasMultipleLocations && (
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Number of Locations</label>
                  <input
                    type="number"
                    value={formData.numberOfLocations}
                    onChange={(e) => updateField('numberOfLocations', e.target.value)}
                    placeholder="3"
                    min="2"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Team Info */}
          {step === 'team' && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-xl font-semibold text-white mb-6">Team & Compliance</h3>
              
              <div>
                <label className="text-sm text-slate-400 block mb-2">Number of Kitchen Staff *</label>
                <input
                  type="number"
                  value={formData.numberOfStaff}
                  onChange={(e) => updateField('numberOfStaff', e.target.value)}
                  placeholder="8"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 block mb-3">Do you have a dedicated kitchen manager?</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => updateField('hasKitchenManager', true)}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-xl border-2 transition-all",
                      formData.hasKitchenManager
                        ? "bg-emerald-500/20 border-emerald-500 text-white"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                    )}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('hasKitchenManager', false)}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-xl border-2 transition-all",
                      !formData.hasKitchenManager
                        ? "bg-emerald-500/20 border-emerald-500 text-white"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                    )}
                  >
                    No
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-slate-400 block mb-2">Current Compliance Method</label>
                <select
                  value={formData.currentComplianceMethod}
                  onChange={(e) => updateField('currentComplianceMethod', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="paper">Paper logs</option>
                  <option value="excel">Excel spreadsheets</option>
                  <option value="other_software">Other software</option>
                  <option value="none">No formal system</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm text-slate-400 block mb-3">What are your main compliance challenges? * (Select all that apply)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableChallenges.map((challenge) => (
                    <button
                      key={challenge.id}
                      type="button"
                      onClick={() => toggleChallenge(challenge.id)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                        formData.challenges.includes(challenge.id)
                          ? "bg-emerald-500/20 border-emerald-500 text-white"
                          : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                      )}
                    >
                      <span className="text-2xl">{challenge.icon}</span>
                      <span className="text-sm flex-1">{challenge.label}</span>
                      {formData.challenges.includes(challenge.id) && (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {formData.challenges.length} challenge{formData.challenges.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && (
            <div className="text-center py-12 animate-fade-in">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-emerald-400" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-3">All Set! 🎉</h3>
              <p className="text-slate-400 mb-6 text-lg">
                {formData.restaurantName} is ready to go.
                <br />Let's get you compliant!
              </p>
              <div className="flex items-center justify-center gap-2 text-emerald-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading your dashboard...</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'complete' && (
          <div className="p-6 pt-0 flex items-center justify-between border-t border-slate-800">
            {step !== 'restaurant' ? (
              <button
                onClick={handlePrevStep}
                className="flex items-center gap-2 px-5 py-3 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={handleNextStep}
              disabled={!canProceed() || isSubmitting}
              className={cn(
                "flex items-center gap-2 px-8 py-3 rounded-xl font-semibold transition-all",
                canProceed() && !isSubmitting
                  ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-emerald-500/30"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting up...
                </>
              ) : step === 'team' ? (
                <>
                  Complete Setup
                  <CheckCircle className="w-5 h-5" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
