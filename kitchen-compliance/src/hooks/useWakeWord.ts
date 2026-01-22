import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Wake Word Detection Hook
 * 
 * Listens continuously for configurable wake words like "Luma" or "Hey Luma"
 * When detected, triggers a callback to enter command mode
 * 
 * Uses Browser Speech Recognition API in continuous mode
 */

// Speech Recognition types (same as useVoiceRecognition)
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

// Check if transcript contains any wake word from the list
function containsWakeWord(transcript: string, wakeWords: string[]): boolean {
  const lower = transcript.toLowerCase().trim()
  return wakeWords.some(wake => lower.includes(wake.toLowerCase()))
}

// Extract command after wake word (if any)
function extractCommandAfterWakeWord(transcript: string, wakeWords: string[]): string | null {
  const lower = transcript.toLowerCase().trim()
  
  for (const wake of wakeWords) {
    const wakeLower = wake.toLowerCase()
    const index = lower.indexOf(wakeLower)
    if (index !== -1) {
      const afterWake = transcript.slice(index + wake.length).trim()
      return afterWake.length > 2 ? afterWake : null
    }
  }
  return null
}

interface UseWakeWordOptions {
  onWakeWordDetected: () => void
  onCommandDetected?: (command: string) => void
  enabled?: boolean
  language?: string
  wakeWords: string[] // Configurable wake words
}

export function useWakeWord(options: UseWakeWordOptions) {
  const { 
    onWakeWordDetected, 
    onCommandDetected,
    enabled = false, 
    language = 'en-IE',
    wakeWords = ['luma', 'hey luma', 'hi luma', 'ok luma', 'okay luma'],
  } = options
  
  const [isSupported, setIsSupported] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [lastHeard, setLastHeard] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const onWakeWordDetectedRef = useRef(onWakeWordDetected)
  const onCommandDetectedRef = useRef(onCommandDetected)
  const wakeWordsRef = useRef(wakeWords)
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isEnabledRef = useRef(enabled)
  
  // Keep refs up to date
  useEffect(() => {
    onWakeWordDetectedRef.current = onWakeWordDetected
  }, [onWakeWordDetected])
  
  useEffect(() => {
    onCommandDetectedRef.current = onCommandDetected
  }, [onCommandDetected])
  
  useEffect(() => {
    wakeWordsRef.current = wakeWords
  }, [wakeWords])
  
  useEffect(() => {
    isEnabledRef.current = enabled
  }, [enabled])

  // Check for browser support
  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setIsSupported(Boolean(SpeechRecognitionAPI))
  }, [])

  // Start wake word listening
  const startListening = useCallback(() => {
    if (!isSupported || recognitionRef.current) return

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognitionAPI()

    // Configure for continuous wake word detection
    recognition.continuous = true
    recognition.interimResults = true // Get interim results to catch wake word faster
    recognition.lang = language

    recognition.onstart = () => {
      console.log('[WakeWord] Listening for wake words:', wakeWordsRef.current.slice(0, 3).join(', '), '...')
      setIsActive(true)
      setError(null)
    }

    recognition.onend = () => {
      console.log('[WakeWord] Recognition ended')
      setIsActive(false)
      recognitionRef.current = null
      
      // Auto-restart if still enabled (with small delay to avoid rate limiting)
      if (isEnabledRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          console.log('[WakeWord] Auto-restarting...')
          startListening()
        }, 500)
      }
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Check all new results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        
        // Update last heard for debugging
        setLastHeard(transcript)
        
        // Check for wake word using current wake words from ref
        if (containsWakeWord(transcript, wakeWordsRef.current)) {
          console.log('[WakeWord] Wake word detected:', transcript)
          
          // Check if there's a command following the wake word
          const immediateCommand = extractCommandAfterWakeWord(transcript, wakeWordsRef.current)
          
          // Stop listening temporarily while command mode is active
          recognition.stop()
          
          // Trigger wake word callback
          onWakeWordDetectedRef.current()
          
          // If there's an immediate command, send it
          if (immediateCommand && result.isFinal) {
            console.log('[WakeWord] Immediate command:', immediateCommand)
            onCommandDetectedRef.current?.(immediateCommand)
          }
          
          return
        }
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.log('[WakeWord] Error:', event.error)
      
      // Only show error for critical issues
      if (event.error === 'not-allowed') {
        setError('Microphone access denied')
        setIsActive(false)
      } else if (event.error === 'audio-capture') {
        setError('No microphone found')
        setIsActive(false)
      }
      // For other errors (no-speech, aborted), just restart
    }

    recognitionRef.current = recognition
    
    try {
      recognition.start()
    } catch (err) {
      console.error('[WakeWord] Failed to start:', err)
    }
  }, [isSupported, language])

  // Stop wake word listening
  const stopListening = useCallback(() => {
    // Clear any restart timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }
    setIsActive(false)
  }, [])

  // Resume after command mode
  const resumeListening = useCallback(() => {
    if (enabled && !recognitionRef.current) {
      // Small delay before resuming
      setTimeout(() => {
        if (isEnabledRef.current) {
          startListening()
        }
      }, 1000)
    }
  }, [enabled, startListening])

  // Start/stop based on enabled state
  useEffect(() => {
    if (enabled && isSupported) {
      startListening()
    } else {
      stopListening()
    }
    
    return () => {
      stopListening()
    }
  }, [enabled, isSupported, startListening, stopListening])

  return {
    isSupported,
    isActive,
    lastHeard,
    error,
    startListening,
    stopListening,
    resumeListening,
  }
}

// Play a sound when wake word is detected
export function playWakeSound() {
  // Create a simple beep using Web Audio API
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800 // Hz
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  } catch (e) {
    console.log('[WakeWord] Could not play sound:', e)
  }
}

// Helper to get primary wake word label (for display)
export function getPrimaryWakeWordLabel(wakeWords: string[]): string {
  if (wakeWords.length === 0) return 'Wake Word'
  // Find the "Hey X" version or just return the first one capitalized
  const heyVersion = wakeWords.find(w => w.toLowerCase().startsWith('hey '))
  if (heyVersion) {
    return heyVersion.charAt(0).toUpperCase() + heyVersion.slice(1)
  }
  return wakeWords[0].charAt(0).toUpperCase() + wakeWords[0].slice(1)
}
