import { useState, useMemo } from 'react'
import { X, Snowflake, ChefHat, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { VoiceButtonInline } from '@/components/voice/VoiceButton'
import { useAppStore, getSortedFoodPresets } from '@/store/useAppStore'
import type { FoodItemPreset, VoiceCommand } from '@/types'
import { cn } from '@/lib/utils'

interface StartCoolingModalProps {
  isOpen: boolean
  onClose: () => void
  onStart: (itemName: string, category: FoodItemPreset['category']) => void
}

export function StartCoolingModal({
  isOpen,
  onClose,
  onStart,
}: StartCoolingModalProps) {
  const { foodPresets, incrementFoodUsage } = useAppStore()
  const [selectedCategory, setSelectedCategory] = useState<FoodItemPreset['category'] | null>(null)
  const [customItem, setCustomItem] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Sort presets by most used
  const sortedPresets = useMemo(() => getSortedFoodPresets(foodPresets), [foodPresets])

  // Filter by category and search
  const filteredPresets = useMemo(() => {
    let presets = sortedPresets
    
    if (selectedCategory) {
      presets = presets.filter((p) => p.category === selectedCategory)
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      presets = presets.filter((p) => 
        p.name.toLowerCase().includes(query)
      )
    }
    
    // Show top 12 most used if no filter/search
    if (!selectedCategory && !searchQuery.trim()) {
      presets = presets.slice(0, 12)
    }
    
    return presets
  }, [sortedPresets, selectedCategory, searchQuery])

  if (!isOpen) return null

  const categories: { id: FoodItemPreset['category']; label: string; icon: string }[] = [
    { id: 'sauce', label: 'Sauces', icon: '🥫' },
    { id: 'soup', label: 'Soups', icon: '🍲' },
    { id: 'meat', label: 'Meats', icon: '🥩' },
    { id: 'vegetable', label: 'Veg', icon: '🥗' },
    { id: 'other', label: 'Other', icon: '📦' },
  ]

  const handlePresetSelect = (preset: FoodItemPreset) => {
    incrementFoodUsage(preset.id)
    onStart(preset.name, preset.category)
    handleClose()
  }

  const handleCustomSubmit = () => {
    if (customItem.trim()) {
      onStart(customItem.trim(), selectedCategory || 'other')
      handleClose()
    }
  }

  const handleClose = () => {
    setSelectedCategory(null)
    setCustomItem('')
    setSearchQuery('')
    onClose()
  }

  const handleVoiceCommand = (command: VoiceCommand) => {
    if (command.type === 'start_cooling' && command.item) {
      // Try to find matching preset
      const preset = foodPresets.find(
        (p) => p.name.toLowerCase().includes(command.item!.toLowerCase())
      )
      if (preset) {
        incrementFoodUsage(preset.id)
        onStart(preset.name, preset.category)
      } else {
        onStart(command.item, 'other')
      }
      handleClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal - Full screen on mobile for touch-friendliness */}
      <div className="relative w-full sm:max-w-2xl h-[95vh] sm:h-auto sm:max-h-[90vh] overflow-hidden bg-theme-modal rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-in border border-theme-primary">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme-primary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/20 rounded-xl">
              <Snowflake className="w-6 h-6 text-sky-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-theme-primary">Start Cooling</h2>
              <p className="text-xs text-theme-muted">Select food item</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <VoiceButtonInline onCommand={handleVoiceCommand} />
            <button
              onClick={handleClose}
              className="p-3 hover:bg-theme-ghost rounded-xl transition-colors text-theme-primary"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-theme-primary">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted pointer-events-none z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search food items..."
              className="input-stunning !pl-11"
            />
          </div>
        </div>

        {/* Category Tabs - Large touch targets */}
        <div className="flex gap-2 overflow-x-auto p-3 border-b border-theme-primary scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'flex-shrink-0 px-5 py-3 rounded-xl font-semibold transition-all min-w-[80px] text-center',
              !selectedCategory
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                : 'bg-theme-ghost text-theme-secondary hover:bg-theme-elevated active:scale-95'
            )}
          >
            Top Used
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'flex-shrink-0 px-5 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 min-w-[80px] justify-center',
                selectedCategory === cat.id
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                  : 'bg-theme-ghost text-theme-secondary hover:bg-theme-elevated active:scale-95'
              )}
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="hidden sm:inline">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Content - Scrollable grid */}
        <div className="p-4 overflow-y-auto flex-1" style={{ maxHeight: 'calc(95vh - 280px)' }}>
          {/* Food Item Tiles - Large touch targets */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {filteredPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className="flex flex-col items-center justify-center gap-2 p-5 bg-theme-card hover:bg-theme-elevated border border-theme-primary rounded-2xl transition-all active:scale-95 min-h-[100px] touch-manipulation"
              >
                <span className="text-4xl">{preset.icon}</span>
                <span className="font-semibold text-center text-sm leading-tight text-theme-primary">{preset.name}</span>
                {(preset.use_count || 0) > 0 && (
                  <span className="text-[10px] text-theme-muted">Used {preset.use_count}x</span>
                )}
              </button>
            ))}
          </div>

          {filteredPresets.length === 0 && (
            <div className="text-center py-8">
              <p className="text-theme-secondary">No items found</p>
              <p className="text-sm text-theme-muted mt-1">Try a different search or add custom item</p>
            </div>
          )}

          {/* Custom Item - Always visible */}
          <div className="border-t border-theme-primary pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <ChefHat className="w-5 h-5 text-theme-muted" />
              <span className="text-sm text-theme-muted">Custom item:</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                placeholder="e.g., Mushroom risotto"
                className="flex-1 px-4 py-4 bg-theme-input border border-theme-input rounded-xl text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-sky-500 text-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCustomSubmit()
                }}
              />
              <Button
                variant="cooling"
                size="lg"
                onClick={handleCustomSubmit}
                disabled={!customItem.trim()}
                className="px-6"
              >
                Start
              </Button>
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div className="p-4 border-t border-theme-primary bg-theme-secondary safe-area-bottom">
          <p className="text-center text-sm text-theme-secondary">
            💡 Timer starts immediately • Move to fridge within 2 hours
          </p>
        </div>
      </div>
    </div>
  )
}
