import { useCallback, useEffect, useImperativeHandle, forwardRef, useMemo, useRef } from 'react'
import { Mic, MicOff, Volume2, Loader2, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTextToSpeech } from '@/hooks/useVoiceRecognition'
import { useWhisperVoice } from '@/hooks/useWhisperVoice'
import { useBrowserSpeech } from '@/hooks/useBrowserSpeech'
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice'
import { useAppStoreShallow } from '@/store/useAppStore'
import type { VoiceCommand } from '@/types'
import { getVoiceFeedback, parseVoiceCommand } from '@/lib/voiceCommands'

export interface VoiceButtonHandle {
  triggerVoice: () => void
  stopVoice: () => void
  speakText: (text: string, options?: { onStart?: () => void; onComplete?: () => void; rate?: number; pitch?: number; preferRealtime?: boolean }) => boolean
  /** True when conversation mode is using Realtime API (mic stays open, no triggerVoice needed after TTS) */
  isRealtimeConversation: boolean
}

export type VoiceInteractionState =
  | 'idle'
  | 'wake_ready'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'flow_active'
  | 'error'

interface VoiceButtonProps {
  onCommand: (command: VoiceCommand) => void
  onTranscript?: (transcript: string) => void
  onInterimTranscript?: (transcript: string) => void // Called with interim (partial) transcripts for early detection
  onEnd?: () => void
  onInteractionStateChange?: (state: VoiceInteractionState, detail?: string) => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
  wakeWordActive?: boolean
  wakeWordTriggered?: boolean
  wakeWordTriggerToken?: number
  wakeWordLabel?: string // e.g. "Hey Luma" for display
  conversationMode?: boolean // Force browser speech for conversation flows
  quickResponseMode?: boolean // When true, use shorter silence timeout (for staff code, temperature)
}

