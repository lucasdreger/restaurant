import type { StateCreator } from 'zustand'

// Theme type
export type AppTheme = 'day' | 'night'
export type VoiceProvider = 'browser' | 'whisper' | 'realtime'

// Audio models available through OpenRouter
export type AudioModel =
    | 'openai/whisper-1'                // Industry standard for transcription - supports WebM!
    | 'openai/gpt-4o-audio-preview'     // $40/M audio tokens - highest quality
    | 'openai/gpt-audio'                 // $32/M audio tokens
    | 'openai/gpt-audio-mini'            // $0.60/M audio tokens - cost efficient!

// OCR/Vision models available
export type OCRModel =
    | 'openai/gpt-4o'                    // OpenAI GPT-4o Vision
    | 'openai/gpt-4o-mini'               // OpenAI GPT-4o Mini (cheaper)
    | 'anthropic/claude-sonnet'          // Claude 3.5 Sonnet via OpenRouter
    | 'anthropic/claude-haiku'           // Claude 3 Haiku via OpenRouter (fast/cheap)
    | 'google/gemini-2.0-flash'          // Gemini 2.0 Flash via OpenRouter
    | 'google/gemini-flash-1.5'          // Gemini 1.5 Flash via OpenRouter

// OCR model display info for UI
export const OCR_MODEL_INFO: Record<OCRModel, { name: string; provider: string; price: string }> = {
    'openai/gpt-4o': { name: 'GPT-4o Vision', provider: 'openai', price: '~$5/1K images' },
    'openai/gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'openai', price: '~$0.50/1K images' },
    'anthropic/claude-sonnet': { name: 'Claude 3.5 Sonnet', provider: 'openrouter', price: '~$3/1K images' },
    'anthropic/claude-haiku': { name: 'Claude 3 Haiku', provider: 'openrouter', price: '~$0.25/1K images' },
    'google/gemini-2.0-flash': { name: 'Gemini 2.0 Flash', provider: 'openrouter', price: '~$0.10/1K images' },
    'google/gemini-flash-1.5': { name: 'Gemini 1.5 Flash', provider: 'openrouter', price: '~$0.075/1K images' },
}

// OCR provider type
export type OCRProvider = 'openai' | 'openrouter'

// Available wake word options
export const WAKE_WORD_OPTIONS = [
    { id: 'luma', label: 'Luma', phrases: ['luma', 'hey luma', 'hi luma', 'ok luma', 'okay luma'] },
    { id: 'chef', label: 'Chef', phrases: ['chef', 'hey chef', 'hi chef', 'ok chef', 'okay chef'] },
    { id: 'kitchen', label: 'Kitchen', phrases: ['kitchen', 'hey kitchen', 'hi kitchen', 'ok kitchen'] },
    { id: 'assistant', label: 'Assistant', phrases: ['assistant', 'hey assistant', 'hi assistant'] },
] as const

export type WakeWordId = typeof WAKE_WORD_OPTIONS[number]['id']

// Settings interface
export interface AppSettings {
    restaurantName: string // Editable restaurant/venue name
    voiceProvider: VoiceProvider // 'whisper' and 'realtime' use Edge Function; 'browser' is local-only
    audioModel: AudioModel // Model to use for voice
    ocrProvider: OCRProvider // OCR provider selection
    ocrModel: OCRModel // Model to use for OCR
    apiProvider: 'openai' | 'openrouter' // For text/chat APIs (future use)
    language: string
    theme: AppTheme
    subscriptionTier: 'basic' | 'pro' | 'enterprise'
    ttsEnabled: boolean
    wakeWordEnabled: boolean // Always-listening mode
    activeWakeWords: WakeWordId[] // Which wake words are enabled
}

const defaultSettings: AppSettings = {
    restaurantName: 'Casa Rendezvous', // Default restaurant name
    // Default to OpenAI Realtime for low-latency voice interactions.
    // Whisper remains available as a selectable fallback in Settings.
    voiceProvider: 'realtime',
    audioModel: 'openai/whisper-1', // Default to Whisper via Edge Function
    ocrProvider: 'openrouter', // Default to OpenRouter (Gemini is cheap and fast)
    ocrModel: 'google/gemini-2.0-flash', // Default to Gemini 2.0 Flash
    apiProvider: 'openai',
    language: 'en',
    theme: 'day',
    subscriptionTier: 'pro',
    ttsEnabled: true,
    wakeWordEnabled: false, // Disabled by default - user must enable
    activeWakeWords: ['luma'], // Default to "Luma" wake word
}

export interface SettingsSlice {
    settings: AppSettings
    updateSettings: (updates: Partial<AppSettings>) => void
}

export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
    settings: defaultSettings,
    updateSettings: (updates) =>
        set((state) => {
            // Cast state to any to access settings if TypeScript complains about merged state
            const currentSettings = (state as any).settings || defaultSettings
            const newSettings = { ...currentSettings, ...updates }

            // Auto-migrate old default model to the new reliable Whisper model
            if (newSettings.audioModel === 'openai/gpt-audio-mini' as any) {
                newSettings.audioModel = 'openai/whisper-1'
            }

            return { settings: newSettings }
        }),
})
