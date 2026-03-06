import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBrowserSpeech } from '@/hooks/useBrowserSpeech'
import { browserSpeechService } from '@/services/browserSpeechService'

describe('useBrowserSpeech', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Make hook think SpeechRecognition is supported in unit tests
    ;(browserSpeechService as any).recognition = {} // non-null => isSupported true
    vi.spyOn(browserSpeechService, 'start').mockImplementation(() => {})

    // Reset singleton callbacks between tests
    ;(browserSpeechService as any).onResultCallback = null
    ;(browserSpeechService as any).onEndCallback = null
    ;(browserSpeechService as any).onErrorCallback = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('flushes last interim as final when stopped early and no final arrives', () => {
    const finals: string[] = []

    const { result } = renderHook(() =>
      useBrowserSpeech({
        flushInterimAsFinalOnEnd: true,
        onTranscript: (t, isFinal) => {
          if (isFinal) finals.push(t)
        },
      })
    )

    act(() => {
      result.current.startListening()
    })

    // Feed interim only
    act(() => {
      ;(browserSpeechService as any).onResultCallback?.({ transcript: 'one', confidence: 0.5, isFinal: false })
    })

    // Stop and end without final
    act(() => {
      result.current.stopListening()
      ;(browserSpeechService as any).onEndCallback?.()
    })

    expect(finals.at(-1)).toBe('one')
  })

  it('resets post-speech timer on each interim result (no premature cut)', () => {
    const stopSpy = vi.spyOn(browserSpeechService, 'stop')

    const { result } = renderHook(() =>
      useBrowserSpeech({
        silenceTimeout: 0,
        postSpeechTimeout: 1000,
      })
    )

    act(() => {
      result.current.startListening()
    })

    act(() => {
      ;(browserSpeechService as any).onResultCallback?.({ transcript: 'one', confidence: 0.5, isFinal: false })
    })

    act(() => {
      vi.advanceTimersByTime(700)
    })

    act(() => {
      ;(browserSpeechService as any).onResultCallback?.({ transcript: 'one point', confidence: 0.5, isFinal: false })
    })

    act(() => {
      vi.advanceTimersByTime(700)
    })

    // If the timer didn't reset on the second result, stop() would have been called at t=1000ms.
    expect(stopSpy).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(400)
    })

    // Now it should stop after 1000ms of inactivity since the last interim.
    expect(stopSpy).toHaveBeenCalledTimes(1)
  })
})
