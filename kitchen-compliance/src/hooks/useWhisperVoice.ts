import { useCallback, useState, useEffect, useRef } from 'react'
import { useAppStoreShallow } from '@/store/useAppStore'
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
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const isRecordingRef = useRef(false)
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { voiceProvider, language, siteId } = useAppStoreShallow((state) => ({
    voiceProvider: state.settings.voiceProvider,
    language: state.settings.language,
    siteId: state.currentSite?.id,
  }))

  // Initialize whisper service — no API key needed (uses Edge Function)
  useEffect(() => {
    if (voiceProvider === 'whisper') {
      whisperService.initialize({
        language: language || 'en',
        siteId,
      })
      setIsConfigured(true)
    } else {
      setIsConfigured(false)
    }
  }, [language, siteId, voiceProvider])

  // Start recording
  const startListening = useCallback(async () => {
    if (!isConfigured) {
      const msg = 'Voice provider not configured. Select "Whisper" in Settings.'
      setError(msg)
      onError?.(msg)
      return
    }

    if (isListening || isRecordingRef.current) {
      return
    }

    try {
      setTranscript('')
      setError(null)
      isRecordingRef.current = true
      setIsListening(true)

      await whisperService.startRecording()

      // Stop recording when silence is detected
      whisperService.setOnSilenceDetected(() => {
        stopListening()
      }, quickResponseMode)

      // Auto-stop limit after 10 seconds for safety (shorter for quick responses)
      const autoStopDelay = quickResponseMode ? 5000 : 10000
      autoStopTimeoutRef.current = setTimeout(() => {
        stopListening()
      }, autoStopDelay)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start recording'
      setError(msg)
      onError?.(msg)
      isRecordingRef.current = false
      setIsListening(false)
    }
  }, [isConfigured, isListening, setIsListening, onError, quickResponseMode])

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

      setTranscript(text)
      onTranscript?.(text)

      if (text) {
        // Only parse commands if not disabled (i.e., not in conversation mode)
        if (!disabled) {
          const command = parseVoiceCommand(text)
          onCommand?.(command)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcription failed'
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
    isSupported: true, // Whisper works everywhere via Edge Function
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
