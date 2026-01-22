import { useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Mic, MicOff, Volume2, Loader2, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVoiceRecognition, useTextToSpeech } from '@/hooks/useVoiceRecognition'
import { useWhisperVoice } from '@/hooks/useWhisperVoice'
import { useAppStore } from '@/store/useAppStore'
import type { VoiceCommand } from '@/types'

export interface VoiceButtonHandle {
  triggerVoice: () => void
}

interface VoiceButtonProps {
  onCommand: (command: VoiceCommand) => void
  onEnd?: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
  wakeWordActive?: boolean
  wakeWordTriggered?: boolean
  wakeWordLabel?: string // e.g. "Hey Luma" for display
}

export const VoiceButton = forwardRef<VoiceButtonHandle, VoiceButtonProps>(
  function VoiceButton(
    { onCommand, onEnd, className, size = 'lg', wakeWordActive = false, wakeWordTriggered = false, wakeWordLabel = 'Hey Luma' },
    ref
  ) {
    const { speak } = useTextToSpeech()
    const { settings } = useAppStore()
    
    // Use API voice if OpenAI or OpenRouter is configured with API key
    const useWhisper = (settings.voiceProvider === 'openai' && settings.openaiApiKey) ||
                       (settings.voiceProvider === 'openrouter' && settings.openrouterApiKey)
    
    const providerLabel = settings.voiceProvider === 'openai' 
      ? 'OpenAI Whisper' 
      : settings.voiceProvider === 'openrouter'
        ? `OpenRouter (${settings.audioModel?.split('/')[1] || 'gpt-audio-mini'})`
        : 'Browser'

    // Handle command with voice feedback - defined early so hooks can use it
    const handleCommand = useCallback((command: VoiceCommand) => {
      console.log('[VoiceButton] Command received:', command)
      if (command.type === 'start_cooling') {
        speak(`Starting cooling${command.item ? ` for ${command.item}` : ''}`)
      } else if (command.type === 'stop_cooling') {
        speak('Cooling complete, moved to fridge')
      } else if (command.type === 'discard') {
        speak('Item discarded')
      } else {
        speak("Sorry, I didn't understand that")
      }
      onCommand(command)
    }, [onCommand, speak])
    
    // Handle when voice ends (for wake word resume)
    const handleEnd = useCallback(() => {
      console.log('[VoiceButton] Voice ended')
      onEnd?.()
    }, [onEnd])
    
    // Browser Speech API hook
    const browserVoice = useVoiceRecognition({
      onCommand: handleCommand,
      onError: (err) => {
        console.error('[BrowserVoice] Error:', err)
        handleEnd()
      },
    })
    
    // Whisper API hook
    const whisperVoice = useWhisperVoice({
      onCommand: handleCommand,
      onError: (err) => {
        console.error('[WhisperVoice] Error:', err)
        handleEnd()
      },
    })
    
    // Select active voice provider
    const voice = useWhisper ? whisperVoice : browserVoice
    
    const {
      isSupported,
      isListening,
      transcript,
      error,
      toggleListening,
      startListening,
    } = voice
    
    // Whisper has additional processing state
    const isProcessing = useWhisper ? whisperVoice.isProcessing : false

    // Expose triggerVoice method via ref
    useImperativeHandle(ref, () => ({
      triggerVoice: () => {
        console.log('[VoiceButton] Triggered via ref (wake word)')
        if (!isListening && !isProcessing) {
          if (startListening) {
            startListening()
          } else {
            toggleListening()
          }
        }
      }
    }), [isListening, isProcessing, startListening, toggleListening])

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

    // Call onEnd when listening stops (for browser voice)
    useEffect(() => {
      if (!isListening && !isProcessing && transcript) {
        // Small delay to let command processing finish
        const timeout = setTimeout(() => {
          handleEnd()
        }, 500)
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
                    : 'bg-gradient-to-b from-theme-ghost to-theme-secondary hover:from-theme-secondary hover:to-theme-ghost shadow-lg',
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
                  : 'bg-gradient-to-b from-theme-ghost to-theme-secondary hover:from-theme-secondary hover:to-theme-ghost shadow-lg',
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
            <div className="text-amber-400 text-sm max-w-[220px]">
              <p>⚠️ {error}</p>
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
