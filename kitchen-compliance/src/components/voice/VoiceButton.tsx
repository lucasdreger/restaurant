import { useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Mic, MicOff, Volume2, Loader2, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVoiceRecognition, useTextToSpeech } from '@/hooks/useVoiceRecognition'
import { useWhisperVoice } from '@/hooks/useWhisperVoice'
import { useBrowserSpeech } from '@/hooks/useBrowserSpeech'
import { useAppStore } from '@/store/useAppStore'
import type { VoiceCommand } from '@/types'
import { getVoiceFeedback } from '@/lib/voiceCommands'

export interface VoiceButtonHandle {
  triggerVoice: () => void
  stopVoice: () => void
}

interface VoiceButtonProps {
  onCommand: (command: VoiceCommand) => void
  onTranscript?: (transcript: string) => void
  onInterimTranscript?: (transcript: string) => void // Called with interim (partial) transcripts for early detection
  onEnd?: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
  wakeWordActive?: boolean
  wakeWordTriggered?: boolean
  wakeWordLabel?: string // e.g. "Hey Luma" for display
  conversationMode?: boolean // Force browser speech for conversation flows
  quickResponseMode?: boolean // When true, use shorter silence timeout (for staff code, temperature)
}

export const VoiceButton = forwardRef<VoiceButtonHandle, VoiceButtonProps>(
  function VoiceButton(
    { onCommand, onTranscript, onInterimTranscript, onEnd, className, size = 'lg', wakeWordActive = false, wakeWordTriggered = false, wakeWordLabel = 'Hey Luma', conversationMode = false, quickResponseMode = false },
    ref
  ) {
    const { speak } = useTextToSpeech()
    const { settings } = useAppStore()
    
    // Check if API key is available (for both command and conversation modes)
    const hasApiKey = !!(settings.openaiApiKey || settings.openrouterApiKey)
    
    // Use API voice if OpenAI or OpenRouter is configured with API key
    // For conversation mode: use Whisper if API key available (browser speech is broken)
    const useWhisper = hasApiKey && (
      !conversationMode || (conversationMode && hasApiKey)
    )
    
    const providerLabel = settings.voiceProvider === 'openai' 
      ? 'OpenAI Whisper' 
      : settings.voiceProvider === 'openrouter'
        ? `OpenRouter (${settings.audioModel?.split('/')[1] || 'gpt-audio-mini'})`
        : 'Browser'

    // DEBUG: Log voice provider selection
    useEffect(() => {
      console.log('[VoiceButton] === VOICE PROVIDER DEBUG ===')
      console.log('[VoiceButton] settings.voiceProvider:', settings.voiceProvider)
      console.log('[VoiceButton] settings.openaiApiKey exists:', !!settings.openaiApiKey)
      console.log('[VoiceButton] settings.openrouterApiKey exists:', !!settings.openrouterApiKey)
      console.log('[VoiceButton] settings.audioModel:', settings.audioModel)
      console.log('[VoiceButton] hasApiKey:', hasApiKey)
      console.log('[VoiceButton] useWhisper (API voice):', useWhisper)
      console.log('[VoiceButton] conversationMode:', conversationMode)
      console.log('[VoiceButton] Provider in use:', providerLabel)
      console.log('[VoiceButton] =================================')
    }, [settings.voiceProvider, settings.openaiApiKey, settings.openrouterApiKey, settings.audioModel, useWhisper, hasApiKey, conversationMode, providerLabel])

    // Handle command with voice feedback - defined early so hooks can use it
    const handleCommand = useCallback((command: VoiceCommand) => {
      console.log('[VoiceButton] Command received:', command, 'conversationMode:', conversationMode)
      
      // CRITICAL: In conversation mode, ignore all commands (user is answering questions)
      if (conversationMode) {
        console.log('[VoiceButton] Ignoring command in conversation mode')
        return
      }
      
      // Give voice feedback for commands, EXCEPT for stop_cooling (the flow will speak)
      if (command.type !== 'stop_cooling') {
        const feedback = getVoiceFeedback(command)
        if (feedback) {
          speak(feedback)
        }
      }
      
      onCommand(command)
    }, [onCommand, speak, conversationMode])
    
    // Handle when voice ends (for wake word resume)
    const handleEnd = useCallback(() => {
      console.log('[VoiceButton] Voice ended')
      onEnd?.()
    }, [onEnd])
    
    // Browser Speech API hook for commands (parses as commands)
    // CRITICAL: Disable this hook entirely in conversation mode to prevent competing Speech Recognition instances
    const browserCommandVoice = useVoiceRecognition({
      disabled: conversationMode || useWhisper, // Don't use browser if Whisper is available
      onCommand: handleCommand,
      onTranscript: onTranscript,
      onError: (err) => {
        console.error('[BrowserVoice] Error:', err)
        handleEnd()
      },
    })
    
    // Browser Speech hook for conversation (transcript only) - fallback when no API key
    const browserConversationVoice = useBrowserSpeech({
      onTranscript: (transcript, isFinal) => {
        console.log('[BrowserConversation] Transcript:', transcript, 'isFinal:', isFinal)
        if (conversationMode) {
          if (isFinal) {
            onTranscript?.(transcript)
          } else {
            onInterimTranscript?.(transcript)
          }
        }
      },
      onError: (err) => {
        console.error('[BrowserConversation] Error:', err)
        handleEnd()
      },
      onEnd: handleEnd,
      silenceTimeout: 10000, // Wait 10s for user to respond in conversation mode
    })
    
    // Whisper API hook - use for both command and conversation modes when API key available
    const whisperVoice = useWhisperVoice({
      disabled: !useWhisper, // Use Whisper when API key is available
      onCommand: conversationMode ? undefined : handleCommand, // Parse commands only in command mode
      onTranscript: onTranscript, // Always transcribe
      quickResponseMode: quickResponseMode, // Use shorter silence timeout for staff code/temperature
      onError: (err) => {
        console.error('[WhisperVoice] Error:', err)
        handleEnd()
      },
    })
    
    // Select active voice provider and normalize interface
    let isSupported: boolean
    let isListening: boolean
    let transcript: string
    let error: string | null
    let startListening: () => void
    let stopListening: () => void
    
    if (useWhisper) {
      // Whisper API mode (for both command and conversation)
      console.log('[VoiceButton] Using Whisper API')
      isSupported = whisperVoice.isSupported
      isListening = whisperVoice.isListening
      transcript = whisperVoice.transcript
      error = whisperVoice.error
      startListening = whisperVoice.startListening
      stopListening = whisperVoice.stopListening
    } else if (conversationMode) {
      // Browser conversation mode (only when no API key)
      console.log('[VoiceButton] Using Browser for conversation')
      isSupported = browserConversationVoice.isSupported
      isListening = browserConversationVoice.isListening
      transcript = browserConversationVoice.transcript
      error = browserConversationVoice.error
      startListening = browserConversationVoice.startListening
      stopListening = browserConversationVoice.stopListening
    } else {
      // Browser command mode
      console.log('[VoiceButton] Using Browser for commands')
      isSupported = browserCommandVoice.isSupported
      isListening = browserCommandVoice.isListening
      transcript = browserCommandVoice.transcript
      error = browserCommandVoice.error
      startListening = browserCommandVoice.startListening
      stopListening = browserCommandVoice.stopListening
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
        const provider = useWhisper 
          ? 'whisper' 
          : conversationMode 
            ? 'browserConversation' 
            : 'browserCommand'
        console.log('[VoiceButton] Triggered via ref. Mode:', { conversationMode, useWhisper, provider })
        console.log('[VoiceButton] isListening:', isListening, 'isProcessing:', isProcessing)
        
        if (!isListening && !isProcessing) {
          if (startListening) {
            console.log('[VoiceButton] Calling startListening for provider:', provider)
            startListening()
          } else {
            console.log('[VoiceButton] Calling toggleListening (fallback)')
            toggleListening()
          }
        } else {
          console.log('[VoiceButton] Skipping - already listening or processing')
        }
      },
      stopVoice: () => {
        console.log('[VoiceButton] Stop voice called via ref. isListening:', isListening)
        if (isListening && stopListening) {
          stopListening()
        }
      }
    }), [isListening, isProcessing, startListening, stopListening, toggleListening, conversationMode, useWhisper])

    // Auto-trigger when wake word is triggered
    useEffect(() => {
      if (wakeWordTriggered && !isListening && !isProcessing) {
        console.log('[VoiceButton] Wake word triggered - starting voice')
        if (startListening) {
          startListening()
        } else {
          toggleListening()
        }
      }
    }, [wakeWordTriggered, isListening, isProcessing, startListening, toggleListening])

    // Call onEnd when listening stops (also when transcript is empty)
    useEffect(() => {
      if (!isListening && !isProcessing) {
        const timeout = setTimeout(() => {
          handleEnd()
        }, transcript ? 500 : 200)
        return () => clearTimeout(timeout)
      }
    }, [isListening, isProcessing, transcript, handleEnd])

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
            disabled={isProcessing}
            className={cn(
              'voice-button rounded-full flex items-center justify-center transition-all duration-200',
              sizeClasses[size],
              isProcessing
                ? 'bg-purple-500 shadow-lg shadow-purple-500/50'
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
            {isProcessing ? (
              <Loader2 className={cn(iconSizes[size], 'text-white animate-spin')} />
            ) : isListening ? (
              <Volume2 className={cn(iconSizes[size], 'text-white animate-pulse')} />
            ) : wakeWordActive ? (
              <Radio className={cn(iconSizes[size], 'text-white animate-pulse')} />
            ) : (
              <Mic className={cn(iconSizes[size], 'text-white')} />
            )}
          </button>
          {/* Wake word indicator dot */}
          {wakeWordActive && !isListening && !isProcessing && (
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
          disabled={isProcessing}
          className={cn(
            'voice-button rounded-full flex items-center justify-center transition-all duration-200',
            sizeClasses[size],
            isProcessing
              ? 'bg-purple-500 shadow-lg shadow-purple-500/50'
              : isListening
                ? 'voice-listening bg-green-500 shadow-lg shadow-green-500/50'
                : wakeWordActive
                  ? 'bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-lg shadow-rose-500/30 ring-2 ring-rose-500/50'
                  : 'bg-purple-500 hover:bg-purple-600 shadow-lg shadow-purple-500/30',
            'active:scale-95 disabled:opacity-70'
          )}
          aria-label={isListening ? 'Stop listening' : 'Start voice command'}
        >
          {isProcessing ? (
            <Loader2 className={cn(iconSizes[size], 'text-white animate-spin')} />
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
          {isProcessing && (
            <p className="text-purple-400 font-medium">
              🔄 Processing...
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
              {settings.voiceProvider !== 'browser' && !whisperVoice.isConfigured && (
                <p className="mt-1 text-xs text-amber-300">
                  Add your API key in Settings → Voice Control.
                </p>
              )}
            </div>
          )}
          {!isListening && !transcript && !error && !isProcessing && (
            <p className="text-theme-muted text-sm">
              {wakeWordActive ? `Listening for "${wakeWordLabel}"` : useWhisper ? 'Tap to record' : 'Tap to speak'}
            </p>
          )}
        </div>

        {/* Voice Command Hints */}
        <div className="text-center text-xs text-theme-muted max-w-[250px]">
          <p className="font-medium mb-1">Say:</p>
          <p>"Start cooling [item]"</p>
          <p>"Done" or "In fridge"</p>
          <p>"Discard"</p>
          {useWhisper && (
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
  const { settings } = useAppStore()
  
  // Use API voice if OpenAI or OpenRouter is configured with API key
  const useWhisper = (settings.voiceProvider === 'openai' && settings.openaiApiKey) ||
                     (settings.voiceProvider === 'openrouter' && settings.openrouterApiKey)
  
  const browserVoice = useVoiceRecognition({ onCommand })
  const whisperVoice = useWhisperVoice({ onCommand })
  
  const voice = useWhisper ? whisperVoice : browserVoice
  const { isSupported, isListening, toggleListening } = voice
  const isProcessing = useWhisper ? whisperVoice.isProcessing : false

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