export const VoiceButton = forwardRef<VoiceButtonHandle, VoiceButtonProps>(
  function VoiceButton(
    {
      onCommand,
      onTranscript,
      onInterimTranscript,
      onEnd,
      onInteractionStateChange,
      className,
      size = 'lg',
      wakeWordActive = false,
      wakeWordTriggered = false,
      wakeWordTriggerToken = 0,
      wakeWordLabel = 'Hey Luma',
      conversationMode = false,
      quickResponseMode = false,
    },
    ref
  ) {
    const { speak } = useTextToSpeech()
    const { voiceProvider, updateSettings } = useAppStoreShallow((state) => ({
      voiceProvider: state.settings.voiceProvider,
      updateSettings: state.updateSettings,
    }))
    const wasVoiceActiveRef = useRef(false)
    const wakeWordTriggerConsumedRef = useRef(false)
    const lastWakeWordTriggerTokenRef = useRef(0)

    // Provider selection
    // In conversation mode, always force Realtime for full-duplex interaction
    // (wake word + commands stay on free browser speech)
    const realtimeIsSupported =
      typeof window !== 'undefined' &&
      typeof RTCPeerConnection !== 'undefined'
    const useRealtimeForConversation = conversationMode && realtimeIsSupported
    const useRealtime = useRealtimeForConversation || voiceProvider === 'realtime'
    // Use Whisper (via Edge Function) when selected — no API key needed client-side
    const useWhisper = !useRealtimeForConversation && voiceProvider === 'whisper'
    const providerLabel = useRealtimeForConversation
      ? 'Realtime (Conversation)'
      : useWhisper
        ? 'Whisper (Edge Function)'
        : useRealtime
          ? 'Realtime (OpenAI)'
          : 'Browser'

    // Handle command with voice feedback - defined early so hooks can use it
    const handleCommand = useCallback((command: VoiceCommand) => {
      // CRITICAL: In conversation mode, ignore all commands (user is answering questions)
      if (conversationMode) {
        return
      }

      if (command.type === 'noise' || command.type === 'unknown') {
        return
      }

      // Give voice feedback for commands, EXCEPT for stop_cooling and log_fridge_temp (the flows will speak)
      if (command.type !== 'stop_cooling' && command.type !== 'log_fridge_temp') {
        const feedback = getVoiceFeedback(command)
        if (feedback) {
          speak(feedback)
        }
      }

      onCommand(command)
    }, [onCommand, speak, conversationMode])

    // Handle when voice ends (for wake word resume)
    const handleEnd = useCallback(() => {
      onEnd?.()
    }, [onEnd])

    // Single browser speech hook for both command + conversation modes.
    // Important: browserSpeechService is singleton-based, so we must keep one subscriber.
    const browserVoice = useBrowserSpeech({
      onTranscript: (text, isFinal) => {
        if (conversationMode) {
          if (isFinal) {
            onTranscript?.(text)
          } else {
            onInterimTranscript?.(text)
          }
          return
        }

        if (isFinal) {
          onTranscript?.(text)
          const command = parseVoiceCommand(text)
          handleCommand(command)
        } else {
          onInterimTranscript?.(text)
        }
      },
      onError: (err) => {
        console.error(conversationMode ? '[BrowserConversation] Error:' : '[BrowserCommand] Error:', err)
      },
      onEnd: handleEnd,
      // Continuous mode is more resilient for interview flows on noisy devices.
      continuous: conversationMode || useRealtime,
      silenceTimeout: conversationMode ? 6000 : useRealtime ? 2600 : 4500,
      // Conversation answers (staff code/temp) can be slightly longer ("one point five"),
      // so allow more time after speech is detected.
      postSpeechTimeout: conversationMode ? 1800 : useRealtime ? 850 : 1300,
      // In conversation mode, never stall the flow waiting for a final result that may never come.
      flushInterimAsFinalOnEnd: conversationMode || useRealtime,
      // Also ensure "no-speech" doesn't stall the interview; let the flow prompt retries.
      emitEmptyFinalOnNoSpeech: conversationMode || useRealtime,
    })

    // Whisper API hook - use for both command and conversation modes when API key available
    const whisperVoice = useWhisperVoice({
      disabled: !useWhisper, // Use Whisper when API key is available
      onCommand: conversationMode ? undefined : handleCommand, // Parse commands only in command mode
      onTranscript: onTranscript, // Always transcribe
      quickResponseMode: quickResponseMode, // Use shorter silence timeout for staff code/temperature
      onError: (err) => {
        const lower = String(err || '').toLowerCase()
        const isAuthError =
          lower.includes('401') ||
          lower.includes('unauthorized') ||
          lower.includes('not authenticated')

        if (isAuthError && voiceProvider === 'whisper') {
          console.warn('[VoiceButton] Whisper auth failed; falling back to realtime voice provider')
          updateSettings({ voiceProvider: 'realtime' })
          speak('Whisper is unavailable. Switching to realtime voice mode.')
          return
        }

        handleEnd()
      },
    })

    const realtimeVoice = useRealtimeVoice({
      onTranscript: (text, isFinal) => {
        if (conversationMode) {
          if (isFinal) {
            onTranscript?.(text)
          } else {
            onInterimTranscript?.(text)
          }
          return
        }

        if (isFinal) {
          onTranscript?.(text)
          const command = parseVoiceCommand(text)
          handleCommand(command)
        } else {
          onInterimTranscript?.(text)
        }
      },
      onError: (err) => {
        console.error('[RealtimeVoice] Error:', err)
      },
      autoStopOnFinal: !conversationMode,
      inactivityTimeoutMs: conversationMode ? 60000 : 7000,
      keepConnectionAliveMs: conversationMode ? 120000 : 120000,
    })

    const realtimeIsConnecting = useRealtime ? realtimeVoice.isConnecting : false
    const realtimeIsSpeaking = useRealtime ? realtimeVoice.isSpeaking : false

    // Select active voice provider and normalize interface
    let isSupported: boolean
    let isListening: boolean
    let transcript: string
    let error: string | null
    let startListening: () => void
    let stopListening: () => void

    if (useWhisper) {
      // Whisper API mode (for both command and conversation)
      isSupported = whisperVoice.isSupported
      isListening = whisperVoice.isListening
      transcript = whisperVoice.transcript
      error = whisperVoice.error
      startListening = whisperVoice.startListening
      stopListening = whisperVoice.stopListening
    } else if (useRealtime) {
      isSupported = realtimeVoice.isSupported
      isListening = realtimeVoice.isListening
      transcript = realtimeVoice.transcript
      error = realtimeVoice.error
      startListening = realtimeVoice.startListening
      stopListening = realtimeVoice.stopListening
    } else {
      // Browser speech mode (command or conversation depending on prop)
      isSupported = browserVoice.isSupported
      isListening = browserVoice.isListening
      transcript = browserVoice.transcript
      error = browserVoice.error
      startListening = browserVoice.startListening
      stopListening = browserVoice.stopListening
    }

    const toggleListening = useCallback(() => {
      if (isListening) {
        stopListening()
      } else {
        startListening()
      }
    }, [isListening, startListening, stopListening])

    // Whisper has additional processing state
    const isProcessing = useWhisper ? whisperVoice.isProcessing : false

    // Expose triggerVoice and stopVoice methods via ref
    useImperativeHandle(ref, () => ({
      triggerVoice: () => {
        if (!isProcessing && !realtimeIsConnecting && !isListening) {
          if (startListening) {
            startListening()
          } else {
            toggleListening()
          }
        }
      },
      stopVoice: () => {
        if (stopListening) {
          stopListening()
        }
      },
      speakText: (text, options = {}) => {
        let started = false
        const startOnce = () => {
          if (started) return
          started = true
          options.onStart?.()
        }

        let completed = false
        const completeOnce = () => {
          if (completed) return
          completed = true
          options.onComplete?.()
        }

        const shouldRealtime = useRealtime || !!options.preferRealtime

        if (shouldRealtime) {
          void realtimeVoice.speakText?.(text, {
            onStart: startOnce,
            onComplete: completeOnce,
          }).then((ok) => {
            if (ok) return
            startOnce()
            speak(text, {
              rate: options.rate,
              pitch: options.pitch,
              onComplete: completeOnce,
            })
          })
          return true
        }

        speak(text, {
          rate: options.rate,
          pitch: options.pitch,
          onComplete: completeOnce,
        })
        return false
      },
      isRealtimeConversation: useRealtimeForConversation,
    }), [
      conversationMode,
      isListening,
      isProcessing,
      realtimeIsConnecting,
      realtimeVoice.speakText,
      speak,
      startListening,
      stopListening,
      toggleListening,
      useRealtime,
      useRealtimeForConversation,
      useWhisper,
    ])

    const triggerFromWakeWord = useCallback(() => {
      if (isListening || isProcessing || realtimeIsConnecting) {
        return
      }
      if (startListening) {
        startListening()
      } else {
        toggleListening()
      }
    }, [isListening, isProcessing, realtimeIsConnecting, startListening, toggleListening])

    // Auto-trigger when wake word is triggered (legacy boolean support)
    useEffect(() => {
      if (!wakeWordTriggered) {
        wakeWordTriggerConsumedRef.current = false
        return
      }

      if (wakeWordTriggerConsumedRef.current) {
        return
      }

      wakeWordTriggerConsumedRef.current = true
      triggerFromWakeWord()
    }, [wakeWordTriggered, triggerFromWakeWord])

    // Preferred wake-word trigger mechanism: incrementing token (one-shot, no sticky booleans).
    useEffect(() => {
      if (!wakeWordTriggerToken) return
      if (wakeWordTriggerToken === lastWakeWordTriggerTokenRef.current) return
      lastWakeWordTriggerTokenRef.current = wakeWordTriggerToken
      triggerFromWakeWord()
    }, [triggerFromWakeWord, wakeWordTriggerToken])

    // If conversation mode ended, ensure continuous realtime capture is stopped
    // so wake-word listening can resume cleanly.
    const wasConversationModeRef = useRef(conversationMode)
    useEffect(() => {
      if (
        wasConversationModeRef.current &&
        !conversationMode
      ) {
        // Flow just ended — stop all providers and disconnect Realtime
        if (isListening) {
          stopListening()
        }
        // Also ensure Realtime is fully disconnected
        if (realtimeVoice.isListening || realtimeVoice.isSpeaking) {
          realtimeVoice.stopListening()
        }
      }
      wasConversationModeRef.current = conversationMode
    }, [conversationMode, isListening, stopListening, realtimeVoice.isListening, realtimeVoice.isSpeaking, realtimeVoice.stopListening])

    // Pre-warm realtime session when conversation flow starts, so the first answer opens instantly.
    useEffect(() => {
      if (!useRealtime || !conversationMode) return
      void realtimeVoice.prepareSession?.()
    }, [useRealtime, conversationMode, realtimeVoice.prepareSession])

    // Call onEnd only on active -> idle transition.
    // Prevents repeated "Voice ended" loops while already idle.
    useEffect(() => {
      const isActiveNow = isListening || isProcessing || realtimeIsConnecting || realtimeIsSpeaking

      if (isActiveNow) {
        wasVoiceActiveRef.current = true
        return
      }

      if (wasVoiceActiveRef.current) {
        wasVoiceActiveRef.current = false
        const timeout = setTimeout(() => {
          handleEnd()
        }, conversationMode ? 0 : transcript ? 500 : 200)
        return () => clearTimeout(timeout)
      }
    }, [conversationMode, isListening, isProcessing, realtimeIsConnecting, realtimeIsSpeaking, transcript, handleEnd])

    const interaction = useMemo((): { state: VoiceInteractionState; detail?: string } => {
      if (error && !isListening && !isProcessing) {
        return { state: 'error', detail: error }
      }

      if (isProcessing) {
        return { state: 'processing', detail: 'Processing transcript...' }
      }

      if (realtimeIsConnecting) {
        return { state: 'connecting', detail: 'Connecting to realtime...' }
      }

      if (realtimeIsSpeaking) {
        return { state: 'speaking', detail: 'Assistant speaking...' }
      }

      if (isListening) {
        if (conversationMode) {
          return { state: 'flow_active', detail: 'Listening for your answer...' }
        }
        return { state: 'listening', detail: 'Listening for command...' }
      }

      if (conversationMode) {
        return { state: 'flow_active', detail: 'Voice flow active' }
      }

      if (wakeWordActive) {
        return { state: 'wake_ready', detail: `Say "${wakeWordLabel}"` }
      }

      return { state: 'idle', detail: useRealtime ? 'Realtime ready' : useWhisper ? 'Whisper ready' : 'Tap to speak' }
    }, [
      conversationMode,
      error,
      isListening,
      isProcessing,
      realtimeIsConnecting,
      realtimeIsSpeaking,
      useRealtime,
      useWhisper,
      wakeWordActive,
      wakeWordLabel,
    ])

    useEffect(() => {
      onInteractionStateChange?.(interaction.state, interaction.detail)
    }, [interaction.detail, interaction.state, onInteractionStateChange])

    const sizeClasses = {
      sm: 'w-12 h-12',
      md: 'w-20 h-20',
      lg: 'w-28 h-28',
    }

    const iconSizes = {
      sm: 'w-6 h-6',
      md: 'w-10 h-10',
      lg: 'w-14 h-14',
    }

    if (!isSupported && !useWhisper) {
      return (
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-2 text-theme-muted',
            className
          )}
        >
          <MicOff className={iconSizes[size]} />
          {size !== 'sm' && <span className="text-sm">Voice not supported</span>}
        </div>
      )
    }

    // Compact mode for small size - just button, no status text
    if (size === 'sm') {
      return (
        <div className="relative">
          <button
            onClick={toggleListening}
            disabled={isProcessing || realtimeIsConnecting}
            className={cn(
              'voice-button rounded-full flex items-center justify-center transition-all duration-200',
              sizeClasses[size],
              isProcessing || realtimeIsConnecting
                ? 'bg-purple-500 shadow-lg shadow-purple-500/50'
                : realtimeIsSpeaking
                  ? 'bg-amber-500 shadow-lg shadow-amber-500/50'
                : isListening
                  ? 'voice-listening bg-green-500 shadow-lg shadow-green-500/50'
                  : wakeWordActive
                    ? 'bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-lg shadow-rose-500/30'
                    : 'bg-purple-500 hover:bg-purple-600 shadow-lg shadow-purple-500/30',
              'active:scale-95 disabled:opacity-50',
              className
            )}
            aria-label={isListening ? 'Stop listening' : 'Start voice command'}
          >
            {isProcessing || realtimeIsConnecting ? (
              <Loader2 className={cn(iconSizes[size], 'text-white animate-spin')} />
            ) : realtimeIsSpeaking ? (
              <Volume2 className={cn(iconSizes[size], 'text-white animate-pulse')} />
            ) : isListening ? (
              <Volume2 className={cn(iconSizes[size], 'text-white animate-pulse')} />
            ) : wakeWordActive ? (
              <Radio className={cn(iconSizes[size], 'text-white animate-pulse')} />
            ) : (
              <Mic className={cn(iconSizes[size], 'text-white')} />
            )}
          </button>
          {/* Wake word indicator dot */}
          {wakeWordActive && !isListening && !isProcessing && !realtimeIsConnecting && !realtimeIsSpeaking && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
          )}
        </div>
      )
    }

    return (
      <div className={cn('flex flex-col items-center gap-3', className)}>
        {/* Wake Word Status */}
        {wakeWordActive && !isListening && !isProcessing && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/20 rounded-full border border-rose-500/30">
            <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
            <span className="text-xs text-rose-400 font-medium">Say "{wakeWordLabel}"</span>
          </div>
        )}

        {/* Main Voice Button */}
        <button
          onClick={toggleListening}
          disabled={isProcessing || realtimeIsConnecting}
            className={cn(
              'voice-button rounded-full flex items-center justify-center transition-all duration-200',
              sizeClasses[size],
              isProcessing || realtimeIsConnecting
                ? 'bg-purple-500 shadow-lg shadow-purple-500/50 voice-glow-purple'
                : realtimeIsSpeaking
                  ? 'bg-amber-500 shadow-lg shadow-amber-500/50 voice-glow-amber'
                : isListening
                  ? 'voice-listening bg-green-500 shadow-lg shadow-green-500/50'
                  : wakeWordActive
                    ? 'bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-lg shadow-rose-500/30 voice-glow-rose ring-2 ring-rose-500/50'
                    : 'bg-purple-500 hover:bg-purple-600 shadow-lg shadow-purple-500/30',
              'active:scale-95 disabled:opacity-70'
            )}
          aria-label={isListening ? 'Stop listening' : 'Start voice command'}
        >
          {isProcessing || realtimeIsConnecting ? (
            <Loader2 className={cn(iconSizes[size], 'text-white animate-spin')} />
          ) : realtimeIsSpeaking ? (
            <Volume2 className={cn(iconSizes[size], 'text-white animate-pulse')} />
          ) : isListening ? (
            <Volume2 className={cn(iconSizes[size], 'text-white animate-pulse')} />
          ) : wakeWordActive ? (
            <Radio className={cn(iconSizes[size], 'text-white animate-pulse')} />
          ) : (
            <Mic className={cn(iconSizes[size], 'text-white')} />
          )}
        </button>

        {/* Status Text */}
        <div className="text-center min-h-[60px]">
          {(isProcessing || realtimeIsConnecting) && (
            <p className="text-purple-400 font-medium">
              🔄 {realtimeIsConnecting ? 'Connecting...' : 'Processing...'}
            </p>
          )}
          {realtimeIsSpeaking && !isProcessing && !realtimeIsConnecting && (
            <p className="text-amber-400 font-medium animate-pulse">
              🔊 Speaking...
            </p>
          )}
          {isListening && !isProcessing && (
            <p className="text-green-400 font-medium animate-pulse">
              🎤 Listening...
            </p>
          )}
          {transcript && !isListening && !isProcessing && (
            <p className="text-theme-muted text-sm max-w-[200px]">
              Heard: "{transcript}"
            </p>
          )}
          {error && !isListening && !isProcessing && (
            <div className="text-amber-400 text-sm max-w-[240px]">
              <p>⚠️ {error}</p>
              {voiceProvider === 'whisper' && !whisperVoice.isConfigured && (
                <p className="mt-1 text-xs text-amber-300">
                  Voice service not configured. Check Settings.
                </p>
              )}
            </div>
          )}
          {!isListening && !transcript && !error && !isProcessing && !realtimeIsConnecting && !realtimeIsSpeaking && (
            <p className="text-theme-muted text-sm">
              {wakeWordActive
                ? `Listening for "${wakeWordLabel}"`
                : useWhisper
                  ? 'Tap to record'
                  : useRealtime
                    ? 'Realtime listening'
                    : 'Tap to speak'}
            </p>
          )}
        </div>

        {/* Voice Command Hints */}
        <div className="text-center text-xs text-theme-muted max-w-[250px]">
          <p className="font-medium mb-1">Say:</p>
          <p>"Start cooling [item]"</p>
          <p>"Done" or "In fridge"</p>
          <p>"Discard"</p>
          {(useWhisper || useRealtime) && (
            <p className="mt-2 text-purple-400">Using {providerLabel}</p>
          )}
        </div>
      </div>
    )
  }
)

