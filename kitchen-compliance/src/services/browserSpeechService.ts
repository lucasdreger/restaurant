/**
 * Browser Speech Recognition Service
 * Uses native Web Speech API for real-time transcription
 * Ideal for conversation flows where immediate feedback is needed
 */

// TypeScript definitions for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: 'no-speech' | 'aborted' | 'audio-capture' | 'network' | 'not-allowed' | 'service-not-allowed' | 'bad-grammar' | 'language-not-supported'
  readonly message: string
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition
  new(): SpeechRecognition
}

declare const webkitSpeechRecognition: {
  prototype: SpeechRecognition
  new(): SpeechRecognition
}

export interface BrowserSpeechOptions {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
}

export interface BrowserSpeechResult {
  transcript: string
  confidence: number
  isFinal: boolean
}

export class BrowserSpeechService {
  private recognition: SpeechRecognition | null = null
  private isListening = false
  private onResultCallback: ((result: BrowserSpeechResult) => void) | null = null
  private onErrorCallback: ((error: string) => void) | null = null
  private onEndCallback: (() => void) | null = null

  constructor() {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition()
    }
  }

  get isSupported(): boolean {
    return this.recognition !== null
  }

  get active(): boolean {
    return this.isListening
  }

  /**
   * Start listening for speech
   */
  start(options: BrowserSpeechOptions = {}): void {
    if (!this.recognition) {
      const error = 'Speech Recognition not supported in this browser'
      console.error('[BrowserSpeech]', error)
      this.onErrorCallback?.(error)
      return
    }

    if (this.isListening) {
      console.warn('[BrowserSpeech] Already listening')
      return
    }

    // Configure recognition
    this.recognition.lang = options.language || 'en-IE'
    this.recognition.continuous = options.continuous ?? false
    this.recognition.interimResults = options.interimResults ?? true
    this.recognition.maxAlternatives = options.maxAlternatives ?? 1

    // Set up event handlers
    this.recognition.onstart = () => {
      console.log('[BrowserSpeech] Started listening')
      this.isListening = true
    }

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1]
      const transcript = result[0].transcript
      const confidence = result[0].confidence
      const isFinal = result.isFinal

      console.log('[BrowserSpeech] Result:', { transcript, confidence, isFinal })

      this.onResultCallback?.({
        transcript,
        confidence,
        isFinal,
      })

      // Auto-stop on final result if not continuous
      if (isFinal && !this.recognition?.continuous) {
        this.stop()
      }
    }

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[BrowserSpeech] Error:', event.error)
      this.isListening = false
      
      let errorMessage = 'Speech recognition error'
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected'
          break
        case 'audio-capture':
          errorMessage = 'Microphone not available'
          break
        case 'not-allowed':
          errorMessage = 'Microphone permission denied'
          break
        case 'network':
          errorMessage = 'Network error during speech recognition'
          break
        default:
          errorMessage = `Speech recognition error: ${event.error}`
      }
      
      this.onErrorCallback?.(errorMessage)
    }

    this.recognition.onend = () => {
      console.log('[BrowserSpeech] Ended')
      this.isListening = false
      this.onEndCallback?.()
    }

    // Start recognition
    try {
      this.recognition.start()
    } catch (error) {
      console.error('[BrowserSpeech] Failed to start:', error)
      this.isListening = false
      this.onErrorCallback?.(error instanceof Error ? error.message : 'Failed to start recognition')
    }
  }

  /**
   * Stop listening
   */
  stop(): void {
    if (!this.recognition || !this.isListening) return

    try {
      this.recognition.stop()
    } catch (error) {
      console.error('[BrowserSpeech] Failed to stop:', error)
    }
  }

  /**
   * Abort/cancel recognition
   */
  abort(): void {
    if (!this.recognition || !this.isListening) return

    try {
      this.recognition.abort()
      this.isListening = false
    } catch (error) {
      console.error('[BrowserSpeech] Failed to abort:', error)
    }
  }

  /**
   * Set callback for results
   */
  onResult(callback: (result: BrowserSpeechResult) => void): void {
    this.onResultCallback = callback
  }

  /**
   * Set callback for errors
   */
  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback
  }

  /**
   * Set callback for end event
   */
  onEnd(callback: () => void): void {
    this.onEndCallback = callback
  }
}

// Singleton instance
export const browserSpeechService = new BrowserSpeechService()
