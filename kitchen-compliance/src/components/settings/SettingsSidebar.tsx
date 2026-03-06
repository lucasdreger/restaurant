import {
    Building2,
    Palette,
    CreditCard,
    Users,
    UtensilsCrossed,
    Mic,
    Scan,
    Thermometer
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SettingsTab = 'general' | 'appearance' | 'staff' | 'food' | 'voice' | 'ocr' | 'subscription' | 'fridges'

interface SettingsSidebarProps {
    activeTab: SettingsTab
    onTabChange: (tab: SettingsTab) => void
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
    const tabs: Array<{ key: SettingsTab; label: string; icon: LucideIcon }> = [
        { key: 'general', label: 'General', icon: Building2 },
        { key: 'appearance', label: 'Appearance', icon: Palette },
        { key: 'subscription', label: 'Subscription', icon: CreditCard },
        { key: 'staff', label: 'Staff Members', icon: Users },
        { key: 'food', label: 'Food Presets', icon: UtensilsCrossed },
        { key: 'voice', label: 'Voice Control', icon: Mic },
        { key: 'ocr', label: 'OCR / Vision', icon: Scan },
        { key: 'fridges', label: 'Fridges', icon: Thermometer },
    ]

    return (
        <div className="md:col-span-1">
            {/* Mobile: horizontal pills to avoid long vertical scroll before content */}
            <div className="md:hidden -mx-1 mb-4">
                <div className="flex gap-2 overflow-x-auto px-1 pb-2">
                    {tabs.map((tab) => (
                        <MenuButton
                            key={tab.key}
                            active={activeTab === tab.key}
                            onClick={() => onTabChange(tab.key)}
                            icon={tab.icon}
                            label={tab.label}
                            compact
                        />
                    ))}
                </div>
            </div>

            {/* Desktop: sticky vertical sidebar */}
            <div className="hidden md:block space-y-2 md:sticky md:top-6">
                {tabs.map((tab) => (
                    <MenuButton
                        key={tab.key}
                        active={activeTab === tab.key}
                        onClick={() => onTabChange(tab.key)}
                        icon={tab.icon}
                        label={tab.label}
                    />
                ))}
            </div>
        </div>
    )
}

function MenuButton({ active, onClick, icon: Icon, label, compact = false }: { active: boolean, onClick: () => void, icon: LucideIcon, label: string, compact?: boolean }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200",
                compact ? "px-3 py-2.5 whitespace-nowrap shrink-0" : "w-full px-4 py-4",
                active
                    ? "bg-[var(--inverted-bg)] text-[var(--inverted-text)] shadow-md shadow-black/10 scale-[1.02]"
                    : "text-theme-secondary hover:bg-theme-ghost hover:text-theme-primary"
            )}
        >
            <Icon className={cn("w-5 h-5", active ? "text-[var(--inverted-text)]" : "text-theme-secondary/70")} />
            {label}
        </button>
    )
}
