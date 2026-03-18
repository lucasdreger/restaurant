import { useCallback, useEffect, useRef, useState } from 'react'
import { isLike } from '@/lib/stringUtils'

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
  const cleaned = transcript.toLowerCase().trim()
  if (cleaned.length < 3) return false

  return wakeWords.some((wake) => {
    const wakeLower = wake.toLowerCase().trim()

    // Fast exact containment
    if (cleaned.includes(wakeLower)) return true

    // Fuzzy check on sliding windows (better for noisy ASR around wake word)
    const words = cleaned.split(/\s+/).filter(Boolean)
    const wakeLen = wakeLower.split(/\s+/).length

    for (let i = 0; i < words.length; i += 1) {
      const slice = words.slice(i, i + wakeLen + 1).join(' ')
      if (slice && isLike(slice, wakeLower, 2)) return true
    }

    return false
  })
}

// Extract command after wake word (if any)
function extractCommandAfterWakeWord(transcript: string, wakeWords: string[]): string | null {
  const raw = transcript.trim()
  const lower = raw.toLowerCase()
  if (!raw) return null

  // 1) Prefer exact wake-word hit anywhere in phrase (not only full-string match).
  const sortedWakeWords = [...wakeWords].sort((a, b) => b.length - a.length)
  for (const wake of sortedWakeWords) {
    const wakeLower = wake.toLowerCase().trim()
    if (!wakeLower) continue

    const index = lower.indexOf(wakeLower)
    if (index === -1) continue

    const afterWake = raw.slice(index + wakeLower.length).trim()
    if (afterWake.length >= 1) return afterWake
  }

  // 2) Fuzzy fallback: detect a near wake-word in token windows and keep trailing words.
  const tokens = raw.split(/\s+/).filter(Boolean)
  if (tokens.length <= 1) return null

  for (const wake of sortedWakeWords) {
    const wakeLen = wake.trim().split(/\s+/).filter(Boolean).length
    if (wakeLen <= 0) continue

    for (let i = 0; i < tokens.length; i += 1) {
      const end = Math.min(tokens.length, i + wakeLen + 1)
      const slice = tokens.slice(i, end).join(' ').toLowerCase()
      if (!slice) continue

      if (isLike(slice, wake.toLowerCase(), 2)) {
        const afterWake = tokens.slice(end).join(' ').trim()
        if (afterWake.length >= 1) return afterWake
      }
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
  const wakeWordOnlyTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastHeardRef = useRef<string | null>(null)

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
    // Critical: while in command mode (wake word already detected), do not restart.
    // Parent re-renders can retrigger this hook's effect; restarting here will abort the active mic session.
    if (isInCommandModeRef.current) return
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
      setIsActive(true)
      setError(null)
      isStartingRef.current = false
      consecutiveErrorsRef.current = 0
      if (wakeWordOnlyTimeoutRef.current) {
        clearTimeout(wakeWordOnlyTimeoutRef.current)
        wakeWordOnlyTimeoutRef.current = null
      }
    }

    recognition.onend = () => {
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

        restartTimeoutRef.current = setTimeout(() => {
          if (isEnabledRef.current && !isInCommandModeRef.current) {
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

        // Keep the last heard transcript in a ref so recognition doesn't rerender
        // the whole dashboard tree on every interim ASR chunk.
        lastHeardRef.current = transcript

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
            if (immediateCommand && immediateCommand.length >= 1) {
              // User said command in same breath as wake word (e.g., "Hey Luma done" or "Hey Luma finish cooling 2")
              // Reduced from > 3 to >= 1 to allow single numbers like "2" or "#2"
              if (wakeWordOnlyTimeoutRef.current) {
                clearTimeout(wakeWordOnlyTimeoutRef.current)
                wakeWordOnlyTimeoutRef.current = null
              }
              pendingCommandRef.current = immediateCommand
              isAbortingRef.current = true
              recognition.stop()
            } else {
              // Just wake word (for now). Keep a brief grace window to capture
              // "wake word + command" that often arrives in the next final chunk.
              if (wakeWordOnlyTimeoutRef.current) {
                clearTimeout(wakeWordOnlyTimeoutRef.current)
              }
              wakeWordOnlyTimeoutRef.current = setTimeout(() => {
                // If no follow-up command arrived, enter command mode capture.
                if (!isInCommandModeRef.current || !recognitionRef.current) return
                pendingDetectionRef.current = true
                isAbortingRef.current = true
                recognitionRef.current.stop()
                wakeWordOnlyTimeoutRef.current = null
              }, 600)
            }
            return
          }
        } else if (isInCommandModeRef.current && isFinal) {
          // User spoke something AFTER the interim wake word but in a separate final result
          if (wakeWordOnlyTimeoutRef.current) {
            clearTimeout(wakeWordOnlyTimeoutRef.current)
            wakeWordOnlyTimeoutRef.current = null
          }
          pendingCommandRef.current = transcript
          isAbortingRef.current = true
          recognition.stop()
        }
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
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
    isInCommandModeRef.current = false
    pendingDetectionRef.current = false
    pendingCommandRef.current = null
    if (wakeWordOnlyTimeoutRef.current) {
      clearTimeout(wakeWordOnlyTimeoutRef.current)
      wakeWordOnlyTimeoutRef.current = null
    }

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
      }, 400)
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
    lastHeard: lastHeardRef.current,
    error,
    startListening,
    stopListening,
    resumeListening,
  }
}

// Shared AudioContext to better handle browser autoplay policies
let sharedAudioContext: AudioContext | null = null
let wakeAudioUnlocked = false
let wakeAudioUnlockBootstrapped = false

function getAudioContext(createIfMissing = true) {
  if (!createIfMissing) return sharedAudioContext

  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      sharedAudioContext = new AudioContextClass()
    }
  }
  return sharedAudioContext
}

function bootstrapWakeAudioUnlock() {
  if (wakeAudioUnlockBootstrapped || typeof window === 'undefined') return
  wakeAudioUnlockBootstrapped = true

  const tryUnlock = () => {
    const audioContext = getAudioContext()
    if (!audioContext) return

    void audioContext
      .resume()
      .then(() => {
        if (audioContext.state === 'running') {
          wakeAudioUnlocked = true
          window.removeEventListener('pointerdown', tryUnlock)
          window.removeEventListener('touchstart', tryUnlock)
          window.removeEventListener('keydown', tryUnlock)
        }
      })
      .catch(() => {
        // Ignore - still waiting for a valid user gesture.
      })
  }

  window.addEventListener('pointerdown', tryUnlock, { passive: true })
  window.addEventListener('touchstart', tryUnlock, { passive: true })
  window.addEventListener('keydown', tryUnlock)
}

// Play a sound when wake word is detected
export function playWakeSound() {
  try {
    // Never attempt resume outside a user gesture - Chrome logs noisy autoplay warnings.
    // We unlock once on an actual pointer/key interaction, then beep becomes available.
    bootstrapWakeAudioUnlock()
    if (!wakeAudioUnlocked) return

    const audioContext = getAudioContext(false)
    if (!audioContext) return

    const playBeep = () => {
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
    }

    if (audioContext.state !== 'running') return

    playBeep()
  } catch (e) {
    // Ignore wake sound failures to avoid noisy console output.
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
