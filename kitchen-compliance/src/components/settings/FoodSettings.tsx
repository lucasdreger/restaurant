import { useState, useEffect } from 'react'
import { Coffee, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getFoodPresets, createFoodPreset, deleteFoodPreset } from '@/services/settingsService'
import { toast } from 'sonner'
import type { FoodItem } from '@/types/database.types'

export function FoodSettings() {
    const { currentSite } = useAppStore()

    const [foodList, setFoodList] = useState<FoodItem[]>([])
    const [loading, setLoading] = useState(false)
    const [newFoodName, setNewFoodName] = useState('')
    const [newFoodCategory, setNewFoodCategory] = useState<'sauce' | 'soup' | 'meat' | 'vegetable' | 'other'>('other')

    useEffect(() => {
        if (currentSite?.id) {
            loadFood()
        }
    }, [currentSite?.id])

    const loadFood = async () => {
        if (!currentSite?.id) return
        setLoading(true)
        try {
            const data = await getFoodPresets(currentSite.id)
            setFoodList(data)
        } catch (error) {
            console.error('Failed to load food:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddFood = async () => {
        if (!currentSite?.id) return
        if (!newFoodName.trim()) {
            toast.error('Item name is required')
            return
        }

        try {
            await createFoodPreset({
                site_id: currentSite.id,
                name: newFoodName.trim(),
                category: newFoodCategory,
                use_count: 0
            })
            toast.success('Food preset added')
            setNewFoodName('')
            setNewFoodCategory('other')
            loadFood()
        } catch (error) {
            console.error('Failed to add food:', error)
            toast.error('Failed to add food preset')
        }
    }

    const handleDeleteFood = async (id: string) => {
        try {
            await deleteFoodPreset(id)
            toast.success('Food preset removed')
            loadFood()
        } catch (error) {
            console.error('Failed to delete food:', error)
            toast.error('Failed to remove food preset')
        }
    }

    return (
        <div className="space-y-6 animate-slide-in">
            <div className="card-stunning p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Coffee className="w-5 h-5 text-emerald-500" />
                    Add Food Preset
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-theme-ghost p-4 rounded-xl border border-theme-primary/50">
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-semibold uppercase text-theme-secondary">Item Name</label>
                        <input
                            value={newFoodName}
                            onChange={e => setNewFoodName(e.target.value)}
                            placeholder="e.g. Tomato Soup"
                            className="input-stunning"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-theme-secondary">Category</label>
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
                {loading && <p className="text-theme-secondary">Loading presets...</p>}
                {!loading && foodList.length === 0 && <p className="text-theme-secondary">No presets found.</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {foodList.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-theme-ghost rounded-xl border border-theme-primary group">
                            <span className="font-medium">{item.name}</span>
                            <div className="flex items-center gap-3">
                                <span className="text-xs px-2 py-1 rounded-full bg-theme-card border border-theme-primary capitalize text-theme-secondary">
                                    {item.category}
                                </span>
                                <button
                                    onClick={() => handleDeleteFood(item.id)}
                                    className="p-1 text-theme-secondary hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
