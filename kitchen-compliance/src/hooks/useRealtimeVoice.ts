import { useCallback, useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/useAppStore'

const DEFAULT_REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17'
const DEFAULT_INACTIVITY_TIMEOUT_MS = 12000

interface UseRealtimeVoiceOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void
  onError?: (error: string) => void
  onEnd?: () => void
  autoStopOnFinal?: boolean
  inactivityTimeoutMs?: number
  keepConnectionAliveMs?: number
}

interface RealtimeSpeakOptions {
  onStart?: () => void
  onComplete?: () => void
}

interface RealtimeSessionResponse {
  model?: string
  client_secret?: {
    value?: string
  } | null
  error?: string
}

type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function extractEventText(event: Record<string, unknown>): string {
  const direct = asString(event.transcript) || asString(event.text) || asString(event.delta)
  if (direct) return direct

  const item = event.item as Record<string, unknown> | undefined
  const content = item?.content
  if (Array.isArray(content)) {
    const text = content
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return ''
        const payload = entry as Record<string, unknown>
        return asString(payload.text) || asString(payload.transcript)
      })
      .filter(Boolean)
      .join(' ')
      .trim()
    if (text) return text
  }

  return ''
}

export function useRealtimeVoice(options: UseRealtimeVoiceOptions = {}) {
  const {
    onTranscript,
    onError,
    onEnd,
    autoStopOnFinal = true,
    inactivityTimeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
    keepConnectionAliveMs = 0,
  } = options

  const { settings, currentSite } = useAppStore()

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('disconnected')
  const [isSpeaking, setIsSpeaking] = useState(false)

  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)
  const onEndRef = useRef(onEnd)
  const autoStopOnFinalRef = useRef(autoStopOnFinal)
  const inactivityTimeoutMsRef = useRef(inactivityTimeoutMs)
  const keepConnectionAliveMsRef = useRef(keepConnectionAliveMs)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const isListeningRef = useRef(false)
  const hasFinalRef = useRef(false)
  const lastInterimRef = useRef('')
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hardCleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectionPromiseRef = useRef<Promise<void> | null>(null)
  const assistantResponseQueueRef = useRef<Array<(() => void) | undefined>>([])

  const isSupported =
    typeof window !== 'undefined' &&
    typeof window.RTCPeerConnection !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    autoStopOnFinalRef.current = autoStopOnFinal
  }, [autoStopOnFinal])

  useEffect(() => {
    inactivityTimeoutMsRef.current = inactivityTimeoutMs
  }, [inactivityTimeoutMs])

  useEffect(() => {
    keepConnectionAliveMsRef.current = keepConnectionAliveMs
  }, [keepConnectionAliveMs])

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
  }, [])

  const clearHardCleanupTimer = useCallback(() => {
    if (hardCleanupTimerRef.current) {
      clearTimeout(hardCleanupTimerRef.current)
      hardCleanupTimerRef.current = null
    }
  }, [])

  const waitForDataChannelOpen = useCallback(async (timeoutMs = 5000) => {
    const channel = dataChannelRef.current
    if (!channel) {
      throw new Error('Realtime channel is not connected')
    }

    if (channel.readyState === 'open') {
      return
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Realtime channel open timeout'))
      }, timeoutMs)

      const handleOpen = () => {
        cleanup()
        resolve()
      }

      const handleFail = () => {
        cleanup()
        reject(new Error('Realtime channel closed before opening'))
      }

      const cleanup = () => {
        clearTimeout(timeout)
        channel.removeEventListener('open', handleOpen)
        channel.removeEventListener('close', handleFail)
        channel.removeEventListener('error', handleFail)
      }

      channel.addEventListener('open', handleOpen)
      channel.addEventListener('close', handleFail)
      channel.addEventListener('error', handleFail)
    })
  }, [])

  const setInputEnabled = useCallback((enabled: boolean) => {
    const stream = mediaStreamRef.current
    if (!stream) return
    stream.getAudioTracks().forEach((track) => {
      track.enabled = enabled
    })
  }, [])

  const cleanupConnection = useCallback(
    (emitEnd: boolean) => {
      clearInactivityTimer()
      clearHardCleanupTimer()

      const dataChannel = dataChannelRef.current
      if (dataChannel && dataChannel.readyState !== 'closed') {
        try {
          dataChannel.close()
        } catch {
          // no-op
        }
      }
      dataChannelRef.current = null

      const peerConnection = peerConnectionRef.current
      if (peerConnection) {
        try {
          peerConnection.close()
        } catch {
          // no-op
        }
      }
      peerConnectionRef.current = null

      const stream = mediaStreamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      mediaStreamRef.current = null
      connectionPromiseRef.current = null
      assistantResponseQueueRef.current = []

      isListeningRef.current = false
      setIsListening(false)
      setIsSpeaking(false)
      setConnectionState('disconnected')

      if (emitEnd) {
        onEndRef.current?.()
      }
    },
    [clearInactivityTimer, clearHardCleanupTimer]
  )

  const pauseListening = useCallback(
    (emitEnd: boolean) => {
      clearInactivityTimer()
      assistantResponseQueueRef.current = []
      setInputEnabled(false)
      isListeningRef.current = false
      setIsListening(false)
      setIsSpeaking(false)
      if (emitEnd) {
        onEndRef.current?.()
      }
    },
    [clearInactivityTimer, setInputEnabled]
  )

  const scheduleHardCleanup = useCallback(() => {
    const keepAliveMs = keepConnectionAliveMsRef.current
    if (keepAliveMs <= 0) return
    clearHardCleanupTimer()
    hardCleanupTimerRef.current = setTimeout(() => {
      // Hard cleanup while idle should not emit onEnd again.
      cleanupConnection(false)
    }, keepAliveMs)
  }, [cleanupConnection, clearHardCleanupTimer])

  const hasWarmConnection = useCallback((): boolean => {
    const pc = peerConnectionRef.current
    const dc = dataChannelRef.current
    const stream = mediaStreamRef.current
    if (!pc || !dc || !stream) return false
    if (pc.connectionState === 'closed' || pc.connectionState === 'failed') return false
    if (dc.readyState !== 'open') return false
    return stream.getAudioTracks().length > 0
  }, [])

  const stopListening = useCallback(() => {
    if (!hasFinalRef.current) {
      const flushed = lastInterimRef.current.trim()
      if (flushed) {
        setTranscript(flushed)
        setInterimTranscript('')
        onTranscriptRef.current?.(flushed, true)
        hasFinalRef.current = true
      }
    }
    if (keepConnectionAliveMsRef.current > 0 && hasWarmConnection()) {
      pauseListening(true)
      scheduleHardCleanup()
      return
    }
    cleanupConnection(true)
  }, [cleanupConnection, hasWarmConnection, pauseListening, scheduleHardCleanup])

  const resetInactivityTimeout = useCallback(() => {
    const timeoutMs = inactivityTimeoutMsRef.current
    clearInactivityTimer()
    inactivityTimerRef.current = setTimeout(() => {
      if (!isListeningRef.current || hasFinalRef.current) return
      const message = 'No speech detected. Please try again.'
      setError(message)
      onErrorRef.current?.(message)
      if (keepConnectionAliveMsRef.current > 0 && hasWarmConnection()) {
        pauseListening(true)
        scheduleHardCleanup()
      } else {
        cleanupConnection(true)
      }
    }, timeoutMs)
  }, [
    clearInactivityTimer,
    cleanupConnection,
    hasWarmConnection,
    pauseListening,
    scheduleHardCleanup,
  ])

  const getAccessToken = useCallback(async (): Promise<string> => {
    const { data: initialSession } = await supabase.auth.getSession()
    if (initialSession.session?.access_token) {
      return initialSession.session.access_token
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error('Unauthorized')
    }

    return refreshed.session.access_token
  }, [])

  const fetchRealtimeSession = useCallback(
    async (accessToken: string): Promise<Response> => {
      return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'realtime_session',
          model: DEFAULT_REALTIME_MODEL,
          language: settings.language || 'en',
          site_id: currentSite?.id || null,
        }),
      })
    },
    [currentSite?.id, settings.language]
  )

  const ensureRealtimeConnection = useCallback(async () => {
    if (hasWarmConnection()) {
      setConnectionState('connected')
      return
    }

    if (connectionPromiseRef.current) {
      await connectionPromiseRef.current
      return
    }

    if (peerConnectionRef.current || dataChannelRef.current || mediaStreamRef.current) {
      cleanupConnection(false)
    }

    setConnectionState('connecting')

    const connectPromise = (async () => {
      let accessToken = await getAccessToken()
      let sessionResponse = await fetchRealtimeSession(accessToken)
      let sessionData = (await sessionResponse.json().catch(() => ({}))) as RealtimeSessionResponse

      if (!sessionResponse.ok && sessionResponse.status === 401) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError || !refreshed.session?.access_token) {
          throw new Error('Unauthorized')
        }

        accessToken = refreshed.session.access_token
        sessionResponse = await fetchRealtimeSession(accessToken)
        sessionData = (await sessionResponse.json().catch(() => ({}))) as RealtimeSessionResponse
      }

      if (!sessionResponse.ok) {
        if (sessionResponse.status === 401) throw new Error('Unauthorized')
        throw new Error(sessionData.error || `Realtime session failed (${sessionResponse.status})`)
      }

      const ephemeralKey = sessionData.client_secret?.value
      if (!ephemeralKey) {
        throw new Error('Realtime session token missing')
      }

      const model = sessionData.model || DEFAULT_REALTIME_MODEL

      const peerConnection = new RTCPeerConnection()
      peerConnectionRef.current = peerConnection

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState
        if (state === 'connected') {
          setConnectionState('connected')
        } else if (state === 'new' || state === 'connecting') {
          setConnectionState('connecting')
        }
        if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          cleanupConnection(isListeningRef.current)
        }
      }

      const eventChannel = peerConnection.createDataChannel('oai-events')
      dataChannelRef.current = eventChannel

      eventChannel.onopen = () => {
        setConnectionState('connected')
        if (isListeningRef.current) {
          resetInactivityTimeout()
        }
      }

      eventChannel.onmessage = (messageEvent) => {
        let event: Record<string, unknown>
        try {
          event = JSON.parse(messageEvent.data) as Record<string, unknown>
        } catch {
          return
        }

        const type = asString(event.type)
        if (!type) return

        if (type === 'error') {
          const details = event.error as Record<string, unknown> | undefined
          const message = asString(details?.message) || 'Realtime voice error'
          setError(message)
          setIsSpeaking(false)
          onErrorRef.current?.(message)
          cleanupConnection(isListeningRef.current)
          return
        }

        if (type === 'response.done') {
          const next = assistantResponseQueueRef.current.shift()
          if (assistantResponseQueueRef.current.length === 0) {
            setIsSpeaking(false)
          }
          if (isListeningRef.current) {
            setInputEnabled(true)
            resetInactivityTimeout()
          }
          next?.()
          return
        }

        if (!isListeningRef.current) {
          return
        }

        if (type === 'input_audio_buffer.speech_started') {
          resetInactivityTimeout()
          return
        }

        if (type === 'conversation.item.input_audio_transcription.delta') {
          const text = extractEventText(event)
          if (!text) return
          lastInterimRef.current = text
          setInterimTranscript(text)
          onTranscriptRef.current?.(text, false)
          resetInactivityTimeout()
          return
        }

        if (type === 'conversation.item.input_audio_transcription.completed') {
          const text = extractEventText(event).trim()
          if (!text) return
          hasFinalRef.current = true
          lastInterimRef.current = ''
          setTranscript(text)
          setInterimTranscript('')
          onTranscriptRef.current?.(text, true)
          if (autoStopOnFinalRef.current) {
            if (keepConnectionAliveMsRef.current > 0) {
              pauseListening(true)
              scheduleHardCleanup()
            } else {
              cleanupConnection(true)
            }
          } else {
            resetInactivityTimeout()
          }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000,
        },
      })
      mediaStreamRef.current = stream
      setInputEnabled(false)

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream)
      })

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      const webRtcCallsUrl = `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`
      let sdpResponse = await fetch(webRtcCallsUrl, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'OpenAI-Beta': 'realtime=v1',
          'Content-Type': 'application/sdp',
        },
      })

      if (!sdpResponse.ok && (sdpResponse.status === 404 || sdpResponse.status === 405)) {
        sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            'OpenAI-Beta': 'realtime=v1',
            'Content-Type': 'application/sdp',
          },
        })
      }

      if (!sdpResponse.ok) {
        const details = await sdpResponse.text()
        throw new Error(`Failed to connect realtime session: ${details || sdpResponse.statusText}`)
      }

      const answerSdp = await sdpResponse.text()
      await peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      })

      await waitForDataChannelOpen()
    })()

    connectionPromiseRef.current = connectPromise
    try {
      await connectPromise
    } catch (err) {
      cleanupConnection(false)
      throw err
    } finally {
      connectionPromiseRef.current = null
    }
  }, [
    cleanupConnection,
    fetchRealtimeSession,
    getAccessToken,
    hasWarmConnection,
    pauseListening,
    resetInactivityTimeout,
    scheduleHardCleanup,
    setInputEnabled,
    waitForDataChannelOpen,
  ])

  const speakText = useCallback(
    async (text: string, options: RealtimeSpeakOptions = {}): Promise<boolean> => {
      const spokenText = text.trim()
      if (!spokenText) {
        options.onComplete?.()
        return true
      }

      if (!isSupported || !isSupabaseConfigured()) {
        return false
      }

      clearHardCleanupTimer()
      setError(null)

      try {
        await ensureRealtimeConnection()
        await waitForDataChannelOpen()
        const dataChannel = dataChannelRef.current

        if (!dataChannel || dataChannel.readyState !== 'open') {
          throw new Error('Realtime channel is not connected')
        }

        options.onStart?.()
        assistantResponseQueueRef.current.push(options.onComplete)
        setIsSpeaking(true)

        if (isListeningRef.current) {
          setInputEnabled(false)
        }

        dataChannel.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['audio', 'text'],
              temperature: 0.8,
              instructions: `Say exactly this phrase to kitchen staff, without adding any extra words: ${spokenText}`,
            },
          })
        )

        if (!isListeningRef.current && keepConnectionAliveMsRef.current > 0) {
          scheduleHardCleanup()
        }

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to speak via realtime voice'
        setError(message)
        setIsSpeaking(false)
        onErrorRef.current?.(message)
        return false
      }
    },
    [
      clearHardCleanupTimer,
      ensureRealtimeConnection,
      isSupported,
      scheduleHardCleanup,
      setInputEnabled,
      waitForDataChannelOpen,
    ]
  )

  const prepareSession = useCallback(async () => {
    if (!isSupported || !isSupabaseConfigured()) return
    if (isListeningRef.current) return

    clearHardCleanupTimer()
    setError(null)

    try {
      await ensureRealtimeConnection()
      await waitForDataChannelOpen()
      setInputEnabled(false)
      if (keepConnectionAliveMsRef.current > 0) {
        scheduleHardCleanup()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to prepare realtime voice'
      setError(message)
      onErrorRef.current?.(message)
    }
  }, [
    clearHardCleanupTimer,
    ensureRealtimeConnection,
    isSupported,
    scheduleHardCleanup,
    setInputEnabled,
    waitForDataChannelOpen,
  ])

  const startListening = useCallback(async () => {
    if (!isSupported) {
      const message = 'Realtime voice is not supported in this browser.'
      setError(message)
      onErrorRef.current?.(message)
      return
    }

    if (!isSupabaseConfigured()) {
      const message = 'Supabase is not configured.'
      setError(message)
      onErrorRef.current?.(message)
      return
    }

    if (isListeningRef.current) {
      return
    }

    clearHardCleanupTimer()

    setTranscript('')
    setInterimTranscript('')
    setError(null)
    hasFinalRef.current = false
    lastInterimRef.current = ''
    isListeningRef.current = true
    setIsListening(true)

    try {
      await ensureRealtimeConnection()
      await waitForDataChannelOpen()
      setInputEnabled(true)
      resetInactivityTimeout()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start realtime voice'
      setError(message)
      onErrorRef.current?.(message)
      cleanupConnection(false)
    }
  }, [
    cleanupConnection,
    clearHardCleanupTimer,
    ensureRealtimeConnection,
    isSupported,
    resetInactivityTimeout,
    setInputEnabled,
    waitForDataChannelOpen,
  ])

  useEffect(() => {
    return () => {
      cleanupConnection(false)
    }
  }, [cleanupConnection])

  return {
    isSupported,
    isListening,
    isSpeaking,
    isConnecting: connectionState === 'connecting',
    connectionState,
    transcript,
    interimTranscript,
    error,
    prepareSession,
    speakText,
    startListening,
    stopListening,
  }
}
