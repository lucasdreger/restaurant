import { Mic, Volume2, Check } from 'lucide-react'
import { useAppStore, WAKE_WORD_OPTIONS, type WakeWordId, type VoiceProvider } from '@/store/useAppStore'
import { upsertSiteSettings } from '@/services/settingsService'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function VoiceSettings() {
    const { settings, updateSettings, currentSite } = useAppStore()
    const usesServerSideKeys = settings.voiceProvider !== 'browser'

    const persistSiteSettings = async (updates: Partial<typeof settings>) => {
        if (!currentSite?.id) return
        try {
            await upsertSiteSettings({
                site_id: currentSite.id,
                voice_provider: updates.voiceProvider ?? settings.voiceProvider,
                active_wake_words: updates.activeWakeWords ?? settings.activeWakeWords,
                wake_word_enabled: updates.wakeWordEnabled ?? settings.wakeWordEnabled,
                tts_enabled: updates.ttsEnabled ?? settings.ttsEnabled,
                // Preserve other settings
                theme: settings.theme,
                language: settings.language,
                audio_model: settings.audioModel,
                ocr_provider: settings.ocrProvider,
                ocr_model: settings.ocrModel,
            })
            toast.success('Voice settings saved')
        } catch (error) {
            console.error('Failed to persist voice settings:', error)
            toast.error('Failed to save settings to server')
        }
    }

    const handleVoiceProviderChange = (provider: VoiceProvider) => {
        updateSettings({ voiceProvider: provider })
        persistSiteSettings({ voiceProvider: provider })
    }

    const handleWakeWordToggle = () => {
        const next = !settings.wakeWordEnabled
        updateSettings({ wakeWordEnabled: next })
        persistSiteSettings({ wakeWordEnabled: next })
    }

    const handleTTSToggle = () => {
        const next = !settings.ttsEnabled
        updateSettings({ ttsEnabled: next })
        persistSiteSettings({ ttsEnabled: next })
    }

    const handleWakeWordSelection = (optionId: WakeWordId) => {
        const current = settings.activeWakeWords || ['luma']
        let updated: WakeWordId[]
        const isActive = current.includes(optionId)

        if (isActive && current.length > 1) {
            // Remove (but keep at least one)
            updated = current.filter(id => id !== optionId)
        } else if (!isActive) {
            // Add
            updated = [...current, optionId]
        } else {
            // Can't remove the last one
            return
        }
        updateSettings({ activeWakeWords: updated })
        persistSiteSettings({ activeWakeWords: updated })
    }

    return (
        <div className="space-y-6 animate-slide-in">
            <div className="card-stunning p-6">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 rounded-full bg-rose-500/10 text-rose-500 animate-pulse">
                        <Mic className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-theme-primary">Voice Control Settings</h2>
                        <p className="text-theme-primary opacity-80">Configure speech recognition provider and API keys.</p>
                    </div>
                </div>

                {/* Voice Provider Selection */}
                <div className="space-y-4 mb-8">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-theme-primary">Speech Recognition Provider</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Browser */}
                        <button
                            onClick={() => handleVoiceProviderChange('browser')}
                            className={cn(
                                "p-4 rounded-xl border-2 transition-all text-left bg-theme-card",
                                settings.voiceProvider === 'browser'
                                    ? "border-emerald-500 bg-emerald-500/10 shadow-theme-sm"
                                    : "border-theme-primary hover:border-emerald-500/40"
                            )}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Volume2 className="w-5 h-5 text-emerald-500" />
                                <span className="font-semibold text-theme-primary">Browser</span>
                                {settings.voiceProvider === 'browser' && (
                                    <Check className="w-4 h-4 text-emerald-500 ml-auto" />
                                )}
                            </div>
                            <p className="text-xs text-theme-primary opacity-80 leading-relaxed">
                                Free, uses Chrome/Safari built-in speech recognition
                            </p>
                        </button>

                        {/* Realtime (OpenAI) */}
                        <button
                            onClick={() => handleVoiceProviderChange('realtime')}
                            className={cn(
                                "p-4 rounded-xl border-2 transition-all text-left bg-theme-card",
                                settings.voiceProvider === 'realtime'
                                    ? "border-cyan-500 bg-cyan-500/10 shadow-theme-sm"
                                    : "border-theme-primary hover:border-cyan-500/40"
                            )}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">⚡</span>
                                <span className="font-semibold text-theme-primary">Realtime (OpenAI)</span>
                                {settings.voiceProvider === 'realtime' && (
                                    <Check className="w-4 h-4 text-cyan-500 ml-auto" />
                                )}
                            </div>
                            <p className="text-xs text-theme-primary opacity-80 leading-relaxed">
                                Low-latency streaming voice with OpenAI Realtime for fast command capture.
                            </p>
                        </button>

                        {/* Whisper (Edge Function) */}
                        <button
                            onClick={() => handleVoiceProviderChange('whisper')}
                            className={cn(
                                "p-4 rounded-xl border-2 transition-all text-left bg-theme-card",
                                settings.voiceProvider === 'whisper'
                                    ? "border-sky-500 bg-sky-500/10 shadow-theme-sm"
                                    : "border-theme-primary hover:border-sky-500/40"
                            )}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🤖</span>
                                <span className="font-semibold text-theme-primary">Whisper (Edge Function)</span>
                                {settings.voiceProvider === 'whisper' && (
                                    <Check className="w-4 h-4 text-sky-500 ml-auto" />
                                )}
                            </div>
                            <p className="text-xs text-theme-primary opacity-80 leading-relaxed">
                                High accuracy, works in noisy environments. API keys managed server-side.
                            </p>
                        </button>
                    </div>
                </div>

                {/* API Keys Notice */}
                <div className="space-y-4 mb-8">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-theme-primary">API Keys</h3>
                    <div className={cn(
                        "p-4 rounded-xl border",
                        usesServerSideKeys
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : "border-sky-500/35 bg-sky-500/10"
                    )}>
                        <div className="flex items-center gap-2 mb-2">
                            <Check className={cn(
                                "w-4 h-4",
                                usesServerSideKeys ? "text-emerald-500" : "text-sky-500"
                            )} />
                            <span className={cn(
                                "font-medium",
                                usesServerSideKeys ? "text-emerald-600 dark:text-emerald-400" : "text-sky-700 dark:text-sky-400"
                            )}>
                                {usesServerSideKeys ? 'Managed Server-Side' : 'No API Keys Needed'}
                            </span>
                        </div>
                        <p className="text-xs text-theme-primary opacity-80 leading-relaxed">
                            {usesServerSideKeys
                                ? 'API keys are securely stored as server-side secrets and managed by the Edge Function. No client-side key configuration needed.'
                                : 'This provider runs without API key setup in the client. Just enable microphone permission and start speaking.'}
                        </p>
                    </div>
                </div>

                {/* Other Voice Settings */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-theme-primary">Other Settings</h3>

                    <div
                        onClick={handleTTSToggle}
                        className="flex items-center justify-between p-4 rounded-xl cursor-pointer bg-theme-card border border-theme-primary hover:bg-theme-hover transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Volume2 className="text-theme-secondary" />
                            <div>
                                <p className="font-medium text-theme-primary">Text-to-Speech Feedback</p>
                                <p className="text-xs text-theme-primary opacity-75">Read back confirmations aloud</p>
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
                        onClick={handleWakeWordToggle}
                        className="flex items-center justify-between p-4 rounded-xl cursor-pointer bg-theme-card border border-theme-primary hover:bg-theme-hover transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Mic className={cn(
                                "transition-colors",
                                settings.wakeWordEnabled ? "text-rose-500 animate-pulse" : "text-theme-secondary"
                            )} />
                            <div>
                                <p className="font-medium text-theme-primary">Always Listening (Kiosk Mode)</p>
                                <p className="text-xs text-theme-primary opacity-75">
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
                        <div className="p-4 rounded-xl bg-theme-card border border-rose-500/30 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold text-rose-500 dark:text-rose-400">Wake Words</span>
                                <span className="text-xs text-theme-primary opacity-70">(select one or more)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {WAKE_WORD_OPTIONS.map((option) => {
                                    const isActive = settings.activeWakeWords?.includes(option.id) ?? false
                                    return (
                                        <button
                                            key={option.id}
                                            onClick={() => handleWakeWordSelection(option.id)}
                                            className={cn(
                                                "p-3 rounded-xl border-2 transition-all text-left",
                                                isActive
                                                    ? "border-rose-500 bg-rose-500/10"
                                                    : "border-theme-primary hover:border-rose-500/40 bg-theme-card"
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="font-semibold text-theme-primary">{option.label}</span>
                                                    <p className="text-xs text-theme-primary opacity-75 mt-0.5">
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
                            <p className="text-xs text-theme-primary opacity-75 mt-2">
                                💡 Tip: You can enable multiple wake words for flexibility
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
