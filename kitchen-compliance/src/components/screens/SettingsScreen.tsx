import { useState, useEffect } from 'react'
import { ArrowLeft, Check, Users, UtensilsCrossed, Sun, Moon, Palette, CreditCard, Mic, Plus, Trash2, Volume2, ShieldCheck, UserPlus, Coffee, Thermometer, Edit2, X, Building2, RotateCcw, Loader2, Scan, Eye, Cpu, Zap } from 'lucide-react'
import { useAppStore, type AppTheme, WAKE_WORD_OPTIONS, type WakeWordId, type OCRModel } from '@/store/useAppStore'
import { OCR_MODEL_INFO, isProviderAvailable } from '@/services/ocrService'
import { cn } from '@/lib/utils'
import { getStaffMembers, createStaffMember, deleteStaffMember, getFoodPresets, createFoodPreset, deleteFoodPreset, updateSiteSubscription } from '@/services/settingsService'
import { getFridges, createFridge, updateFridge, deleteFridge, FRIDGE_LIMITS, type Fridge } from '@/services/fridgeService'
import type { StaffMember, FoodItem } from '@/types/database.types'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface SettingsScreenProps {
  onBack: () => void
}

type SettingsTab = 'general' | 'appearance' | 'staff' | 'food' | 'voice' | 'ocr' | 'subscription' | 'fridges'

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { 
    settings, 
    updateSettings,
    currentSite,
    venueCache,
    setVenueCache,
    dataLoaded,
    setDataLoaded
  } = useAppStore()
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [loading, setLoading] = useState(false)

  // Venue State - use cache first
  const [venue, setVenue] = useState<{ id: string; name: string } | null>(venueCache)
  const [venueLoading, setVenueLoading] = useState(!venueCache) // Only loading if not cached
  const [venueName, setVenueName] = useState(venueCache?.name || '')
  const [savingVenue, setSavingVenue] = useState(false)

  // Staff State
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffRole, setNewStaffRole] = useState<'manager' | 'chef' | 'staff'>('staff')
  const [newStaffPin, setNewStaffPin] = useState('')

  // Food State
  const [foodList, setFoodList] = useState<FoodItem[]>([])
  const [newFoodName, setNewFoodName] = useState('')
  const [newFoodCategory, setNewFoodCategory] = useState<'sauce' | 'soup' | 'meat' | 'vegetable' | 'other'>('other')

  // Fridge State
  const [fridgeList, setFridgeList] = useState<Fridge[]>([])
  const [newFridgeName, setNewFridgeName] = useState('')
  const [editingFridgeId, setEditingFridgeId] = useState<string | null>(null)
  const [editingFridgeName, setEditingFridgeName] = useState('')

  // Load venue data on mount - only if not cached
  useEffect(() => {
    // If we have cached data, use it immediately
    if (venueCache) {
      setVenue(venueCache)
      setVenueName(venueCache.name)
      setVenueLoading(false)
      return
    }

    const loadVenue = async () => {
      setVenueLoading(true)
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setVenueLoading(false)
          return
        }

        // Get user's profile to find their current_venue_id
        const { data: profile } = await (supabase
          .from('profiles')
          .select('current_venue_id')
          .eq('id', user.id)
          .single() as unknown as { data: { current_venue_id: string | null } | null; error: any })

        if (profile?.current_venue_id) {
          // Get venue data
          const { data: venueData, error } = await (supabase
            .from('venues')
            .select('id, name')
            .eq('id', profile.current_venue_id)
            .single() as unknown as { data: { id: string; name: string } | null; error: any })

          if (venueData && !error) {
            setVenue(venueData)
            setVenueName(venueData.name)
            // Cache the venue data
            setVenueCache({ ...venueData, loadedAt: Date.now() })
          }
        } else {
          // Fallback: try to get any venue created by this user
          const { data: venueData } = await (supabase
            .from('venues')
            .select('id, name')
            .eq('created_by', user.id)
            .limit(1)
            .single() as unknown as { data: { id: string; name: string } | null; error: any })

          if (venueData) {
            setVenue(venueData)
            setVenueName(venueData.name)
            // Cache the venue data
            setVenueCache({ ...venueData, loadedAt: Date.now() })
          }
        }
      } catch (error) {
        console.error('Failed to load venue:', error)
      } finally {
        setVenueLoading(false)
      }
    }

    loadVenue()
  }, [venueCache, setVenueCache])

  // Load Data on Tab Change - only if not already loaded
  useEffect(() => {
    if (activeTab === 'staff' && currentSite?.id && !dataLoaded.staff) {
      loadStaff()
    } else if (activeTab === 'food' && !dataLoaded.food) {
      loadFood()
    } else if (activeTab === 'fridges' && currentSite?.id && !dataLoaded.fridges) {
      loadFridges()
    }
  }, [activeTab, currentSite?.id, dataLoaded])

  // --- Staff Handlers ---
  const loadStaff = async () => {
    if (!currentSite?.id) return
    setLoading(true)
    try {
      const data = await getStaffMembers(currentSite.id)
      setStaffList(data)
      setDataLoaded('staff', true)
    } catch (error) {
      console.error(error)
      toast.error('Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  const handleAddStaff = async () => {
    if (!currentSite?.id) {
      toast.error('Please select a site first')
      return
    }
    if (!newStaffName) return
    
    // Generate initials from name (e.g., "Gui Bender" -> "GB")
    const initials = newStaffName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
    
    try {
      await createStaffMember({
        site_id: currentSite.id,
        name: newStaffName,
        initials: initials,
        role: newStaffRole,
        pin: newStaffPin || null,
        active: true
      })
      toast.success('Staff member added')
      setNewStaffName('')
      setNewStaffPin('')
      loadStaff()
    } catch (error) {
      toast.error('Failed to add staff')
    }
  }

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('Are you sure?')) return
    try {
      await deleteStaffMember(id)
      toast.success('Staff member removed')
      setStaffList(prev => prev.filter(p => p.id !== id))
    } catch (error) {
      toast.error('Failed to remove staff')
    }
  }

  // --- Food Handlers ---
  const loadFood = async () => {
    setLoading(true)
    try {
      const data = await getFoodPresets(currentSite?.id)
      setFoodList(data)
      setDataLoaded('food', true)
    } catch (error) {
      console.error(error)
      toast.error('Failed to load food presets')
    } finally {
      setLoading(false)
    }
  }

  const handleAddFood = async () => {
    if (!newFoodName) return
    try {
      await createFoodPreset({
        site_id: currentSite?.id ?? null, // Explicitly null if undefined
        name: newFoodName,
        category: newFoodCategory
      })
      toast.success('Food preset added')
      setNewFoodName('')
      loadFood()
    } catch (error) {
      toast.error('Failed to add food preset')
    }
  }

  const handleDeleteFood = async (id: string) => {
    try {
      await deleteFoodPreset(id)
      toast.success('Preset removed')
      setFoodList(prev => prev.filter(f => f.id !== id))
    } catch (error) {
      toast.error('Failed to remove preset')
    }
  }

  // --- Fridge Handlers ---
  const loadFridges = async () => {
    if (!currentSite?.id) return
    setLoading(true)
    try {
      const data = await getFridges(currentSite.id)
      setFridgeList(data)
      setDataLoaded('fridges', true)
    } catch (error) {
      console.error(error)
      toast.error('Failed to load fridges')
    } finally {
      setLoading(false)
    }
  }

  const fridgeLimit = FRIDGE_LIMITS[settings.subscriptionTier || 'basic']
  const canAddMoreFridges = fridgeList.length < fridgeLimit

  const handleAddFridge = async () => {
    if (!currentSite?.id) {
      toast.error('Please select a site first')
      return
    }
    if (!newFridgeName.trim()) {
      toast.error('Please enter a fridge name')
      return
    }
    if (!canAddMoreFridges) {
      toast.error(`Upgrade to add more fridges (${settings.subscriptionTier} limit: ${fridgeLimit})`)
      return
    }
    
    try {
      await createFridge(currentSite.id, newFridgeName.trim())
      toast.success('Fridge added')
      setNewFridgeName('')
      loadFridges()
    } catch (error) {
      toast.error('Failed to add fridge')
    }
  }

  const handleUpdateFridgeName = async (fridgeId: string) => {
    if (!editingFridgeName.trim()) {
      setEditingFridgeId(null)
      return
    }
    
    try {
      await updateFridge(fridgeId, { name: editingFridgeName.trim() })
      toast.success('Fridge renamed')
      setEditingFridgeId(null)
      setEditingFridgeName('')
      loadFridges()
    } catch (error) {
      toast.error('Failed to rename fridge')
    }
  }

  const handleDeleteFridge = async (id: string) => {
    if (!confirm('Delete this fridge? Historical temperature logs will be preserved.')) return
    try {
      await deleteFridge(id)
      toast.success('Fridge removed')
      setFridgeList(prev => prev.filter(f => f.id !== id))
    } catch (error) {
      toast.error('Failed to remove fridge')
    }
  }

  const startEditingFridge = (fridge: Fridge) => {
    setEditingFridgeId(fridge.id)
    setEditingFridgeName(fridge.name)
  }

  // --- General Handlers ---
  const handleThemeChange = (theme: AppTheme) => {
    updateSettings({ theme })
    toast.success(`Theme set to ${theme}`)
  }

  const handleSubscriptionChange = async (tier: 'basic' | 'pro' | 'enterprise') => {
    // Update local state
    updateSettings({ subscriptionTier: tier })
    
    // Persist to database
    if (currentSite?.id) {
      try {
        await updateSiteSubscription(currentSite.id, tier)
        toast.success(`Subscription updated to ${tier}`)
      } catch (error) {
        console.error('Failed to update subscription in database:', error)
        toast.error('Failed to save subscription to server')
      }
    } else {
      toast.success(`Subscription updated to ${tier} (local only)`)
    }
  }

  return (
    <div className="min-h-full transition-colors pb-20 lg:pb-6 animate-fade-in text-theme-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-glass-heavy border-b border-theme-primary p-4 md:p-6 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Back button - only show on mobile/tablet */}
              <button 
                onClick={onBack}
                className="lg:hidden p-3 rounded-xl hover:bg-theme-ghost text-theme-secondary hover:text-theme-primary transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-theme-primary to-theme-secondary flex items-center gap-2">
                  Settings
                </h1>
                <p className="text-sm text-theme-muted">Manage your kitchen configuration</p>
              </div>
            </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="md:col-span-1 space-y-2">
          <MenuButton 
            active={activeTab === 'general'} 
            onClick={() => setActiveTab('general')} 
            icon={Building2} 
            label="General" 
          />
          <MenuButton 
            active={activeTab === 'appearance'} 
            onClick={() => setActiveTab('appearance')} 
            icon={Palette} 
            label="Appearance" 
          />
          <MenuButton 
            active={activeTab === 'subscription'} 
            onClick={() => setActiveTab('subscription')} 
            icon={CreditCard} 
            label="Subscription" 
          />
          <MenuButton 
            active={activeTab === 'staff'} 
            onClick={() => setActiveTab('staff')} 
            icon={Users} 
            label="Staff Members" 
          />
          <MenuButton 
            active={activeTab === 'food'} 
            onClick={() => setActiveTab('food')} 
            icon={UtensilsCrossed} 
            label="Food Presets" 
          />
          <MenuButton 
            active={activeTab === 'voice'} 
            onClick={() => setActiveTab('voice')} 
            icon={Mic} 
            label="Voice Control" 
          />
          <MenuButton 
            active={activeTab === 'ocr'} 
            onClick={() => setActiveTab('ocr')} 
            icon={Scan} 
            label="OCR / Vision" 
          />
          <MenuButton 
            active={activeTab === 'fridges'} 
            onClick={() => setActiveTab('fridges')} 
            icon={Thermometer} 
            label="Fridges" 
          />
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-3 space-y-6">

          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-slide-in">
              <div className="card-stunning p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Restaurant Details</h2>
                    <p className="text-sm text-theme-muted">Configure your venue information.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase text-theme-muted">Restaurant Name</label>
                    {venueLoading ? (
                      <div className="flex items-center gap-2 h-[56px] px-4 bg-theme-ghost rounded-xl">
                        <Loader2 className="w-5 h-5 animate-spin text-theme-muted" />
                        <span className="text-theme-muted">Loading...</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={venueName}
                          onChange={(e) => setVenueName(e.target.value)}
                          placeholder="Enter restaurant name"
                          className="input-stunning text-xl font-bold flex-1"
                        />
                        {venue && venueName !== venue.name && (
                          <button
                            onClick={async () => {
                              if (!venue?.id || !venueName.trim()) return
                              setSavingVenue(true)
                              try {
                                const { error } = await (supabase
                                  .from('venues') as any)
                                  .update({ name: venueName.trim(), updated_at: new Date().toISOString() })
                                  .eq('id', venue.id)
                                
                                if (error) throw error
                                setVenue({ ...venue, name: venueName.trim() })
                                // Update cache too
                                setVenueCache({ ...venue, name: venueName.trim(), loadedAt: Date.now() })
                                toast.success('Restaurant name updated!')
                              } catch (err) {
                                console.error('Failed to update venue name:', err)
                                toast.error('Failed to save restaurant name')
                              } finally {
                                setSavingVenue(false)
                              }
                            }}
                            disabled={savingVenue}
                            className="btn-stunning btn-primary px-4"
                          >
                            {savingVenue ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            Save
                          </button>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-theme-muted">This name appears in the header and reports.</p>
                  </div>
                </div>
              </div>

              {/* Reset Data Section */}
              <div className="card-stunning p-6 border-red-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-red-500/10 text-red-600">
                    <RotateCcw className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-red-600">Reset Data</h2>
                    <p className="text-sm text-theme-muted">Clear local data and start fresh.</p>
                  </div>
                </div>

                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-4">
                  <p className="text-sm text-red-600 mb-2">⚠️ Warning: This will clear all local data including:</p>
                  <ul className="text-xs text-theme-muted space-y-1 ml-4 list-disc">
                    <li>Cooling sessions</li>
                    <li>Food presets usage counts</li>
                    <li>Settings (API keys will be cleared)</li>
                    <li>Offline queue</li>
                  </ul>
                </div>

                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to reset all local data? This cannot be undone.')) {
                      localStorage.removeItem('kitchen-compliance-storage')
                      window.location.reload()
                    }
                  }}
                  className="btn-stunning bg-red-500 hover:bg-red-600 text-white px-6"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset All Data
                </button>
              </div>
            </div>
          )}
          
          {/* SUBSCRIPTION TAB */}
          {activeTab === 'subscription' && (
            <div className="space-y-6 animate-slide-in">
              <div className="card-stunning p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Subscription Tier</h2>
                    <p className="text-sm text-theme-muted">Select a plan to unlock advanced features.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {(['basic', 'pro', 'enterprise'] as const).map((tier) => (
                    <div 
                      key={tier}
                      onClick={() => handleSubscriptionChange(tier)}
                      className={cn(
                        "cursor-pointer border-2 rounded-xl p-5 transition-all relative group",
                        settings.subscriptionTier === tier
                          ? "border-sky-500 bg-sky-500/5" 
                          : "border-theme-primary hover:border-theme-secondary"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="capitalize font-bold text-lg mb-1 flex items-center gap-2">
                            {tier}
                            <span className={cn(
                              "license-badge",
                              tier === 'basic' ? 'license-basic' : tier === 'pro' ? 'license-pro' : 'license-enterprise'
                            )}>
                              {tier}
                            </span>
                          </div>
                          {tier === 'basic' && <p className="text-sm text-theme-muted">Core cooling features, single site.</p>}
                          {tier === 'pro' && <p className="text-sm text-theme-muted">Menu Engineering, Multi-user access.</p>}
                          {tier === 'enterprise' && <p className="text-sm text-theme-muted">Multi-site management, API Access, Branding.</p>}
                        </div>
                        {settings.subscriptionTier === tier && (
                          <div className="p-1 bg-sky-500 rounded-full text-white shadow-lg shadow-sky-500/30">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-slide-in">
               <div className="card-stunning p-6">
                <h2 className="text-lg font-bold mb-6">Interface Theme</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleThemeChange('day')}
                    className={cn(
                      "p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all hover:scale-[1.02]",
                      settings.theme === 'day'
                        ? "border-sky-500 bg-sky-500/5 ring-1 ring-sky-500/50" 
                        : "border-theme-primary hover:bg-theme-ghost"
                    )}
                  >
                    <div className="p-4 rounded-full bg-orange-100 text-orange-500">
                      <Sun className="w-8 h-8" />
                    </div>
                    <span className="font-semibold">Light Mode</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange('night')}
                    className={cn(
                      "p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all hover:scale-[1.02]",
                      settings.theme === 'night'
                        ? "border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500/50" 
                        : "border-theme-primary hover:bg-theme-ghost"
                    )}
                  >
                    <div className="p-4 rounded-full bg-indigo-900/50 text-indigo-300">
                      <Moon className="w-8 h-8" />
                    </div>
                    <span className="font-semibold">Dark Mode</span>
                  </button>
                </div>
              </div>
            </div>
          )}

           {/* STAFF TAB */}
           {activeTab === 'staff' && (
                <div className="space-y-6 animate-slide-in">
                    <div className="card-stunning p-6">
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="text-lg font-bold flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-sky-500" />
                            Add Staff Member
                          </h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-theme-ghost p-4 rounded-xl border border-theme-primary/50">
                          <div className="md:col-span-2 space-y-2">
                             <label className="text-xs font-semibold uppercase text-theme-muted">Name</label>
                             <input 
                               value={newStaffName}
                               onChange={e => setNewStaffName(e.target.value)}
                               placeholder="e.g. John Doe"
                               className="input-stunning"
                             />
                          </div>
                          <div className="space-y-2">
                             <label className="text-xs font-semibold uppercase text-theme-muted">Role</label>
                             <select 
                               value={newStaffRole}
                               onChange={e => setNewStaffRole(e.target.value as any)}
                               className="input-stunning"
                             >
                               <option value="staff">Staff</option>
                               <option value="chef">Chef</option>
                               <option value="manager">Manager</option>
                             </select>
                          </div>
                           <button 
                            onClick={handleAddStaff}
                            className="btn-stunning btn-primary h-[46px]"
                           >
                              <Plus className="w-4 h-4" /> Add
                           </button>
                        </div>
                    </div>

                    <div className="card-stunning p-6">
                        <h2 className="text-lg font-bold mb-4">Team Members</h2>
                        {loading && <p className="text-theme-muted">Loading staff...</p>}
                        {!loading && staffList.length === 0 && <p className="text-theme-muted">No staff found.</p>}
                        
                        <div className="space-y-3">
                          {staffList.map(staff => (
                            <div key={staff.id} className="flex items-center justify-between p-4 bg-theme-ghost rounded-xl border border-theme-primary hover:border-theme-secondary transition-colors group">
                               <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                                    staff.role === 'manager' ? "bg-purple-100 text-purple-600" :
                                    staff.role === 'chef' ? "bg-orange-100 text-orange-600" :
                                    "bg-zinc-100 text-zinc-600"
                                  )}>
                                    {staff.name.substring(0,2).toUpperCase()}
                                  </div>
                                  <div>
                                    <h3 className="font-semibold">{staff.name}</h3>
                                    <p className="text-xs text-theme-muted capitalize">{staff.role}</p>
                                  </div>
                               </div>
                               <button 
                                onClick={() => handleDeleteStaff(staff.id)}
                                className="p-2 text-theme-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                            </div>
                          ))}
                        </div>
                    </div>
                </div>
           )}

            {/* FOOD PRESETS TAB */}
            {activeTab === 'food' && (
                <div className="space-y-6 animate-slide-in">
                    <div className="card-stunning p-6">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                           <Coffee className="w-5 h-5 text-emerald-500" />
                           Add Food Preset
                        </h2>
                         <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-theme-ghost p-4 rounded-xl border border-theme-primary/50">
                          <div className="md:col-span-2 space-y-2">
                             <label className="text-xs font-semibold uppercase text-theme-muted">Item Name</label>
                             <input 
                               value={newFoodName}
                               onChange={e => setNewFoodName(e.target.value)}
                               placeholder="e.g. Tomato Soup"
                               className="input-stunning"
                             />
                          </div>
                          <div className="space-y-2">
                             <label className="text-xs font-semibold uppercase text-theme-muted">Category</label>
                             <select 
                               value={newFoodCategory}
                               onChange={e => setNewFoodCategory(e.target.value as any)}
                               className="input-stunning"
                             >
                               <option value="soup">Soup</option>
                               <option value="sauce">Sauce</option>
                               <option value="meat">Meat</option>
                               <option value="vegetable">Vegetable</option>
                               <option value="other">Other</option>
                             </select>
                          </div>
                           <button 
                            onClick={handleAddFood}
                            className="btn-stunning btn-success h-[46px]"
                           >
                              <Plus className="w-4 h-4" /> Add
                           </button>
                        </div>
                    </div>

                    <div className="card-stunning p-6">
                         <h2 className="text-lg font-bold mb-4">Preset Menu Items</h2>
                         {loading && <p className="text-theme-muted">Loading presets...</p>}
                         {!loading && foodList.length === 0 && <p className="text-theme-muted">No presets found.</p>}
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                           {foodList.map(item => (
                             <div key={item.id} className="flex items-center justify-between p-3 bg-theme-ghost rounded-xl border border-theme-primary group">
                                <span className="font-medium">{item.name}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs px-2 py-1 rounded-full bg-theme-card border border-theme-primary capitalize text-theme-muted">
                                    {item.category}
                                  </span>
                                  <button 
                                    onClick={() => handleDeleteFood(item.id)}
                                    className="p-1 text-theme-muted hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                             </div>
                           ))}
                         </div>
                    </div>
                </div>
           )}

           {/* VOICE TAB */}
           {activeTab === 'voice' && (
                <div className="space-y-6 animate-slide-in">
                    <div className="card-stunning p-6">
                        <div className="flex items-center gap-4 mb-8">
                           <div className="p-4 rounded-full bg-rose-500/10 text-rose-500 animate-pulse">
                              <Mic className="w-8 h-8" />
                           </div>
                           <div>
                              <h2 className="text-xl font-bold">Voice Control Settings</h2>
                              <p className="text-theme-muted">Configure speech recognition provider and API keys.</p>
                           </div>
                        </div>

                        {/* Voice Provider Selection */}
                        <div className="space-y-4 mb-8">
                          <h3 className="text-sm font-semibold uppercase text-theme-muted">Speech Recognition Provider</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Browser */}
                            <button
                              onClick={() => updateSettings({ voiceProvider: 'browser' })}
                              className={cn(
                                "p-4 rounded-xl border-2 transition-all text-left",
                                settings.voiceProvider === 'browser'
                                  ? "border-sky-500 bg-sky-500/10"
                                  : "border-theme-primary hover:border-theme-secondary"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Volume2 className="w-5 h-5 text-emerald-500" />
                                <span className="font-semibold">Browser</span>
                                {settings.voiceProvider === 'browser' && (
                                  <Check className="w-4 h-4 text-sky-500 ml-auto" />
                                )}
                              </div>
                              <p className="text-xs text-theme-muted">
                                Free, uses Chrome/Safari built-in speech recognition
                              </p>
                            </button>
                            
                            {/* OpenAI */}
                            <button
                              onClick={() => updateSettings({ voiceProvider: 'openai' })}
                              className={cn(
                                "p-4 rounded-xl border-2 transition-all text-left",
                                settings.voiceProvider === 'openai'
                                  ? "border-sky-500 bg-sky-500/10"
                                  : "border-theme-primary hover:border-theme-secondary"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🤖</span>
                                <span className="font-semibold">OpenAI Whisper</span>
                                {settings.voiceProvider === 'openai' && (
                                  <Check className="w-4 h-4 text-sky-500 ml-auto" />
                                )}
                              </div>
                              <p className="text-xs text-theme-muted">
                                Whisper API - high accuracy, works in noisy environments
                              </p>
                            </button>
                            
                            {/* OpenRouter - Currently limited */}
                            <button
                              onClick={() => updateSettings({ voiceProvider: 'openrouter' })}
                              className={cn(
                                "p-4 rounded-xl border-2 transition-all text-left relative",
                                settings.voiceProvider === 'openrouter'
                                  ? "border-purple-500 bg-purple-500/10"
                                  : "border-theme-primary hover:border-theme-secondary opacity-60"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🔀</span>
                                <span className="font-semibold">OpenRouter</span>
                                <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Beta</span>
                                {settings.voiceProvider === 'openrouter' && (
                                  <Check className="w-4 h-4 text-purple-500 ml-auto" />
                                )}
                              </div>
                              <p className="text-xs text-theme-muted">
                                GPT Audio models - requires streaming (experimental)
                              </p>
                            </button>
                          </div>
                        </div>

                        {/* Audio Model Selection (only for OpenRouter) */}
                        {settings.voiceProvider === 'openrouter' && (
                          <div className="space-y-4 mb-8">
                            <h3 className="text-sm font-semibold uppercase text-theme-muted">Audio Model</h3>
                            <div className="grid grid-cols-1 gap-2">
                              {([
                                { id: 'openai/gpt-audio-mini', name: 'GPT Audio Mini', price: '$0.60/M tokens', badge: 'Best Value' },
                                { id: 'openai/gpt-audio', name: 'GPT Audio', price: '$32/M tokens', badge: null },
                                { id: 'openai/gpt-4o-audio-preview', name: 'GPT-4o Audio', price: '$40/M tokens', badge: 'Highest Quality' },
                              ] as const).map((model) => (
                                <button
                                  key={model.id}
                                  onClick={() => updateSettings({ audioModel: model.id })}
                                  className={cn(
                                    "p-3 rounded-xl border-2 transition-all text-left flex items-center justify-between",
                                    settings.audioModel === model.id
                                      ? "border-purple-500 bg-purple-500/10"
                                      : "border-theme-primary hover:border-theme-secondary"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="font-medium">{model.name}</span>
                                    {model.badge && (
                                      <span className={cn(
                                        "text-xs px-2 py-0.5 rounded-full",
                                        model.badge === 'Best Value' 
                                          ? "bg-emerald-100 text-emerald-700" 
                                          : "bg-purple-100 text-purple-700"
                                      )}>
                                        {model.badge}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-theme-muted">{model.price}</span>
                                    {settings.audioModel === model.id && (
                                      <Check className="w-4 h-4 text-purple-500" />
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* API Keys Section */}
                        <div className="space-y-4 mb-8">
                          <h3 className="text-sm font-semibold uppercase text-theme-muted">API Keys</h3>
                          
                          {/* OpenAI API Key */}
                          <div className={cn(
                            "p-4 rounded-xl border transition-all",
                            settings.voiceProvider === 'openai' 
                              ? "border-sky-500/50 bg-sky-500/5" 
                              : "border-theme-primary bg-theme-ghost"
                          )}>
                            <div className="flex items-center justify-between mb-3">
                              <label className="text-sm font-medium flex items-center gap-2">
                                <span className="text-lg">🤖</span>
                                OpenAI API Key
                                {settings.voiceProvider === 'openai' && (
                                  <span className="text-xs px-2 py-0.5 bg-sky-500/20 text-sky-600 rounded-full">Active</span>
                                )}
                              </label>
                              {settings.openaiApiKey && (
                                <span className="text-xs text-emerald-500 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Configured
                                </span>
                              )}
                            </div>
                            <input
                              type="password"
                              value={settings.openaiApiKey || ''}
                              onChange={(e) => updateSettings({ openaiApiKey: e.target.value || null })}
                              placeholder="sk-..."
                              className="input-stunning font-mono text-sm"
                            />
                            <p className="text-xs text-theme-muted mt-2">
                              Get your key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">platform.openai.com/api-keys</a>
                            </p>
                          </div>

                          {/* OpenRouter API Key */}
                          <div className={cn(
                            "p-4 rounded-xl border transition-all",
                            settings.voiceProvider === 'openrouter' 
                              ? "border-purple-500/50 bg-purple-500/5" 
                              : "border-theme-primary bg-theme-ghost"
                          )}>
                            <div className="flex items-center justify-between mb-3">
                              <label className="text-sm font-medium flex items-center gap-2">
                                <span className="text-lg">🔀</span>
                                OpenRouter API Key
                                {settings.voiceProvider === 'openrouter' && (
                                  <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-600 rounded-full">Active for Voice</span>
                                )}
                              </label>
                              {settings.openrouterApiKey && (
                                <span className="text-xs text-emerald-500 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Configured
                                </span>
                              )}
                            </div>
                            <input
                              type="password"
                              value={settings.openrouterApiKey || ''}
                              onChange={(e) => updateSettings({ openrouterApiKey: e.target.value || null })}
                              placeholder="sk-or-..."
                              className="input-stunning font-mono text-sm"
                            />
                            <p className="text-xs text-theme-muted mt-2">
                              Get your key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline">openrouter.ai/keys</a>
                            </p>
                          </div>
                        </div>

                        {/* Other Voice Settings */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold uppercase text-theme-muted">Other Settings</h3>
                          
                          <div 
                            onClick={() => updateSettings({ ttsEnabled: !settings.ttsEnabled })}
                            className="flex items-center justify-between p-4 bg-theme-ghost rounded-xl cursor-pointer hover:bg-theme-hover transition-colors"
                          >
                              <div className="flex items-center gap-3">
                                 <Volume2 className="text-theme-secondary" />
                                 <div>
                                   <p className="font-medium">Text-to-Speech Feedback</p>
                                   <p className="text-xs text-theme-muted">Read back confirmations aloud</p>
                                 </div>
                              </div>
                              <div className={cn(
                                "h-6 w-11 rounded-full relative transition-colors",
                                settings.ttsEnabled ? "bg-green-500" : "bg-theme-input border border-theme-primary"
                              )}>
                                 <div className={cn(
                                   "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                                   settings.ttsEnabled ? "right-1" : "left-1"
                                 )} />
                              </div>
                           </div>

                           <div 
                             onClick={() => updateSettings({ wakeWordEnabled: !settings.wakeWordEnabled })}
                             className="flex items-center justify-between p-4 bg-theme-ghost rounded-xl cursor-pointer hover:bg-theme-hover transition-colors"
                           >
                              <div className="flex items-center gap-3">
                                 <Mic className={cn(
                                   "transition-colors",
                                   settings.wakeWordEnabled ? "text-rose-500 animate-pulse" : "text-theme-secondary"
                                 )} />
                                 <div>
                                   <p className="font-medium">Always Listening (Kiosk Mode)</p>
                                   <p className="text-xs text-theme-muted">
                                     Say wake word to activate voice commands
                                   </p>
                                 </div>
                              </div>
                              <div className={cn(
                                "h-6 w-11 rounded-full relative transition-colors",
                                settings.wakeWordEnabled ? "bg-rose-500" : "bg-theme-input border border-theme-primary"
                              )}>
                                 <div className={cn(
                                   "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                                   settings.wakeWordEnabled ? "right-1" : "left-1"
                                 )} />
                              </div>
                           </div>

                           {/* Wake Word Selection */}
                           {settings.wakeWordEnabled && (
                             <div className="p-4 bg-theme-ghost rounded-xl border border-rose-500/30 space-y-3">
                               <div className="flex items-center gap-2 mb-2">
                                 <span className="text-sm font-semibold text-rose-400">Wake Words</span>
                                 <span className="text-xs text-theme-muted">(select one or more)</span>
                               </div>
                               <div className="grid grid-cols-2 gap-2">
                                 {WAKE_WORD_OPTIONS.map((option) => {
                                   const isActive = settings.activeWakeWords?.includes(option.id) ?? false
                                   return (
                                     <button
                                       key={option.id}
                                       onClick={() => {
                                         const current = settings.activeWakeWords || ['luma']
                                         let updated: WakeWordId[]
                                         if (isActive && current.length > 1) {
                                           // Remove (but keep at least one)
                                           updated = current.filter(id => id !== option.id)
                                         } else if (!isActive) {
                                           // Add
                                           updated = [...current, option.id]
                                         } else {
                                           // Can't remove the last one
                                           return
                                         }
                                         updateSettings({ activeWakeWords: updated })
                                       }}
                                       className={cn(
                                         "p-3 rounded-xl border-2 transition-all text-left",
                                         isActive
                                           ? "border-rose-500 bg-rose-500/10"
                                           : "border-theme-primary hover:border-theme-secondary opacity-60"
                                       )}
                                     >
                                       <div className="flex items-center justify-between">
                                         <div>
                                           <span className="font-semibold">{option.label}</span>
                                           <p className="text-xs text-theme-muted mt-0.5">
                                             "Hey {option.label}", "OK {option.label}"
                                           </p>
                                         </div>
                                         {isActive && (
                                           <Check className="w-4 h-4 text-rose-500" />
                                         )}
                                       </div>
                                     </button>
                                   )
                                 })}
                               </div>
                               <p className="text-xs text-theme-muted mt-2">
                                 💡 Tip: You can enable multiple wake words for flexibility
                               </p>
                             </div>
                           )}
                        </div>
                    </div>
                </div>
           )}

           {/* OCR TAB */}
           {activeTab === 'ocr' && (
                <div className="space-y-6 animate-slide-in">
                    <div className="card-stunning p-6">
                        <div className="flex items-center gap-4 mb-8">
                           <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-500">
                              <Eye className="w-8 h-8" />
                           </div>
                           <div>
                              <h2 className="text-xl font-bold">OCR / Vision Settings</h2>
                              <p className="text-theme-muted">Configure invoice scanning and document recognition.</p>
                           </div>
                        </div>

                        {/* OCR Provider Selection */}
                        <div className="space-y-4 mb-8">
                          <h3 className="text-sm font-semibold uppercase text-theme-muted">OCR Provider</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Tesseract (Free) */}
                            <button
                              onClick={() => updateSettings({ ocrProvider: 'tesseract', ocrModel: 'tesseract' })}
                              className={cn(
                                "p-4 rounded-xl border-2 transition-all text-left",
                                settings.ocrProvider === 'tesseract'
                                  ? "border-emerald-500 bg-emerald-500/10"
                                  : "border-theme-primary hover:border-theme-secondary"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Cpu className="w-5 h-5 text-emerald-500" />
                                <span className="font-semibold">Tesseract.js</span>
                                <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">Free</span>
                                {settings.ocrProvider === 'tesseract' && (
                                  <Check className="w-4 h-4 text-emerald-500 ml-auto" />
                                )}
                              </div>
                              <p className="text-xs text-theme-muted">
                                Free local OCR, no API key needed. Good for clear documents.
                              </p>
                            </button>
                            
                            {/* OpenAI */}
                            <button
                              onClick={() => updateSettings({ ocrProvider: 'openai', ocrModel: 'openai/gpt-4o' })}
                              className={cn(
                                "p-4 rounded-xl border-2 transition-all text-left",
                                settings.ocrProvider === 'openai'
                                  ? "border-sky-500 bg-sky-500/10"
                                  : "border-theme-primary hover:border-theme-secondary"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🤖</span>
                                <span className="font-semibold">OpenAI</span>
                                {settings.ocrProvider === 'openai' && (
                                  <Check className="w-4 h-4 text-sky-500 ml-auto" />
                                )}
                              </div>
                              <p className="text-xs text-theme-muted">
                                GPT-4o Vision - excellent accuracy for invoices & handwriting.
                              </p>
                            </button>
                            
                            {/* OpenRouter */}
                            <button
                              onClick={() => updateSettings({ ocrProvider: 'openrouter', ocrModel: 'google/gemini-2.0-flash' })}
                              className={cn(
                                "p-4 rounded-xl border-2 transition-all text-left",
                                settings.ocrProvider === 'openrouter'
                                  ? "border-purple-500 bg-purple-500/10"
                                  : "border-theme-primary hover:border-theme-secondary"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🔀</span>
                                <span className="font-semibold">OpenRouter</span>
                                {settings.ocrProvider === 'openrouter' && (
                                  <Check className="w-4 h-4 text-purple-500 ml-auto" />
                                )}
                              </div>
                              <p className="text-xs text-theme-muted">
                                Access Claude, Gemini, GPT-4o via single API. Best value.
                              </p>
                            </button>
                          </div>
                        </div>

                        {/* Model Selection (for OpenAI / OpenRouter) */}
                        {settings.ocrProvider !== 'tesseract' && (
                          <div className="space-y-4 mb-8">
                            <h3 className="text-sm font-semibold uppercase text-theme-muted">Vision Model</h3>
                            <div className="grid grid-cols-1 gap-2">
                              {(Object.entries(OCR_MODEL_INFO) as [OCRModel, typeof OCR_MODEL_INFO[OCRModel]][])
                                .filter(([_, info]) => info.provider === settings.ocrProvider)
                                .map(([modelId, info]) => (
                                  <button
                                    key={modelId}
                                    onClick={() => updateSettings({ ocrModel: modelId })}
                                    className={cn(
                                      "p-3 rounded-xl border-2 transition-all text-left flex items-center justify-between",
                                      settings.ocrModel === modelId
                                        ? settings.ocrProvider === 'openai' 
                                          ? "border-sky-500 bg-sky-500/10"
                                          : "border-purple-500 bg-purple-500/10"
                                        : "border-theme-primary hover:border-theme-secondary"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="font-medium">{info.name}</span>
                                      {info.badge && (
                                        <span className={cn(
                                          "text-xs px-2 py-0.5 rounded-full",
                                          info.badge === 'Free' ? "bg-emerald-100 text-emerald-700" :
                                          info.badge === 'Best' ? "bg-purple-100 text-purple-700" :
                                          info.badge === 'Value' ? "bg-sky-100 text-sky-700" :
                                          info.badge === 'Cheap' ? "bg-amber-100 text-amber-700" :
                                          info.badge === 'Fast' ? "bg-orange-100 text-orange-700" :
                                          "bg-zinc-100 text-zinc-700"
                                        )}>
                                          {info.badge}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-theme-muted">{info.price}</span>
                                      {settings.ocrModel === modelId && (
                                        <Check className={cn(
                                          "w-4 h-4",
                                          settings.ocrProvider === 'openai' ? "text-sky-500" : "text-purple-500"
                                        )} />
                                      )}
                                    </div>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* API Key Status */}
                        {settings.ocrProvider !== 'tesseract' && (
                          <div className="space-y-4 mb-8">
                            <h3 className="text-sm font-semibold uppercase text-theme-muted">API Key Status</h3>
                            
                            {settings.ocrProvider === 'openai' && (
                              <div className={cn(
                                "p-4 rounded-xl border",
                                settings.openaiApiKey 
                                  ? "border-emerald-500/50 bg-emerald-500/5" 
                                  : "border-amber-500/50 bg-amber-500/5"
                              )}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">🤖</span>
                                    <span className="font-medium">OpenAI API Key</span>
                                  </div>
                                  {settings.openaiApiKey ? (
                                    <span className="text-xs text-emerald-500 flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Configured
                                    </span>
                                  ) : (
                                    <span className="text-xs text-amber-500">Not configured</span>
                                  )}
                                </div>
                                {!settings.openaiApiKey && (
                                  <p className="text-xs text-theme-muted mt-2">
                                    Add your API key in the <button onClick={() => setActiveTab('voice')} className="text-sky-500 underline">Voice Control</button> tab.
                                  </p>
                                )}
                              </div>
                            )}
                            
                            {settings.ocrProvider === 'openrouter' && (
                              <div className={cn(
                                "p-4 rounded-xl border",
                                settings.openrouterApiKey 
                                  ? "border-emerald-500/50 bg-emerald-500/5" 
                                  : "border-amber-500/50 bg-amber-500/5"
                              )}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">🔀</span>
                                    <span className="font-medium">OpenRouter API Key</span>
                                  </div>
                                  {settings.openrouterApiKey ? (
                                    <span className="text-xs text-emerald-500 flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Configured
                                    </span>
                                  ) : (
                                    <span className="text-xs text-amber-500">Not configured</span>
                                  )}
                                </div>
                                {!settings.openrouterApiKey && (
                                  <p className="text-xs text-theme-muted mt-2">
                                    Add your API key in the <button onClick={() => setActiveTab('voice')} className="text-sky-500 underline">Voice Control</button> tab.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Current Configuration Summary */}
                        <div className="p-4 rounded-xl bg-theme-ghost border border-theme-primary">
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            Current OCR Configuration
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-theme-muted">Provider:</span>
                              <span className="font-medium">
                                {settings.ocrProvider === 'tesseract' ? 'Tesseract.js (Free)' : 
                                 settings.ocrProvider === 'openai' ? 'OpenAI' : 'OpenRouter'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-theme-muted">Model:</span>
                              <span className="font-medium">{OCR_MODEL_INFO[settings.ocrModel]?.name || settings.ocrModel}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-theme-muted">Price:</span>
                              <span className={cn(
                                "font-medium",
                                settings.ocrProvider === 'tesseract' ? "text-emerald-500" : "text-theme-primary"
                              )}>
                                {OCR_MODEL_INFO[settings.ocrModel]?.price || 'Unknown'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-theme-muted">Status:</span>
                              {isProviderAvailable(settings.ocrProvider, { 
                                openaiApiKey: settings.openaiApiKey, 
                                openrouterApiKey: settings.openrouterApiKey 
                              }) ? (
                                <span className="text-emerald-500 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Ready
                                </span>
                              ) : (
                                <span className="text-amber-500">API key needed</span>
                              )}
                            </div>
                          </div>
                        </div>
                    </div>
                </div>
           )}

           {/* FRIDGES TAB */}
           {activeTab === 'fridges' && (
                <div className="space-y-6 animate-slide-in">
                    <div className="card-stunning p-6">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-600">
                              <Thermometer className="w-6 h-6" />
                            </div>
                            <div>
                              <h2 className="text-lg font-bold">Fridge Management</h2>
                              <p className="text-sm text-theme-muted">
                                {fridgeList.length} / {fridgeLimit === Infinity ? '∞' : fridgeLimit} fridges
                                <span className={cn(
                                  "ml-2 text-xs px-2 py-0.5 rounded-full",
                                  settings.subscriptionTier === 'basic' ? "bg-zinc-100 text-zinc-600" :
                                  settings.subscriptionTier === 'pro' ? "bg-purple-100 text-purple-600" :
                                  "bg-amber-100 text-amber-600"
                                )}>
                                  {settings.subscriptionTier || 'basic'}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Add New Fridge */}
                        <div className="bg-theme-ghost p-4 rounded-xl border border-theme-primary/50 mb-6">
                          <div className="flex gap-3">
                            <input 
                              value={newFridgeName}
                              onChange={e => setNewFridgeName(e.target.value)}
                              placeholder="New fridge name (e.g., Walk-in Cooler)"
                              className="input-stunning flex-1"
                              onKeyDown={e => e.key === 'Enter' && handleAddFridge()}
                              disabled={!canAddMoreFridges}
                            />
                            <button 
                              onClick={handleAddFridge}
                              disabled={!canAddMoreFridges}
                              className={cn(
                                "btn-stunning px-6",
                                canAddMoreFridges ? "btn-primary" : "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <Plus className="w-4 h-4" /> Add
                            </button>
                          </div>
                          {!canAddMoreFridges && (
                            <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Upgrade your subscription to add more fridges
                            </p>
                          )}
                        </div>

                        {/* Fridge List */}
                        {loading && <p className="text-theme-muted">Loading fridges...</p>}
                        {!loading && fridgeList.length === 0 && (
                          <div className="text-center py-8 text-theme-muted">
                            <Thermometer className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No fridges configured yet</p>
                            <p className="text-sm">Add your first fridge above</p>
                          </div>
                        )}
                        
                        <div className="space-y-3">
                          {fridgeList.map((fridge, index) => (
                            <div 
                              key={fridge.id} 
                              className="flex items-center justify-between p-4 bg-theme-ghost rounded-xl border border-theme-primary hover:border-cyan-500/50 transition-colors group"
                            >
                               <div className="flex items-center gap-4 flex-1">
                                  <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center font-bold text-lg">
                                    {index + 1}
                                  </div>
                                  
                                  {editingFridgeId === fridge.id ? (
                                    <div className="flex items-center gap-2 flex-1">
                                      <input
                                        value={editingFridgeName}
                                        onChange={e => setEditingFridgeName(e.target.value)}
                                        className="input-stunning flex-1"
                                        autoFocus
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') handleUpdateFridgeName(fridge.id)
                                          if (e.key === 'Escape') setEditingFridgeId(null)
                                        }}
                                      />
                                      <button 
                                        onClick={() => handleUpdateFridgeName(fridge.id)}
                                        className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => setEditingFridgeId(null)}
                                        className="p-2 text-theme-muted hover:bg-theme-hover rounded-lg transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex-1">
                                      <h3 className="font-semibold">{fridge.name}</h3>
                                      <p className="text-xs text-theme-muted">
                                        Target: {fridge.min_temp}°C – {fridge.max_temp}°C (FSAI SC1)
                                      </p>
                                    </div>
                                  )}
                               </div>
                               
                               {editingFridgeId !== fridge.id && (
                                 <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button 
                                     onClick={() => startEditingFridge(fridge)}
                                     className="p-2 text-theme-muted hover:text-cyan-500 hover:bg-cyan-50 rounded-lg transition-colors"
                                     title="Rename fridge"
                                   >
                                     <Edit2 className="w-4 h-4" />
                                   </button>
                                   <button 
                                     onClick={() => handleDeleteFridge(fridge.id)}
                                     className="p-2 text-theme-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                     title="Delete fridge"
                                   >
                                     <Trash2 className="w-4 h-4" />
                                   </button>
                                 </div>
                               )}
                            </div>
                          ))}
                        </div>

                        {/* Subscription Upgrade Hint */}
                        {settings.subscriptionTier === 'basic' && (
                          <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20">
                            <p className="text-sm font-medium text-purple-600 mb-1">
                              Need more fridges?
                            </p>
                            <p className="text-xs text-theme-muted">
                              Upgrade to <strong>Pro</strong> for 2 fridges, or <strong>Enterprise</strong> for unlimited fridges.
                            </p>
                            <button 
                              onClick={() => setActiveTab('subscription')}
                              className="mt-3 text-xs px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                            >
                              View Plans
                            </button>
                          </div>
                        )}
                    </div>
                </div>
           )}

        </div>
      </div>
    </div>
  )
}

function MenuButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-medium transition-all duration-200",
        active 
          ? "bg-[var(--inverted-bg)] text-[var(--inverted-text)] shadow-md shadow-black/10 scale-[1.02]" 
          : "text-theme-muted hover:bg-theme-ghost hover:text-theme-primary"
      )}
    >
      <Icon className={cn("w-5 h-5", active ? "text-[var(--inverted-text)]" : "text-theme-muted")} />
      {label}
    </button>
  )
}
