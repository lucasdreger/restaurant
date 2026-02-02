import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import type { VoiceCommand } from '@/types'
import { parseVoiceCommand } from '@/lib/voiceCommands'

// Use refs for callbacks to avoid recreating recognition on every render

// Extend Window interface for Speech Recognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

// Parse voice input to command

interface UseVoiceRecognitionOptions {
  onCommand?: (command: VoiceCommand) => void
  onTranscript?: (transcript: string) => void
  onError?: (error: string) => void
  language?: string
  disabled?: boolean // Don't initialize if disabled (for conversation mode)
}

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}) {
  const { onCommand, onTranscript, onError, language = 'en-IE', disabled = false } = options
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  
  // Use refs for callbacks to prevent recreation of recognition
  const onCommandRef = useRef(onCommand)
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)
  const disabledRef = useRef(disabled)
  
  // Keep refs up to date
  useEffect(() => {
    onCommandRef.current = onCommand
  }, [onCommand])
  
  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])
  
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])
  
  // Keep disabled ref in sync
  useEffect(() => {
    disabledRef.current = disabled
  }, [disabled])
  
  // Use local state instead of global to avoid conflicts with other voice hooks
  const [isListening, setIsListening] = useState(false)

  // Check for browser support
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(Boolean(SpeechRecognitionAPI))
  }, [])

  // Initialize recognition - only once when supported AND not disabled
  // IMPORTANT: disabled is in deps so cleanup runs when disabled changes
  useEffect(() => {
    // If disabled, clean up any existing recognition
    if (disabled) {
      if (recognitionRef.current) {
        console.log('[Voice] Hook disabled - aborting existing recognition')
        try {
          recognitionRef.current.abort()
        } catch (e) {
          // Ignore
        }
        recognitionRef.current = null
        setIsListening(false)
      }
      return
    }
    
    if (!isSupported) return

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionAPI()

    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = language

    recognition.onstart = () => {
      console.log('[Voice] Recognition started - listening for speech...')
      setIsListening(true)
      setError(null)
    }

    recognition.onend = () => {
      console.log('[Voice] Recognition ended')
      setIsListening(false)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex]
      console.log('[Voice] Got result:', result)
      if (result.isFinal) {
        const text = result[0].transcript
        console.log('[Voice] Final transcript:', text)
        setTranscript(text)
        onTranscriptRef.current?.(text)

        // Parse and execute command
        const command = parseVoiceCommand(text)
        console.log('[Voice] Parsed command:', command)
        console.log('[Voice] Calling onCommand callback...')
        onCommandRef.current?.(command)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Handle different error types with user-friendly messages
      let errorMsg: string
      let shouldNotify = true
      
      switch (event.error) {
        case 'aborted':
          // User cancelled or recognition was stopped - this is normal
          errorMsg = 'Voice recognition stopped'
          shouldNotify = false // Don't show error for normal stop
          break
        case 'no-speech':
          errorMsg = 'No speech detected. Tap the mic and speak clearly.'
          break
        case 'audio-capture':
          errorMsg = 'Microphone not found. Check your device settings.'
          break
        case 'not-allowed':
          errorMsg = 'Microphone access denied. Please allow microphone access in your browser settings.'
          break
        case 'network':
          errorMsg = 'Network error. Voice recognition requires an internet connection.'
          break
        case 'service-not-allowed':
          errorMsg = 'Speech service not available. Try using Chrome or Edge browser.'
          break
        default:
          errorMsg = `Voice error: ${event.error}`
      }
      
      setError(shouldNotify ? errorMsg : null)
      setIsListening(false)
      
      if (shouldNotify) {
        onErrorRef.current?.(errorMsg)
      }
    }

    recognitionRef.current = recognition

    return () => {
      recognition.abort()
      recognitionRef.current = null
    }
  }, [isSupported, language, disabled, setIsListening])

  // Start listening - check disabled ref to prevent stale closures
  const startListening = useCallback(() => {
    // Guard: Don't start if hook is disabled
    if (disabledRef.current) {
      console.log('[Voice] startListening blocked - hook is disabled')
      return
    }
    
    if (!recognitionRef.current || isListening) return

    try {
      setTranscript('')
      setError(null)
      recognitionRef.current.start()
    } catch (err) {
      console.error('Failed to start voice recognition:', err)
      setError('Failed to start voice recognition')
    }
  }, [isListening])

  // Stop listening
  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return

    try {
      recognitionRef.current.stop()
    } catch (err) {
      console.error('Failed to stop voice recognition:', err)
    }
  }, [isListening])

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  return {
    isSupported,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    toggleListening,
  }
}

// Text-to-Speech hook for feedback
export function useTextToSpeech() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    setIsSupported('speechSynthesis' in window)
  }, [])

  const speak = useCallback(
    (text: string, options: { rate?: number; pitch?: number; onComplete?: () => void } = {}) => {
      if (!isSupported || isSpeaking) return

      // Add natural punctuation/pauses for better speech flow
      const naturalText = text
        .replace(/(\d+)\s*degrees?/gi, '$1 degrees.') // Pause after temperature
        .replace(/\bwell done\b/gi, '. Well done!') // Pause before praise
        .replace(/\bat\b/g, ', at') // Small pause for "at"
        .replace(/\bby\b/g, ', by') // Small pause for "by"
        .replace(/\b(closing|starting|finished)\b/gi, '$1,') // Pause after actions
        .replace(/\bsay\b/gi, '. Say') // Pause before instructions
        .replace(/confirm to save/gi, 'confirm, to save') // Better flow

      const utterance = new SpeechSynthesisUtterance(naturalText)
      utterance.rate = options.rate || 0.95 // Slightly slower, more natural
      utterance.pitch = options.pitch || 1.0
      utterance.lang = 'en-IE'
      utterance.volume = 0.9 // Slightly softer volume

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => {
        setIsSpeaking(false)
        options.onComplete?.()
      }
      utterance.onerror = () => {
        setIsSpeaking(false)
        options.onComplete?.()
      }

      window.speechSynthesis.speak(utterance)
    },
    [isSupported, isSpeaking]
  )

  const cancel = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [isSupported])

  return {
    isSupported,
    isSpeaking,
    speak,
    cancel,
  }
}
