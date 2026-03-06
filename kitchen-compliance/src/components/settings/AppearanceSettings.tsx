import { Sun, Moon } from 'lucide-react'
import { useAppStore, type AppTheme } from '@/store/useAppStore'
import { upsertSiteSettings } from '@/services/settingsService'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function AppearanceSettings() {
    const { settings, updateSettings, currentSite } = useAppStore()

    const persistSiteSettings = async (updates: Partial<typeof settings>) => {
        if (!currentSite?.id) return
        try {
            await upsertSiteSettings({
                site_id: currentSite.id,
                theme: updates.theme ?? settings.theme,
                // We only persist the specific fields related to this component context if needed,
                // but typically we want to preserve current settings for others.
                // Simplified usage here based on original implementation context.
                language: settings.language,
                voice_provider: settings.voiceProvider,
                audio_model: settings.audioModel,
                ocr_provider: settings.ocrProvider,
                ocr_model: settings.ocrModel,
                tts_enabled: settings.ttsEnabled,
                wake_word_enabled: settings.wakeWordEnabled,
                active_wake_words: settings.activeWakeWords,
            })
            toast.success('Settings saved successfully')
        } catch (error) {
            console.error('Failed to persist site settings:', error)
            toast.error('Failed to save settings to server')
        }
    }

    const handleThemeChange = (theme: AppTheme) => {
        updateSettings({ theme })
        persistSiteSettings({ theme })
        toast.success(`Theme set to ${theme}`)
    }

    return (
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
    )
}
