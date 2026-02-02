/**
 * Voice Recognition Service
 * Supports:
 * - OpenAI Whisper API (direct transcription endpoint)
 * - OpenRouter Audio Models (chat completions with audio input)
 */

import type { AudioModel } from '@/store/useAppStore'

interface VoiceConfig {
  apiKey: string
  provider: 'openai' | 'openrouter'
  model?: AudioModel // For OpenRouter
  language?: string
}

interface TranscriptionResult {
  text: string
  duration?: number
}

// Audio recording utilities
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private stream: MediaStream | null = null

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      })

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType(),
      })

      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.start(100) // Collect data every 100ms
      console.log('[Voice] Recording started')

      // Add silence detection
      this.setupSilenceDetection()
    } catch (error) {
      console.error('[Voice] Failed to start recording:', error)
      throw new Error('Microphone access denied or unavailable')
    }
  }

  private silenceTimer: NodeJS.Timeout | null = null
  private onSilenceDetected: (() => void) | null = null
  private quickResponseMode: boolean = false

  setOnSilenceDetected(callback: () => void, quickMode: boolean = false) {
    this.onSilenceDetected = callback
    this.quickResponseMode = quickMode
  }

  private setupSilenceDetection() {
    if (!this.stream) return

    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(this.stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const checkSilence = () => {
      if (!this.isRecording) {
        audioContext.close()
        return
      }

      analyser.getByteFrequencyData(dataArray)
      const volume = dataArray.reduce((a, b) => a + b) / bufferLength

      // Threshold for silence (very low amplitude)
      if (volume < 5) { // Adjusted for noise
        if (!this.silenceTimer) {
          const silenceDelay = this.quickResponseMode ? 400 : 700 // Quick: 400ms, Normal: 700ms
      this.silenceTimer = setTimeout(() => {
            console.log('[Voice] Silence detected, auto-stopping...')
            this.onSilenceDetected?.()
      }, silenceDelay)
        }
      } else {
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer)
          this.silenceTimer = null
        }
      }

      requestAnimationFrame(checkSilence)
    }

    checkSilence()
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'))
        return
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, {
          type: this.getSupportedMimeType()
        })
        console.log('[Voice] Recording stopped, blob size:', audioBlob.size)

        // Clean up stream
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop())
          this.stream = null
        }

        resolve(audioBlob)
      }

      this.mediaRecorder.stop()
    })
  }

  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    this.audioChunks = []
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  private getSupportedMimeType(): string {
    // Try different formats - webm is most common
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav',
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    return 'audio/webm' // Fallback
  }
}

// Convert blob to base64 for API calls
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64Data = base64.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// OpenAI Whisper API client (direct transcription)
class WhisperClient {
  private apiKey: string
  private language: string

  constructor(apiKey: string, language = 'en') {
    this.apiKey = apiKey
    this.language = language
  }

  async transcribe(audioBlob: Blob): Promise<TranscriptionResult> {
    const formData = new FormData()

    // Convert blob to file with proper extension
    const extension = this.getExtensionFromMimeType(audioBlob.type)
    const audioFile = new File([audioBlob], `audio.${extension}`, { type: audioBlob.type })

    formData.append('file', audioFile)
    formData.append('model', 'whisper-1')
    formData.append('language', this.language)
    formData.append('response_format', 'json')

    console.log('[Whisper] Sending audio to OpenAI')

    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[Whisper] API error:', error)
        throw new Error(`Transcription failed: ${response.status}`)
      }

      const result = await response.json()
      console.log('[Whisper] Transcription result:', result)

      return {
        text: result.text || '',
        duration: result.duration,
      }
    } catch (error) {
      console.error('[Whisper] Transcription error:', error)
      throw error
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    if (mimeType.includes('webm')) return 'webm'
    if (mimeType.includes('mp4')) return 'm4a'
    if (mimeType.includes('ogg')) return 'ogg'
    if (mimeType.includes('wav')) return 'wav'
    return 'webm'
  }
}

// OpenRouter Audio API client (uses chat completions with audio input)
class OpenRouterAudioClient {
  private apiKey: string
  private model: AudioModel
  private language: string

  constructor(apiKey: string, model: AudioModel = 'openai/gpt-audio-mini', language = 'en') {
    this.apiKey = apiKey
    this.model = model
    this.language = language
  }

  async transcribe(audioBlob: Blob): Promise<TranscriptionResult> {
    const mimeType = audioBlob.type || 'audio/webm'

    // For OpenRouter, always use Chat Completions with audio input
    // because they don't support the dedicated /audio/transcriptions endpoint yet.
    // Ensure we use a valid model for the chat endpoint
    const modelToUse = this.model.includes('whisper') ? 'openai/gpt-audio-mini' : this.model
    return this.transcribeWithChatEndpoint(audioBlob, mimeType, modelToUse)
  }


