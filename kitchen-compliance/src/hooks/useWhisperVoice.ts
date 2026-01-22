import { useCallback, useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { whisperService } from '@/services/whisperService'
import type { VoiceCommand } from '@/types'
import { FOOD_ITEM_PRESETS } from '@/types'

// Parse voice input to command (same logic as Web Speech API)
function parseVoiceCommand(transcript: string): VoiceCommand {
  const lower = transcript.toLowerCase().trim()
  
  // Start cooling commands
  const startPatterns = [
    /^(start|begin|new)\s*(cooling|cool)?\s*(.*)$/i,
    /^cool\s*(.*)$/i,
    /^cooling\s*(.*)$/i,
  ]
  
  for (const pattern of startPatterns) {
    const match = lower.match(pattern)
    if (match) {
      const itemName = match[match.length - 1]?.trim()
      // Try to match with presets
      const preset = FOOD_ITEM_PRESETS.find(
        (p) =>
          p.name.toLowerCase().includes(itemName) ||
          p.id.includes(itemName) ||
          itemName.includes(p.name.toLowerCase())
      )
      return {
        type: 'start_cooling',
        item: preset?.name || (itemName || undefined),
      }
    }
  }
  
  // Stop/Close cooling commands
  const stopPatterns = [
    /^(stop|done|close|finish|in\s*fridge|fridge)\s*(cooling)?/i,
    /^cooling\s*(done|finished|complete)/i,
  ]
  
  for (const pattern of stopPatterns) {
    if (pattern.test(lower)) {
      return { type: 'stop_cooling' }
    }
  }
  
  // Discard commands
  const discardPatterns = [
    /^(discard|throw|bin|trash|waste)/i,
    /^(throw|toss)\s*(it)?\s*(away|out)?/i,
  ]
  
  for (const pattern of discardPatterns) {
    if (pattern.test(lower)) {
      return { type: 'discard' }
    }
  }
  
  return { type: 'unknown' }
}

interface UseWhisperVoiceOptions {
  onCommand?: (command: VoiceCommand) => void
  onTranscript?: (transcript: string) => void
  onError?: (error: string) => void
}

export function useWhisperVoice(options: UseWhisperVoiceOptions = {}) {
  const { onCommand, onTranscript, onError } = options
  const [isConfigured, setIsConfigured] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const isRecordingRef = useRef(false)
  
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
    if (!isConfigured) {
      const msg = 'Please configure OpenAI API key in Settings to use voice'
      setError(msg)
      onError?.(msg)
      return
    }

    if (isListening || isRecordingRef.current) return

    try {
      setTranscript('')
      setError(null)
      isRecordingRef.current = true
      setIsListening(true)
      
      await whisperService.startRecording()
      console.log('[WhisperHook] Recording started')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start recording'
      console.error('[WhisperHook] Start error:', msg)
      setError(msg)
      onError?.(msg)
      isRecordingRef.current = false
      setIsListening(false)
    }
  }, [isConfigured, isListening, setIsListening, onError])

  // Stop recording and transcribe
  const stopListening = useCallback(async () => {
    if (!isRecordingRef.current) return

    try {
      setIsProcessing(true)
      isRecordingRef.current = false
      
      const text = await whisperService.stopAndTranscribe()
      console.log('[WhisperHook] Transcription:', text)
      
      setTranscript(text)
      onTranscript?.(text)
      
      if (text) {
        const command = parseVoiceCommand(text)
        console.log('[WhisperHook] Parsed command:', command)
        onCommand?.(command)
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
  }, [setIsListening, onCommand, onTranscript, onError])

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
