/**
 * Voice Recognition Service
 * 
 * All AI transcription is proxied through the Supabase Edge Function `ai-proxy`.
 * API keys are stored server-side as Supabase secrets — never exposed to the client.
 * 
 * Supports:
 * - OpenAI Whisper (via Edge Function)
 * - Browser Speech Recognition (free, no API key needed)
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase'

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
    let heardSpeech = false

    const checkSilence = () => {
      if (!this.isRecording) {
        audioContext.close()
        return
      }

      analyser.getByteFrequencyData(dataArray)
      const volume = dataArray.reduce((a, b) => a + b) / bufferLength

      // Threshold for silence (very low amplitude)
      //
      // IMPORTANT: only start the "post-speech" silence timer after we have heard
      // non-trivial audio. Otherwise quickResponseMode would auto-stop before the user
      // even answers (initial silence).
      const SILENCE_THRESHOLD = 5 // Tuned for kitchen background noise
      if (volume >= SILENCE_THRESHOLD) {
        heardSpeech = true
      }

      if (heardSpeech && volume < SILENCE_THRESHOLD) {
        if (!this.silenceTimer) {
          // Quick answers (staff code / temperature) still need enough time for
          // pauses like "one point five", so keep this conservative.
          const silenceDelay = this.quickResponseMode ? 900 : 1200
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

/**
 * Transcribe audio via the ai-proxy Edge Function.
 * No API keys needed on the client — server-side secrets are used.
 */
async function transcribeViaEdgeFunction(
  audioBlob: Blob,
  language: string = 'en',
  siteId?: string
): Promise<TranscriptionResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured')
  }

  const audioBase64 = await blobToBase64(audioBlob)
  console.log('[Voice] Sending audio to Edge Function for transcription')

  const requestBody = {
    action: 'transcribe',
    audio_base64: audioBase64,
    mime_type: audioBlob.type || 'audio/webm',
    language,
    site_id: siteId || null,
  }

  const invokeProxy = async (accessToken: string): Promise<{ data: any; error: unknown }> => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const responseData = await response.json().catch(() => ({}))
      if (!response.ok) {
        return {
          data: null,
          error: {
            status: response.status,
            statusCode: response.status,
            context: { status: response.status },
            message: responseData?.error || response.statusText || 'Request failed',
            details: responseData,
          },
        }
      }

      return { data: responseData, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const getHttpStatus = (error: unknown): number | null => {
    const maybeStatus =
      (error as any)?.context?.status ??
      (error as any)?.status ??
      (error as any)?.statusCode
    if (typeof maybeStatus === 'number') {
      return maybeStatus
    }
    return null
  }

  const getAccessToken = async (): Promise<string> => {
    const { data: initialSession } = await supabase.auth.getSession()
    if (initialSession.session?.access_token) {
      return initialSession.session.access_token
    }

    // Kiosk tabs can wake up with stale in-memory auth. Try one refresh.
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error('Unauthorized')
    }
    return refreshed.session.access_token
  }

  let accessToken = await getAccessToken()
  let { data: result, error } = await invokeProxy(accessToken)

  // Retry once if function gateway rejected JWT.
  const status = getHttpStatus(error)
  if (status === 401) {
    console.warn('[Voice] Edge Function returned 401. Refreshing session and retrying once...')
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError && refreshed.session?.access_token) {
      accessToken = refreshed.session.access_token
      const retry = await invokeProxy(accessToken)
      result = retry.data
      error = retry.error
    }
  }

  if (error) {
    const finalStatus = getHttpStatus(error)
    console.error('[Voice] Edge Function error:', { status: finalStatus, error })
    if (finalStatus === 401) {
      throw new Error('Unauthorized')
    }
    throw new Error(`Transcription failed${finalStatus ? `: ${finalStatus}` : ''}`)
  }

  console.log('[Voice] Transcription result:', result.text)

  return {
    text: result.text || '',
    duration: result.duration,
  }
}

// Combined service for voice recognition
export class VoiceRecognitionService {
  private recorder: AudioRecorder
  private language: string = 'en'
  private siteId: string | null = null
  private _isConfigured = false

  constructor() {
    this.recorder = new AudioRecorder()
  }

  /**
   * Initialize the service. No API key needed — the Edge Function handles that.
   */
  initialize(config: { language?: string; siteId?: string }): void {
    console.log('[VoiceService] Initializing (server-side AI)')
    this.language = config.language || 'en'
    this.siteId = config.siteId || null
    this._isConfigured = true
    console.log('[VoiceService] ✅ Ready — transcription via Edge Function')
  }

  get isConfigured(): boolean {
    return this._isConfigured
  }

  get provider(): string {
    return 'whisper-edge'
  }

  get isRecording(): boolean {
    return this.recorder.isRecording
  }

  setOnSilenceDetected(callback: () => void, quickMode: boolean = false): void {
    this.recorder.setOnSilenceDetected(callback, quickMode)
  }

  async startRecording(): Promise<void> {
    console.log('[VoiceService] startRecording called')

    if (!this._isConfigured) {
      console.error('[VoiceService] Not configured!')
      throw new Error('Voice service not configured. Call initialize() first.')
    }
    await this.recorder.start()
    console.log('[VoiceService] AudioRecorder started successfully')
  }

  async stopAndTranscribe(): Promise<string> {
    console.log('[VoiceService] stopAndTranscribe called')
    const audioBlob = await this.recorder.stop()
    console.log('[VoiceService] Audio blob size:', audioBlob.size, 'bytes')

    // Check if we have enough audio
    // Note: some devices/browsers produce very small blobs for short answers
    // (e.g., "one"). Keep the threshold low so we still attempt transcription.
    if (audioBlob.size < 200) {
      console.log('[VoiceService] Audio too short, skipping transcription')
      return ''
    }

    const result = await transcribeViaEdgeFunction(
      audioBlob,
      this.language,
      this.siteId || undefined
    )
    return result.text
  }

  cancelRecording(): void {
    this.recorder.cancel()
  }
}

// Singleton instance
export const whisperService = new VoiceRecognitionService()
