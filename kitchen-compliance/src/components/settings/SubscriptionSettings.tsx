import { Check, ShieldCheck } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { updateSiteSubscription } from '@/services/settingsService'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function SubscriptionSettings() {
    const { settings, updateSettings, currentSite } = useAppStore()

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
        <div className="space-y-6 animate-slide-in">
            <div className="card-stunning p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground/90">Subscription Tier</h2>
                        <p className="text-sm text-foreground/60">Select a plan to unlock advanced features.</p>
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
                                    {tier === 'basic' && <p className="text-sm text-zinc-500">Core cooling features, single site.</p>}
                                    {tier === 'pro' && <p className="text-sm text-zinc-500">Menu Engineering, Multi-user access.</p>}
                                    {tier === 'enterprise' && <p className="text-sm text-zinc-500">Multi-site management, API Access, Branding.</p>}
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
    )
}
