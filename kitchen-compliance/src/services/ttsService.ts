/**
 * Enhanced Text-to-Speech Service
 * 
 * Features:
 * - Queueing system (never drops speech)
 * - Mobile audio unlock (plays silent buffer)
 * - Auto-retry for failures
 * - OpenAI TTS via Edge Function (no client-side API keys)
 * - Browser Speech Synthesis fallback
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase'

type SpeakOptions = {
    rate?: number
    pitch?: number
    volume?: number
    voice?: SpeechSynthesisVoice
    preferBrowser?: boolean
    onStart?: () => void
    onEnd?: () => void
    onError?: (error: any) => void
    force?: boolean // If true, clears queue and speaks immediately
    preferRealtime?: boolean // Bypasses React state delay to force WebRTC audio
}

type QueueItem = {
    text: string
    options: SpeakOptions
    retries: number
}

class TTSService {
    private audioCache: Map<string, string> = new Map() // text -> blobUrl
    private useOpenAI: boolean = true
    private openAIVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'

    // Restored properties
    private queue: QueueItem[] = []
    private isSpeaking: boolean = false
    private isInitialized: boolean = false
    private voices: SpeechSynthesisVoice[] = []
    private selectedVoice: SpeechSynthesisVoice | null = null
    private hasUnlockedAudio: boolean = false

    constructor() {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            this.init()
            // Try to unlock audio on first interaction
            window.addEventListener('click', this.unlockAudioBound, { once: true })
            window.addEventListener('touchstart', this.unlockAudioBound, { once: true })
            window.addEventListener('keydown', this.unlockAudioBound, { once: true })
        }
    }

    private unlockAudio() {
        if (this.hasUnlockedAudio || typeof window === 'undefined') return

        try {
            // Creating and speaking an empty utterance unlocks the voice engine on iOS/Safari
            const utterance = new SpeechSynthesisUtterance('')
            utterance.volume = 0
            window.speechSynthesis.speak(utterance)
            window.speechSynthesis.cancel() // immediately cancel finding it
            this.hasUnlockedAudio = true

            window.removeEventListener('click', this.unlockAudioBound)
            window.removeEventListener('touchstart', this.unlockAudioBound)
            window.removeEventListener('keydown', this.unlockAudioBound)
            console.log('[TTS] Audio unlocked via user interaction')
        } catch (e) {
            console.warn('[TTS] SpeechSynthesis unlock failed:', e)
        }
    }

    private unlockAudioBound = this.unlockAudio.bind(this)

    configure(config: { useOpenAI?: boolean; voice?: string }) {
        if (config.useOpenAI !== undefined) this.useOpenAI = config.useOpenAI
        if (config.voice) this.openAIVoice = config.voice as any
        console.log('[TTS] Configured:', { useOpenAI: this.useOpenAI, voice: this.openAIVoice })
    }

    private init() {
        if (this.isInitialized) return

        // Load voices
        const loadVoices = () => {
            this.voices = window.speechSynthesis.getVoices()
            // Prefer "premium" or specific English voices
            this.selectedVoice = this.voices.find(v =>
                (v.name.includes('Premium') || v.name.includes('Enhanced')) && v.lang.startsWith('en')
            ) || this.voices.find(v => v.lang === 'en-IE') // Irish English preference
                || this.voices.find(v => v.lang === 'en-GB')
                || this.voices.find(v => v.lang.startsWith('en'))
                || null

            console.log('[TTS] Voices loaded, selected:', this.selectedVoice?.name)
        }

        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices
        }
        loadVoices()

        this.isInitialized = true
    }

    /**
     * Speak text with options
     */
    async speak(text: string, options: SpeakOptions = {}) {
        const { force = false } = options

        if (force) {
            this.cancel()
        }

        const processedText = this.preprocessText(text)

        this.queue.push({
            text: processedText,
            options,
            retries: 0
        })

        if (!this.isSpeaking) {
            this.processQueue()
        }
    }

    private preprocessText(text: string): string {
        return text
            .replace(/(\d+)\s*degrees?/gi, '$1 degrees.') // Pause after temperature
            .replace(/\bwell done\b/gi, '. Well done!')
            .replace(/\bat\b/g, ', at')
            .replace(/\bby\b/g, ', by')
            .replace(/\b(closing|starting|finished)\b/gi, '$1,')
            .replace(/\bsay\b/gi, '. Say')
            .replace(/confirm to save/gi, 'confirm, to save')
    }

    private async processQueue() {
        if (this.queue.length === 0) {
            this.isSpeaking = false
            return
        }

        this.isSpeaking = true
        const item = this.queue[0]

        // Decide provider. Flow prompts can force browser speech to avoid
        // autoplay-blocked Audio element playback in some kiosk/browser states.
        if (item.options.preferBrowser) {
            this.speakBrowser(item)
        } else if (this.useOpenAI) {
            await this.speakOpenAI(item)
        } else {
            this.speakBrowser(item)
        }
    }

    /**
     * TTS via ai-proxy Edge Function — no client-side API key needed
     */
    private async speakOpenAI(item: QueueItem) {
        if (!isSupabaseConfigured()) {
            console.warn('[TTS] Supabase not configured, falling back to browser')
            this.speakBrowser(item)
            return
        }

        const cacheKey = `${item.text}-${this.openAIVoice}`

        try {
            item.options.onStart?.()
            console.log('[TTS] Speaking (OpenAI via Edge Function):', item.text)

            let audioUrl = this.audioCache.get(cacheKey)

            if (!audioUrl) {
                console.log('[TTS] Cache miss, fetching from Edge Function...')

                const { data: { session } } = await supabase.auth.getSession()
                if (!session?.access_token) {
                    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
                    if (refreshError || !refreshed.session?.access_token) {
                        console.warn('[TTS] Not authenticated, falling back to browser')
                        this.speakBrowser(item)
                        return
                    }
                }

                const invokeTTS = async (accessToken: string) => {
                    return fetch(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                action: 'tts',
                                text: item.text,
                                voice: this.openAIVoice,
                                speed: item.options.rate || 1.0,
                            }),
                        }
                    )
                }

                const { data: latest } = await supabase.auth.getSession()
                let accessToken = latest.session?.access_token
                if (!accessToken) {
                    console.warn('[TTS] Not authenticated, falling back to browser')
                    this.speakBrowser(item)
                    return
                }

                let response = await invokeTTS(accessToken)
                if (!response.ok && response.status === 401) {
                    console.warn('[TTS] Edge Function returned 401. Refreshing session and retrying once...')
                    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
                    if (!refreshError && refreshed.session?.access_token) {
                        accessToken = refreshed.session.access_token
                        response = await invokeTTS(accessToken)
                    }
                }

                if (!response.ok) {
                    const errorText = await response.text()
                    console.error('[TTS] Edge Function Error:', errorText)
                    throw new Error(`TTS Error: ${response.status}`)
                }

                const blob = await response.blob()
                audioUrl = URL.createObjectURL(blob)
                this.audioCache.set(cacheKey, audioUrl)
            } else {
                console.log('[TTS] Cache hit')
            }

            const audio = new Audio(audioUrl)
            audio.volume = item.options.volume || 1.0

            await new Promise<void>((resolve, reject) => {
                audio.onended = () => resolve()
                audio.onerror = (e) => reject(e)
                audio.play().catch(reject)
            })

            console.log('[TTS] Finished (OpenAI)')
            item.options.onEnd?.()
            this.queue.shift()
            this.processQueue()

        } catch (error) {
            console.error('[TTS] OpenAI failed, falling back to browser:', error)
            // Fallback to browser
            this.speakBrowser(item)
        }
    }

    private speakBrowser(item: QueueItem) {
        const utterance = new SpeechSynthesisUtterance(item.text)
        utterance.rate = item.options.rate || 0.95
        utterance.pitch = item.options.pitch || 1.0
        utterance.volume = item.options.volume || 1.0

        if (this.selectedVoice && !item.options.voice) {
            utterance.voice = this.selectedVoice
        }

        utterance.onstart = () => {
            console.log('[TTS] Started (Browser):', item.text.substring(0, 20) + '...')
            item.options.onStart?.()
        }

        utterance.onend = () => {
            console.log('[TTS] Finished (Browser)')
            item.options.onEnd?.()
            this.queue.shift() // Remove finished item
            this.processQueue() // Next
        }

        utterance.onerror = (e) => {
            console.error('[TTS] Browser Error:', e)
            item.options.onError?.(e)
            this.queue.shift()
            this.processQueue()
        }

        window.speechSynthesis.speak(utterance)
    }

    cancel() {
        if (this.useOpenAI) {
            this.queue = []
            this.isSpeaking = false
        }
        window.speechSynthesis.cancel()
        this.queue = []
        this.isSpeaking = false
    }

    getVoices() {
        return this.voices
    }
}

export const ttsService = new TTSService()