  private async transcribeWithChatEndpoint(audioBlob: Blob, _mimeType: string, modelToUse?: string): Promise<TranscriptionResult> {
    const audioBase64 = await blobToBase64(audioBlob)
    const model = modelToUse || this.model
    console.log('[OpenRouter] Sending audio to Chat endpoint:', model, 'format: opus (from webm)')

    // Chat models REQUIRE stream: true if audio modality is present
    const requestBody = {
      model: model,
      modalities: ['text', 'audio'],
      audio: { voice: 'alloy', format: 'pcm16' }, // 'wav' is not supported for streaming, 'pcm16' is
      stream: true, // MANDATORY for audio models
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: audioBase64,
                format: 'opus', // High-end models handle opus in containers well
              },
            },
            {
              type: 'text',
              text: `Transcribe this audio exactly. Output only the transcription, nothing else. Language: ${this.language}`,
            },
          ],
        },
      ],
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'ChefVoice Kiosk',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[OpenRouter] Chat API error:', response.status, error)
        throw new Error(`Chat transcription failed: ${response.status} - ${error}`)
      }

      // Handle streaming response to extract text
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let text = ''
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone

        if (value) {
          const chunk = decoder.decode(value, { stream: !done })
          const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'))

          for (const line of lines) {
            const dataString = line.replace(/^data: /, '').trim()
            if (dataString === '[DONE]') continue

            try {
              const parsed = JSON.parse(dataString)
              const delta = parsed.choices?.[0]?.delta

              // Handle standard content delta
              if (delta?.content) {
                text += typeof delta.content === 'string' ? delta.content : ''
              }
              // Handle gpt-audio transcript delta
              else if (delta?.audio?.transcript) {
                text += delta.audio.transcript
              }
              // Handle gpt-audio-mini specific transcript field if any
              else if (parsed.choices?.[0]?.message?.audio?.transcript) {
                text += parsed.choices[0].message.audio.transcript
              }
            } catch (e) { /* skip partial lines */ }
          }
        }
      }

      console.log('[OpenRouter] Chat transcription complete:', text)

      return {
        text: text.trim(),
      }
    } catch (error) {
      console.error('[OpenRouter] Chat error:', error)
      throw error
    }
  }

}

// Combined service for voice recognition
export class VoiceRecognitionService {
  private recorder: AudioRecorder
  private whisperClient: WhisperClient | null = null
  private openRouterClient: OpenRouterAudioClient | null = null
  private activeProvider: 'openai' | 'openrouter' | null = null
  private isInitialized = false

  constructor() {
    this.recorder = new AudioRecorder()
  }

  initialize(config: VoiceConfig): void {
    console.log('[VoiceService] Initializing with provider:', config.provider)
    console.log('[VoiceService] Model:', config.model || 'default')
    console.log('[VoiceService] Language:', config.language)
    
    if (config.provider === 'openai') {
      this.whisperClient = new WhisperClient(config.apiKey, config.language)
      this.activeProvider = 'openai'
      console.log('[VoiceService] ✅ Initialized with OpenAI Whisper')
    } else if (config.provider === 'openrouter') {
      this.openRouterClient = new OpenRouterAudioClient(
        config.apiKey,
        config.model || 'openai/gpt-audio-mini',
        config.language
      )
      this.activeProvider = 'openrouter'
      console.log('[VoiceService] ✅ Initialized with OpenRouter:', config.model)
    }
    this.isInitialized = true
  }

  get isConfigured(): boolean {
    return this.isInitialized && (this.whisperClient !== null || this.openRouterClient !== null)
  }

  get provider(): string | null {
    return this.activeProvider
  }

  get isRecording(): boolean {
    return this.recorder.isRecording
  }

  setOnSilenceDetected(callback: () => void, quickMode: boolean = false): void {
    this.recorder.setOnSilenceDetected(callback, quickMode)
  }

  async startRecording(): Promise<void> {
    console.log('[VoiceService] startRecording called')
    console.log('[VoiceService] isConfigured:', this.isConfigured)
    console.log('[VoiceService] activeProvider:', this.activeProvider)
    
    if (!this.isConfigured) {
      console.error('[VoiceService] Not configured!')
      throw new Error('Voice service not configured. Please set API key in Settings.')
    }
    console.log('[VoiceService] Starting AudioRecorder...')
    await this.recorder.start()
    console.log('[VoiceService] AudioRecorder started successfully')
  }

  async stopAndTranscribe(): Promise<string> {
    console.log('[VoiceService] stopAndTranscribe called')
    const audioBlob = await this.recorder.stop()
    console.log('[VoiceService] Audio blob size:', audioBlob.size, 'bytes')

    // Check if we have enough audio
    if (audioBlob.size < 1000) {
      console.log('[VoiceService] Audio too short, skipping transcription')
      return ''
    }

    // Use appropriate client
    console.log('[VoiceService] Using provider:', this.activeProvider)
    if (this.activeProvider === 'openai' && this.whisperClient) {
      console.log('[VoiceService] Sending to OpenAI Whisper...')
      const result = await this.whisperClient.transcribe(audioBlob)
      console.log('[VoiceService] OpenAI result:', result.text)
      return result.text
    } else if (this.activeProvider === 'openrouter' && this.openRouterClient) {
      console.log('[VoiceService] Sending to OpenRouter...')
      const result = await this.openRouterClient.transcribe(audioBlob)
      console.log('[VoiceService] OpenRouter result:', result.text)
      return result.text
    }

    throw new Error('No voice provider configured')
  }

  cancelRecording(): void {
    this.recorder.cancel()
  }
}

// Singleton instance
export const whisperService = new VoiceRecognitionService()
