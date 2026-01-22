import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import type { VoiceCommand } from '@/types'
import { FOOD_ITEM_PRESETS } from '@/types'

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

interface UseVoiceRecognitionOptions {
  onCommand?: (command: VoiceCommand) => void
  onTranscript?: (transcript: string) => void
  onError?: (error: string) => void
  language?: string
}

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}) {
  const { onCommand, onTranscript, onError, language = 'en-IE' } = options
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  
  // Use refs for callbacks to prevent recreation of recognition
  const onCommandRef = useRef(onCommand)
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)
  
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
  
  const { isListening, setIsListening } = useAppStore()

  // Check for browser support
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(Boolean(SpeechRecognitionAPI))
  }, [])

  // Initialize recognition - only once when supported
  useEffect(() => {
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
    }
  }, [isSupported, language, setIsListening])

  // Start listening
  const startListening = useCallback(() => {
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
    (text: string, options: { rate?: number; pitch?: number } = {}) => {
      if (!isSupported || isSpeaking) return

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = options.rate || 1.1 // Slightly faster for kitchen
      utterance.pitch = options.pitch || 1
      utterance.lang = 'en-IE'

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

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
