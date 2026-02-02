import { useCallback, useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { whisperService } from '@/services/whisperService'
import type { VoiceCommand } from '@/types'
import { parseVoiceCommand } from '@/lib/voiceCommands'

interface UseWhisperVoiceOptions {
  onCommand?: (command: VoiceCommand) => void
  onTranscript?: (transcript: string) => void
  onError?: (error: string) => void
  disabled?: boolean // Don't process commands when disabled (for conversation mode)
  quickResponseMode?: boolean // When true, use shorter silence timeout
}

export function useWhisperVoice(options: UseWhisperVoiceOptions = {}) {
  const { onCommand, onTranscript, onError, disabled = false, quickResponseMode = false } = options
  const [isConfigured, setIsConfigured] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const isRecordingRef = useRef(false)
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { isListening, setIsListening, settings } = useAppStore()

  // Check if service is configured with API key
  useEffect(() => {
    if (settings.voiceProvider === 'openai' && settings.openaiApiKey) {
      whisperService.initialize({
        apiKey: settings.openaiApiKey,
        provider: 'openai',
        language: settings.language || 'en',
      })
      setIsConfigured(true)
      console.log('[WhisperHook] Initialized with OpenAI Whisper')
    } else if (settings.voiceProvider === 'openrouter' && settings.openrouterApiKey) {
      whisperService.initialize({
        apiKey: settings.openrouterApiKey,
        provider: 'openrouter',
        model: settings.audioModel,
        language: settings.language || 'en',
      })
      setIsConfigured(true)
      console.log('[WhisperHook] Initialized with OpenRouter', settings.audioModel)
    } else {
      setIsConfigured(false)
    }
  }, [settings.voiceProvider, settings.openaiApiKey, settings.openrouterApiKey, settings.audioModel, settings.language])

  // Start recording
  const startListening = useCallback(async () => {
    console.log('[WhisperHook] startListening called')
    console.log('[WhisperHook] isConfigured:', isConfigured)
    console.log('[WhisperHook] settings.voiceProvider:', settings.voiceProvider)
    
    if (!isConfigured) {
      const msg = settings.voiceProvider === 'openrouter'
        ? 'Please configure an OpenRouter API key in Settings to use voice'
        : 'Please configure an OpenAI API key in Settings to use voice'
      console.error('[WhisperHook] Not configured:', msg)
      setError(msg)
      onError?.(msg)
      return
    }

    if (isListening || isRecordingRef.current) {
      console.log('[WhisperHook] Already listening, skipping')
      return
    }

    try {
      setTranscript('')
      setError(null)
      isRecordingRef.current = true
      setIsListening(true)

      console.log('[WhisperHook] Starting whisperService.startRecording()...')
      await whisperService.startRecording()
      console.log('[WhisperHook] Recording started successfully')

      // Stop recording when silence is detected
      whisperService.setOnSilenceDetected(() => {
        console.log('[WhisperHook] Silence auto-stop triggered')
        stopListening()
      }, quickResponseMode)

      // Auto-stop limit after 10 seconds for safety (shorter for quick responses)
      const autoStopDelay = quickResponseMode ? 5000 : 10000
      autoStopTimeoutRef.current = setTimeout(() => {
        console.log(`[WhisperHook] Auto-stopping recording after ${autoStopDelay/1000}s`)
        stopListening()
      }, autoStopDelay)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start recording'
      console.error('[WhisperHook] Start error:', msg)
      setError(msg)
      onError?.(msg)
      isRecordingRef.current = false
      setIsListening(false)
    }
  }, [isConfigured, isListening, setIsListening, onError, settings.voiceProvider, quickResponseMode])

  // Stop recording and transcribe
  const stopListening = useCallback(async () => {
    if (!isRecordingRef.current) return

    // Clear auto-stop timeout
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current)
      autoStopTimeoutRef.current = null
    }

    try {
      setIsProcessing(true)
      isRecordingRef.current = false

      const text = await whisperService.stopAndTranscribe()
      console.log('[WhisperHook] Transcription:', text)

      setTranscript(text)
      onTranscript?.(text)

      if (text) {
        // Only parse commands if not disabled (i.e., not in conversation mode)
        if (!disabled) {
          const command = parseVoiceCommand(text)
          console.log('[WhisperHook] Parsed command:', command)
          onCommand?.(command)
        } else {
          console.log('[WhisperHook] DISABLED - not parsing as command, just transcript:', text)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcription failed'
      console.error('[WhisperHook] Stop error:', msg)
      setError(msg)
      onError?.(msg)
    } finally {
      setIsProcessing(false)
      setIsListening(false)
    }
  }, [setIsListening, onCommand, onTranscript, onError, disabled])

  // Toggle listening (press-and-hold style - start on first click, stop on second)
  const toggleListening = useCallback(async () => {
    if (isListening || isRecordingRef.current) {
      await stopListening()
    } else {
      await startListening()
    }
  }, [isListening, startListening, stopListening])

  // Cancel without transcribing
  const cancelListening = useCallback(() => {
    whisperService.cancelRecording()
    isRecordingRef.current = false
    setIsListening(false)
  }, [setIsListening])

  return {
    isSupported: true, // Whisper works everywhere with API key
    isConfigured,
    isListening,
    isProcessing,
    transcript,
    error,
    startListening,
    stopListening,
    toggleListening,
    cancelListening,
  }
}
