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
  /**
   * If the browser never emits a final result (common when stopping early),
   * treat the last interim as final on end.
   *
   * Recommended for interview/conversation flows where "no progress" is worse than imperfect text.
   */
  flushInterimAsFinalOnEnd?: boolean

  /**
   * If no speech is detected (silence/no-speech) and the session ends,
   * emit an empty final transcript. This allows interview flows to retry
   * instead of stalling silently.
   */
  emitEmptyFinalOnNoSpeech?: boolean
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
    postSpeechTimeout = 1500,
    flushInterimAsFinalOnEnd = false,
    emitEmptyFinalOnNoSpeech = false,
  } = options
  
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const isListeningRef = useRef(false)
  const speechDetectedRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastHeardRef = useRef('')
  const sawFinalRef = useRef(false)
  const flushEnabledRef = useRef(flushInterimAsFinalOnEnd)
  const emitEmptyFinalRef = useRef(emitEmptyFinalOnNoSpeech)
  const shouldFlushOnEndRef = useRef(false)
  
  const { settings } = useAppStore()

  const isSupported = browserSpeechService.isSupported

  // Set up callbacks
  useEffect(() => {
    flushEnabledRef.current = flushInterimAsFinalOnEnd
    emitEmptyFinalRef.current = emitEmptyFinalOnNoSpeech

    browserSpeechService.onResult((result) => {
      console.log('[useBrowserSpeech] Result:', result, 'speechDetected:', speechDetectedRef.current)

      // Keep the latest transcript so we can flush it if the browser never emits a final
      // (common when we stop recognition early on a short answer like "one"). 
      lastHeardRef.current = result.transcript
      if (result.isFinal) {
        sawFinalRef.current = true
      }
      
      // Speech activity tracking:
      // 1) Before any speech is detected, we run a longer silence timeout.
      // 2) After speech starts, we stop after `postSpeechTimeout` ms of *inactivity*.
      // Important: reset the post-speech timer on each result so multi-word answers
      // (e.g. "one point five") aren't cut off after the first token.
      const hasText = result.transcript.trim().length > 0
      if (hasText) {
        if (!speechDetectedRef.current) {
          speechDetectedRef.current = true
          console.log('[useBrowserSpeech] Speech detected! Starting post-speech timeout:', postSpeechTimeout, 'ms')
        }

        if (postSpeechTimeout > 0) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          timeoutRef.current = setTimeout(() => {
            console.log('[useBrowserSpeech] Post-speech inactivity timeout reached, stopping...')
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

      // If we never got a final result, optionally treat last interim as final.
      // This prevents flows from "stalling" after short answers (e.g. "one").
      if ((shouldFlushOnEndRef.current || flushEnabledRef.current) && !sawFinalRef.current && speechDetectedRef.current) {
        const text = lastHeardRef.current.trim()
        if (text.length > 0) {
          console.log('[useBrowserSpeech] Flushing interim as final:', text)
          setTranscript(text)
          setInterimTranscript('')
          onTranscript?.(text, true)
        }
      }

      // If no speech was detected at all, optionally emit an empty final transcript.
      // This gives interview flows a chance to prompt retry instead of doing nothing.
      if (emitEmptyFinalRef.current && !sawFinalRef.current && !speechDetectedRef.current) {
        console.log('[useBrowserSpeech] No speech detected; emitting empty final transcript')
        setTranscript('')
        setInterimTranscript('')
        onTranscript?.('', true)
      }

      // Clear timeout on end
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setIsListening(false)
      isListeningRef.current = false
      shouldFlushOnEndRef.current = false
      sawFinalRef.current = false
      onEnd?.()
    })
  }, [onTranscript, onError, onEnd, postSpeechTimeout, flushInterimAsFinalOnEnd, emitEmptyFinalOnNoSpeech])

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
    lastHeardRef.current = ''
    sawFinalRef.current = false
    shouldFlushOnEndRef.current = false

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
    shouldFlushOnEndRef.current = true
    browserSpeechService.stop()
  }, [clearTimeoutIfActive])

  const abortListening = useCallback(() => {
    clearTimeoutIfActive()
    if (!isListeningRef.current) return

    console.log('[useBrowserSpeech] Aborting...')
    shouldFlushOnEndRef.current = false
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