// Compact inline voice button
export function VoiceButtonInline({
  onCommand,
  className,
}: Omit<VoiceButtonProps, 'size' | 'onEnd' | 'wakeWordActive' | 'wakeWordTriggered'>) {
  const { voiceProvider } = useAppStoreShallow((state) => ({
    voiceProvider: state.settings.voiceProvider,
  }))

  // Use Whisper (Edge Function) when selected — no API key needed
  const useWhisper = voiceProvider === 'whisper'
  const useRealtime = voiceProvider === 'realtime'

  const browserVoice = useBrowserSpeech({
    onTranscript: (text, isFinal) => {
      if (!isFinal) return
      const command = parseVoiceCommand(text)
      onCommand(command)
    },
    silenceTimeout: 4500,
    postSpeechTimeout: 1300,
  })
  const whisperVoice = useWhisperVoice({ onCommand })
  const realtimeVoice = useRealtimeVoice({
    onTranscript: (text, isFinal) => {
      if (!isFinal) return
      const command = parseVoiceCommand(text)
      onCommand(command)
    },
  })

  const voice = useWhisper ? whisperVoice : useRealtime ? realtimeVoice : browserVoice
  const { isSupported, isListening } = voice
  const isProcessing = useWhisper ? whisperVoice.isProcessing : false
  const toggleListening = useCallback(() => {
    if (isListening) {
      voice.stopListening()
    } else {
      voice.startListening()
    }
  }, [isListening, voice])

  if (!isSupported && !useWhisper) return null

  return (
    <button
      onClick={toggleListening}
      disabled={isProcessing}
      className={cn(
        'p-3 rounded-xl transition-all duration-200',
        isProcessing
          ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50'
          : isListening
            ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
            : 'bg-theme-ghost text-theme-secondary hover:bg-theme-secondary',
        'disabled:opacity-50',
        className
      )}
      aria-label={isListening ? 'Stop listening' : 'Start voice command'}
    >
      {isProcessing ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : isListening ? (
        <Volume2 className="w-6 h-6 animate-pulse" />
      ) : (
        <Mic className="w-6 h-6" />
      )}
    </button>
  )
}
