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
      // Allow single characters (for numbers like "2" or "#2")
      return afterWake.length >= 1 ? afterWake : null
    }
  }
  return null
}

interface UseWakeWordOptions {
  onWakeWordHeard?: () => void     // Called immediately on interim detect (e.g. for beep)
  onWakeWordDetected: () => void   // Called when ready for full command mode
  onCommandDetected?: (command: string) => void
  enabled?: boolean
  language?: string
  wakeWords: string[] // Configurable wake words
}

export function useWakeWord(options: UseWakeWordOptions) {
  const {
    onWakeWordHeard,
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
  const onWakeWordHeardRef = useRef(onWakeWordHeard)
  const onWakeWordDetectedRef = useRef(onWakeWordDetected)
  const onCommandDetectedRef = useRef(onCommandDetected)
  const wakeWordsRef = useRef(wakeWords)
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isEnabledRef = useRef(enabled)
  const isInCommandModeRef = useRef(false)
  const isStartingRef = useRef(false)
  const consecutiveErrorsRef = useRef(0)
  const isAbortingRef = useRef(false)

  const pendingDetectionRef = useRef(false)
  const pendingCommandRef = useRef<string | null>(null)

  // Keep refs up to date
  useEffect(() => {
    onWakeWordHeardRef.current = onWakeWordHeard
  }, [onWakeWordHeard])

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
    if (!isSupported || recognitionRef.current || isStartingRef.current) return

    isStartingRef.current = true
    isAbortingRef.current = false

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
      isStartingRef.current = false
      consecutiveErrorsRef.current = 0
    }

    recognition.onend = () => {
      console.log('[WakeWord] Recognition ended')
      setIsActive(false)
      recognitionRef.current = null
      isStartingRef.current = false

      // If we stopped because of a detection, trigger the appropriate callback NOW that mic is free
      if (pendingDetectionRef.current) {
        pendingDetectionRef.current = false
        onWakeWordDetectedRef.current()
        isAbortingRef.current = false
        return
      }

      if (pendingCommandRef.current !== null) {
        const cmd = pendingCommandRef.current
        pendingCommandRef.current = null
        onCommandDetectedRef.current?.(cmd)
        isAbortingRef.current = false
        return
      }

      // Auto-restart if still enabled (with backoff if we had errors)
      if (isEnabledRef.current && !isInCommandModeRef.current && !isAbortingRef.current) {
        const backoff = Math.min(10000, 1000 * Math.pow(2, consecutiveErrorsRef.current))
        console.log(`[WakeWord] Retrying in ${backoff}ms (errors: ${consecutiveErrorsRef.current})`)

        restartTimeoutRef.current = setTimeout(() => {
          if (isEnabledRef.current && !isInCommandModeRef.current) {
            console.log('[WakeWord] Auto-restarting...')
            startListening()
          }
        }, backoff)
      }
      isAbortingRef.current = false
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Check all new results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        const isFinal = result.isFinal

        // Update last heard for debugging
        setLastHeard(transcript)

        // Check for wake word using current wake words from ref
        if (containsWakeWord(transcript, wakeWordsRef.current)) {
          // INTERIM DETECTION: Trigger fast feedback (beep)
          if (!isInCommandModeRef.current) {
            onWakeWordHeardRef.current?.()
            isInCommandModeRef.current = true
          }

          // Check if there's a command following the wake word
          const immediateCommand = extractCommandAfterWakeWord(transcript, wakeWordsRef.current)

          // FINAL DETECTION: Process result
          if (isFinal) {
            console.log('[WakeWord] Final match found:', transcript)

            if (immediateCommand && immediateCommand.length >= 1) {
              // User said command in same breath as wake word (e.g., "Hey Luma done" or "Hey Luma finish cooling 2")
              // Reduced from > 3 to >= 1 to allow single numbers like "2" or "#2"
              console.log('[WakeWord] Immediate command detected:', immediateCommand)
              pendingCommandRef.current = immediateCommand
              isAbortingRef.current = true
              recognition.stop()
            } else {
              // Just wake word - IMMEDIATELY trigger command mode (NO DELAY!)
              console.log('[WakeWord] Wake word only - IMMEDIATELY stopping to start command recording')
              pendingDetectionRef.current = true
              isAbortingRef.current = true
              recognition.stop()
            }
            return
          }
        } else if (isInCommandModeRef.current && isFinal) {
          // User spoke something AFTER the interim wake word but in a separate final result
          console.log('[WakeWord] Command follow-up after wake word:', transcript)
          pendingCommandRef.current = transcript
          isAbortingRef.current = true
          recognition.stop()
        }
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.log('[WakeWord] Error:', event.error)

      // Don't count 'no-speech' as a hard error for backoff
      if (event.error !== 'no-speech') {
        consecutiveErrorsRef.current += 1
      }

      // Only show error for critical issues
      if (event.error === 'not-allowed') {
        setError('Microphone access denied')
        isEnabledRef.current = false // Stop trying if denied
      } else if (event.error === 'audio-capture') {
        setError('No microphone found')
        isEnabledRef.current = false
      }
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

    isAbortingRef.current = true
    isStartingRef.current = false

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch (e) {
        console.warn('[WakeWord] Abort error:', e)
      }
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
          isInCommandModeRef.current = false
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
