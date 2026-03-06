import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'

// Import Sub-components
import { SettingsSidebar, type SettingsTab } from '../settings/SettingsSidebar'
import { GeneralSettings } from '../settings/GeneralSettings'
import { AppearanceSettings } from '../settings/AppearanceSettings'
import { SubscriptionSettings } from '../settings/SubscriptionSettings'
import { StaffSettings } from '../settings/StaffSettings'
import { FoodSettings } from '../settings/FoodSettings'
import { VoiceSettings } from '../settings/VoiceSettings'
import { OCRSettings } from '../settings/OCRSettings'
import { FridgeSettings } from '../settings/FridgeSettings'

interface SettingsScreenProps {
  onBack: () => void
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  return (
    <div className="min-h-full bg-[var(--background)] flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex-none px-4 md:px-6 py-4 border-b border-theme-primary flex items-center justify-between bg-[var(--card)]/50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-theme-ghost transition-colors md:hidden"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-theme-primary to-theme-muted bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="text-sm text-theme-muted">Configure your kitchen compliance system</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full px-4 md:px-6 py-4 md:py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 h-full">

            {/* Sidebar Navigation */}
            <SettingsSidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            {/* Content Area */}
            <div className="md:col-span-3 h-full overflow-y-auto pb-24 md:pb-8 md:pr-2 custom-scrollbar">

              {/* GENERAL TAB */}
              {activeTab === 'general' && <GeneralSettings />}

              {/* APPEARANCE TAB */}
              {activeTab === 'appearance' && <AppearanceSettings />}

              {/* SUBSCRIPTION TAB */}
              {activeTab === 'subscription' && <SubscriptionSettings />}

              {/* STAFF TAB */}
              {activeTab === 'staff' && <StaffSettings />}

              {/* FOOD TAB */}
              {activeTab === 'food' && <FoodSettings />}

              {/* VOICE TAB */}
              {activeTab === 'voice' && <VoiceSettings />}

              {/* OCR TAB */}
              {activeTab === 'ocr' && <OCRSettings />}

              {/* FRIDGES TAB */}
              {activeTab === 'fridges' && (
                <FridgeSettings onPlanUpgrade={() => setActiveTab('subscription')} />
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
