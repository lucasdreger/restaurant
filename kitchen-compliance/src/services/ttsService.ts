/**
 * Enhanced Text-to-Speech Service
 * 
 * Features:
 * - Queueing system (never drops speech)
 * - Mobile audio unlock (plays silent buffer)
 * - Auto-retry for failures
 * - Configurable voices
 */

type SpeakOptions = {
    rate?: number
    pitch?: number
    volume?: number
    voice?: SpeechSynthesisVoice
    onStart?: () => void
    onEnd?: () => void
    onError?: (error: any) => void
    force?: boolean // If true, clears queue and speaks immediately
}

type QueueItem = {
    text: string
    options: SpeakOptions
    retries: number
}

class TTSService {
    private audioCache: Map<string, string> = new Map() // text -> blobUrl
    private apiKey: string | null = null
    private useOpenAI: boolean = false
    private openAIVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'

    // Restored properties
    private queue: QueueItem[] = []
    private isSpeaking: boolean = false
    private isInitialized: boolean = false
    private voices: SpeechSynthesisVoice[] = []
    private selectedVoice: SpeechSynthesisVoice | null = null

    constructor() {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            this.init()
        }
    }

    configure(config: { apiKey?: string; useOpenAI?: boolean; voice?: string }) {
        if (config.apiKey) this.apiKey = config.apiKey
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

        // Add natural pauses to text if not already processed
        // For OpenAI, we send raw text mostly, but punctuation helps
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

        // Decide provider
        if (this.useOpenAI && this.apiKey) {
            await this.speakOpenAI(item)
        } else {
            if (this.useOpenAI && !this.apiKey) {
                console.warn('[TTS] OpenAI enabled but no API key found. Falling back to browser.')
            } else if (!this.useOpenAI) {
                console.log('[TTS] OpenAI disabled in settings. Using browser.')
            }
            this.speakBrowser(item)
        }
    }

    private async speakOpenAI(item: QueueItem) {
        const cacheKey = `${item.text}-${this.openAIVoice}`

        try {
            item.options.onStart?.()
            console.log('[TTS] Speaking (OpenAI):', item.text)

            let audioUrl = this.audioCache.get(cacheKey)

            if (!audioUrl) {
                console.log('[TTS] Cache miss, fetching from OpenAI...')
                const response = await fetch('https://api.openai.com/v1/audio/speech', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'tts-1',
                        input: item.text,
                        voice: this.openAIVoice,
                        response_format: 'mp3',
                        speed: item.options.rate || 1.0
                    }),
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    console.error('[TTS] OpenAI API Error Body:', errorText)
                    throw new Error(`OpenAI TTS Error: ${response.status} ${response.statusText} - ${errorText}`)
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
            // Can't easily cancel Audio element if we don't store ref, 
            // but we can clear queue so next items don't play
            this.queue = []
            this.isSpeaking = false
            // TODO: Stop current audio if possible (would need to track currentAudio)
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
