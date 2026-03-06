import { useState, useEffect } from 'react'
import { Thermometer, Plus, ShieldCheck, Check, Edit2, Trash2, X } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getFridges, createFridge, updateFridge, deleteFridge, FRIDGE_LIMITS, type Fridge } from '@/services/fridgeService'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface FridgeSettingsProps {
    onPlanUpgrade: () => void // Callback to switch to subscription tab
}

export function FridgeSettings({ onPlanUpgrade }: FridgeSettingsProps) {
    const { currentSite, settings } = useAppStore()

    const [fridgeList, setFridgeList] = useState<Fridge[]>([])
    const [loading, setLoading] = useState(false)

    const [newFridgeName, setNewFridgeName] = useState('')

    const [editingFridgeId, setEditingFridgeId] = useState<string | null>(null)
    const [editingFridgeName, setEditingFridgeName] = useState('')

    useEffect(() => {
        if (currentSite?.id) {
            loadFridges()
        }
    }, [currentSite?.id])

    const loadFridges = async () => {
        if (!currentSite?.id) return
        setLoading(true)
        try {
            const data = await getFridges(currentSite.id)
            setFridgeList(data)
        } catch (error) {
            console.error('Failed to load fridges:', error)
        } finally {
            setLoading(false)
        }
    }

    const fridgeLimit = settings.subscriptionTier ? FRIDGE_LIMITS[settings.subscriptionTier] : FRIDGE_LIMITS.basic
    const canAddMoreFridges = fridgeList.length < fridgeLimit

    const handleAddFridge = async () => {
        if (!currentSite?.id) return
        if (!canAddMoreFridges) {
            toast.error('Fridge limit reached for your plan')
            return
        }
        if (!newFridgeName.trim()) {
            toast.error('Fridge name is required')
            return
        }

        try {
            await createFridge(currentSite.id, newFridgeName.trim())
            toast.success('Fridge added')
            setNewFridgeName('')
            loadFridges()
        } catch (error) {
            console.error('Failed to add fridge:', error)
            toast.error('Failed to add fridge')
        }
    }

    const handleDeleteFridge = async (id: string) => {
        if (!confirm('Are you sure you want to delete this fridge? All temperature logs for it will be preserved.')) return
        try {
            await deleteFridge(id)
            toast.success('Fridge removed')
            loadFridges()
        } catch (error) {
            console.error('Failed to delete fridge:', error)
            toast.error('Failed to remove fridge')
        }
    }

    const startEditingFridge = (fridge: Fridge) => {
        setEditingFridgeId(fridge.id)
        setEditingFridgeName(fridge.name)
    }

    const handleUpdateFridgeName = async (id: string) => {
        if (!editingFridgeName.trim()) return

        try {
            await updateFridge(id, { name: editingFridgeName.trim() })
            toast.success('Fridge name updated')
            setEditingFridgeId(null)
            loadFridges()
        } catch (error) {
            console.error('Failed to update fridge:', error)
            toast.error('Failed to update fridge name')
        }
    }

    return (
        <div className="space-y-6 animate-slide-in">
            <div className="card-stunning p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-600">
                            <Thermometer className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Fridge Management</h2>
                            <p className="text-sm text-theme-secondary">
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
                {loading && <p className="text-theme-secondary">Loading fridges...</p>}
                {!loading && fridgeList.length === 0 && (
                    <div className="text-center py-8 text-theme-secondary">
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
                                            className="p-2 text-theme-secondary hover:bg-theme-hover rounded-lg transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex-1">
                                        <h3 className="font-semibold">{fridge.name}</h3>
                                        <p className="text-xs text-theme-secondary">
                                            Target: {fridge.min_temp}°C – {fridge.max_temp}°C (FSAI SC1)
                                        </p>
                                    </div>
                                )}
                            </div>

                            {editingFridgeId !== fridge.id && (
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => startEditingFridge(fridge)}
                                        className="p-2 text-theme-secondary hover:text-cyan-500 hover:bg-cyan-50 rounded-lg transition-colors"
                                        title="Rename fridge"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteFridge(fridge.id)}
                                        className="p-2 text-theme-secondary hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
                        <p className="text-xs text-theme-secondary">
                            Upgrade to <strong>Pro</strong> for 2 fridges, or <strong>Enterprise</strong> for unlimited fridges.
                        </p>
                        <button
                            onClick={onPlanUpgrade}
                            className="mt-3 text-xs px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                        >
                            View Plans
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
