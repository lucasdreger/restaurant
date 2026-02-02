import { useCallback, useState, useEffect, useRef } from 'react'
import { browserSpeechService } from '@/services/browserSpeechService'
import { useAppStore } from '@/store/useAppStore'

interface UseBrowserSpeechOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void
  onError?: (error: string) => void
  onEnd?: () => void
  continuous?: boolean
  silenceTimeout?: number // Auto-stop after this many ms if no speech detected (default: 5000)
  postSpeechTimeout?: number // Auto-stop after this many ms once speech is detected (default: 1500)
}

/**
 * Hook for using browser's native Speech Recognition
 * Best for conversation flows where immediate feedback is needed
 */
export function useBrowserSpeech(options: UseBrowserSpeechOptions = {}) {
  const { 
    onTranscript, 
    onError, 
    onEnd, 
    continuous = false, 
    silenceTimeout = 5000,
    postSpeechTimeout = 1500
  } = options
  
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const isListeningRef = useRef(false)
  const speechDetectedRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const { settings } = useAppStore()

  const isSupported = browserSpeechService.isSupported

  // Set up callbacks
  useEffect(() => {
    browserSpeechService.onResult((result) => {
      console.log('[useBrowserSpeech] Result:', result, 'speechDetected:', speechDetectedRef.current)
      
      // Detect speech for the first time - switch to shorter timeout
      if (!speechDetectedRef.current && result.transcript.trim().length > 0) {
        speechDetectedRef.current = true
        console.log('[useBrowserSpeech] Speech detected! Switching to post-speech timeout:', postSpeechTimeout, 'ms')
        
        // Clear silence timeout and start post-speech timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        
        if (postSpeechTimeout > 0) {
          timeoutRef.current = setTimeout(() => {
            console.log('[useBrowserSpeech] Post-speech timeout reached, stopping...')
            if (isListeningRef.current) {
              browserSpeechService.stop()
            }
          }, postSpeechTimeout)
        }
      }
      
      if (result.isFinal) {
        // Clear timeout when we get a final result
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        setTranscript(result.transcript)
        setInterimTranscript('')
        onTranscript?.(result.transcript, true)
      } else {
        setInterimTranscript(result.transcript)
        onTranscript?.(result.transcript, false)
      }
    })

    browserSpeechService.onError((errorMessage) => {
      console.error('[useBrowserSpeech] Error:', errorMessage)
      // Clear timeout on error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setError(errorMessage)
      setIsListening(false)
      isListeningRef.current = false
      onError?.(errorMessage)
    })

    browserSpeechService.onEnd(() => {
      console.log('[useBrowserSpeech] Ended')
      // Clear timeout on end
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setIsListening(false)
      isListeningRef.current = false
      onEnd?.()
    })
  }, [onTranscript, onError, onEnd, postSpeechTimeout])

  // Clear timeout helper
  const clearTimeoutIfActive = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    if (!isSupported) {
      const msg = 'Speech Recognition not supported in this browser'
      setError(msg)
      onError?.(msg)
      return
    }

    if (isListeningRef.current) {
      console.log('[useBrowserSpeech] Already listening')
      return
    }

    console.log('[useBrowserSpeech] Starting - silence timeout:', silenceTimeout, 'ms')
    setTranscript('')
    setInterimTranscript('')
    setError(null)
    setIsListening(true)
    isListeningRef.current = true
    speechDetectedRef.current = false

    browserSpeechService.start({
      language: settings.language === 'en' ? 'en-IE' : settings.language,
      continuous,
      interimResults: true,
    })

    // Initial silence timeout - stop if no speech detected
    if (silenceTimeout > 0) {
      clearTimeoutIfActive()
      timeoutRef.current = setTimeout(() => {
        console.log('[useBrowserSpeech] Silence timeout reached, stopping...')
        if (isListeningRef.current) {
          browserSpeechService.stop()
        }
      }, silenceTimeout)
    }
  }, [isSupported, settings.language, continuous, silenceTimeout, onError, clearTimeoutIfActive])

  const stopListening = useCallback(() => {
    clearTimeoutIfActive()
    if (!isListeningRef.current) return

    console.log('[useBrowserSpeech] Stopping...')
    browserSpeechService.stop()
  }, [clearTimeoutIfActive])

  const abortListening = useCallback(() => {
    clearTimeoutIfActive()
    if (!isListeningRef.current) return

    console.log('[useBrowserSpeech] Aborting...')
    browserSpeechService.abort()
    setIsListening(false)
    isListeningRef.current = false
    setTranscript('')
    setInterimTranscript('')
  }, [clearTimeoutIfActive])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearTimeoutIfActive()
    }
  }, [clearTimeoutIfActive])

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    abortListening,
  }
}
