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
    } catch (error) {
      console.error('[Voice] Failed to start recording:', error)
      throw new Error('Microphone access denied or unavailable')
    }
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
    // Convert audio to base64
    const audioBase64 = await blobToBase64(audioBlob)
    const mimeType = audioBlob.type || 'audio/webm'

    console.log('[OpenRouter] Sending audio to', this.model, 'format:', this.getAudioFormat(mimeType))

    // OpenRouter/OpenAI Audio models - we only want text output for transcription
    // Using just text modality to avoid streaming requirement for audio output
    const requestBody = {
      model: this.model,
      modalities: ['text'], // Only text output - avoids streaming requirement
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: audioBase64,
                format: this.getAudioFormat(mimeType),
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
          'X-Title': 'ChefKiosk Voice',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[OpenRouter] API error:', response.status, error)
        throw new Error(`Transcription failed: ${response.status} - ${error}`)
      }

      const result = await response.json()
      console.log('[OpenRouter] Response:', result)
      
      // Extract text from chat completion response
      // The response may have content as a string or as an array with audio parts
      const message = result.choices?.[0]?.message
      let text = ''
      
      if (typeof message?.content === 'string') {
        text = message.content
      } else if (Array.isArray(message?.content)) {
        // Find text content in array
        const textPart = message.content.find((p: any) => p.type === 'text')
        text = textPart?.text || ''
      }
      
      return {
        text: text.trim(),
      }
    } catch (error) {
      console.error('[OpenRouter] Transcription error:', error)
      throw error
    }
  }

  private getAudioFormat(mimeType: string): string {
    // OpenAI/OpenRouter expects specific format strings
    if (mimeType.includes('webm')) return 'webm'
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4'
    if (mimeType.includes('ogg')) return 'ogg'
    if (mimeType.includes('wav')) return 'wav'
    if (mimeType.includes('mp3')) return 'mp3'
    if (mimeType.includes('flac')) return 'flac'
    return 'webm'
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
    if (config.provider === 'openai') {
      this.whisperClient = new WhisperClient(config.apiKey, config.language)
      this.activeProvider = 'openai'
      console.log('[Voice] Initialized with OpenAI Whisper')
    } else if (config.provider === 'openrouter') {
      this.openRouterClient = new OpenRouterAudioClient(
        config.apiKey,
        config.model || 'openai/gpt-audio-mini',
        config.language
      )
      this.activeProvider = 'openrouter'
      console.log('[Voice] Initialized with OpenRouter', config.model)
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

  async startRecording(): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Voice service not configured. Please set API key in Settings.')
    }
    await this.recorder.start()
  }

  async stopAndTranscribe(): Promise<string> {
    const audioBlob = await this.recorder.stop()
    
    // Check if we have enough audio
    if (audioBlob.size < 1000) {
      console.log('[Voice] Audio too short, skipping transcription')
      return ''
    }

    // Use appropriate client
    if (this.activeProvider === 'openai' && this.whisperClient) {
      const result = await this.whisperClient.transcribe(audioBlob)
      return result.text
    } else if (this.activeProvider === 'openrouter' && this.openRouterClient) {
      const result = await this.openRouterClient.transcribe(audioBlob)
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
