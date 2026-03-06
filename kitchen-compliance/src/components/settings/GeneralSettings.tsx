import { useState, useEffect } from 'react'
import { Building2, RotateCcw, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAppStore } from '@/store/useAppStore'

export function GeneralSettings() {
    const { venueCache, setVenueCache } = useAppStore()

    // Venue State
    const [venue, setVenue] = useState<{ id: string; name: string } | null>(venueCache)
    const [venueLoading, setVenueLoading] = useState(!venueCache) // Only loading if not cached
    const [venueName, setVenueName] = useState(venueCache?.name || '')
    const [savingVenue, setSavingVenue] = useState(false)

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

    const handleSaveVenueName = async () => {
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
    }

    const handleResetData = () => {
        if (confirm('Are you sure you want to reset all local data? This cannot be undone.')) {
            localStorage.removeItem('kitchen-compliance-storage')
            window.location.reload()
        }
    }

    return (
        <div className="space-y-6 animate-slide-in">
            <div className="card-stunning p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Restaurant Details</h2>
                        <p className="text-sm text-theme-secondary">Configure your venue information.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold uppercase text-theme-secondary">Restaurant Name</label>
                        {venueLoading ? (
                            <div className="flex items-center gap-2 h-[56px] px-4 bg-theme-ghost rounded-xl">
                                <Loader2 className="w-5 h-5 animate-spin text-theme-secondary" />
                                <span className="text-theme-secondary">Loading...</span>
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
                                        onClick={handleSaveVenueName}
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
                        <p className="text-xs text-theme-secondary">This name appears in the header and reports.</p>
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
                        <p className="text-sm text-theme-secondary">Clear local data and start fresh.</p>
                    </div>
                </div>

                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-4">
                    <p className="text-sm text-red-600 mb-2">⚠️ Warning: This will clear all local data including:</p>
                    <ul className="text-xs text-theme-secondary space-y-1 ml-4 list-disc">
                        <li>Cooling sessions</li>
                        <li>Food presets usage counts</li>
                        <li>Settings (API keys will be cleared)</li>
                        <li>Offline queue</li>
                    </ul>
                </div>

                <button
                    onClick={handleResetData}
                    className="btn-stunning bg-red-500 hover:bg-red-600 text-white px-6"
                >
                    <RotateCcw className="w-4 h-4" />
                </button>
            </div>


        </div>
    )
}
