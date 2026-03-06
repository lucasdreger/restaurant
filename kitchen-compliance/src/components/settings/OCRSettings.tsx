import { Eye, Check, Zap } from 'lucide-react'
import { useAppStore, type OCRModel, OCR_MODEL_INFO } from '@/store/useAppStore'
import { upsertSiteSettings } from '@/services/settingsService'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function OCRSettings() {
    const { settings, updateSettings, currentSite } = useAppStore()

    const persistSiteSettings = async (updates: Partial<typeof settings>) => {
        if (!currentSite?.id) return
        try {
            await upsertSiteSettings({
                site_id: currentSite.id,
                ocr_provider: updates.ocrProvider ?? settings.ocrProvider,
                ocr_model: updates.ocrModel ?? settings.ocrModel,
                // Preserve other settings
                theme: settings.theme,
                language: settings.language,
                voice_provider: settings.voiceProvider,
                audio_model: settings.audioModel,
                tts_enabled: settings.ttsEnabled,
                wake_word_enabled: settings.wakeWordEnabled,
                active_wake_words: settings.activeWakeWords,
            })
            toast.success('OCR settings saved')
        } catch (error) {
            console.error('Failed to persist OCR settings:', error)
            toast.error('Failed to save settings to server')
        }
    }

    const handleProviderChange = (provider: 'openai' | 'openrouter', defaultModel: OCRModel) => {
        updateSettings({ ocrProvider: provider, ocrModel: defaultModel })
        persistSiteSettings({ ocrProvider: provider, ocrModel: defaultModel })
    }

    const handleModelChange = (modelId: OCRModel) => {
        updateSettings({ ocrModel: modelId })
        persistSiteSettings({ ocrModel: modelId })
    }

    return (
        <div className="space-y-6 animate-slide-in">
            <div className="card-stunning p-6">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-500">
                        <Eye className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">OCR / Vision Settings</h2>
                        <p className="text-theme-secondary">Configure invoice scanning and document recognition.</p>
                    </div>
                </div>

                {/* OCR Provider Selection */}
                <div className="space-y-4 mb-8">
                    <h3 className="text-sm font-semibold uppercase text-theme-secondary">OCR Provider</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* OpenAI */}
                        <button
                            onClick={() => handleProviderChange('openai', 'openai/gpt-4o')}
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
                            <p className="text-xs text-theme-secondary">
                                GPT-4o Vision - excellent accuracy for invoices & handwriting.
                            </p>
                        </button>

                        {/* OpenRouter */}
                        <button
                            onClick={() => handleProviderChange('openrouter', 'google/gemini-2.0-flash')}
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
                                <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">Recommended</span>
                                {settings.ocrProvider === 'openrouter' && (
                                    <Check className="w-4 h-4 text-purple-500 ml-auto" />
                                )}
                            </div>
                            <p className="text-xs text-theme-secondary">
                                Access Gemini 2.0 Flash - fast, cheap, and great for mobile photos.
                            </p>
                        </button>
                    </div>
                </div>

                {/* Model Selection (for OpenAI / OpenRouter) */}
                <div className="space-y-4 mb-8">
                    <h3 className="text-sm font-semibold uppercase text-theme-secondary">Vision Model</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {(Object.entries(OCR_MODEL_INFO) as [OCRModel, typeof OCR_MODEL_INFO[OCRModel]][])
                            .filter(([_, info]) => info.provider === settings.ocrProvider)
                            .map(([modelId, info]) => (
                                <button
                                    key={modelId}
                                    onClick={() => handleModelChange(modelId)}
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
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-theme-secondary">{info.price}</span>
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

                {/* API Key Status */}
                <div className="space-y-4 mb-8">
                    <h3 className="text-sm font-semibold uppercase text-theme-secondary">API Key Status</h3>
                    <div className="p-4 rounded-xl border border-emerald-500/50 bg-emerald-500/5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🔒</span>
                                <span className="font-medium">Server-Side Keys</span>
                            </div>
                            <span className="text-xs text-emerald-500 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Active
                            </span>
                        </div>
                        <p className="text-xs text-theme-secondary mt-2">
                            OCR API keys are securely managed via Edge Function secrets.
                        </p>
                    </div>
                </div>

                {/* Current Configuration Summary */}
                <div className="p-4 rounded-xl bg-theme-ghost border border-theme-primary">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Current OCR Configuration
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-theme-secondary">Provider:</span>
                            <span className="font-medium">
                                {settings.ocrProvider === 'openai' ? 'OpenAI' : 'OpenRouter'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-theme-secondary">Model:</span>
                            <span className="font-medium">{OCR_MODEL_INFO[settings.ocrModel]?.name || settings.ocrModel}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-theme-secondary">Price:</span>
                            <span className="font-medium text-theme-primary">
                                {OCR_MODEL_INFO[settings.ocrModel]?.price || 'Unknown'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-theme-secondary">Status:</span>
                            <span className="text-emerald-500 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Ready (Server-Side)
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
