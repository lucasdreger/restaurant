import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceCloseFlow } from '@/hooks/useVoiceCloseFlow'

describe('useVoiceCloseFlow', () => {
  it('advances staff -> temperature -> confirmation with natural speech inputs', async () => {
    const speak = vi.fn((_text: string, opts?: any) => {
      // Simulate TTS finishing immediately to trigger mic capture.
      opts?.onComplete?.()
    })
    const onAwaitingInput = vi.fn()
    const onOpenModal = vi.fn()
    const onCloseModal = vi.fn()
    const onConfirm = vi.fn()

    const sessions: any[] = [
      { id: 's1', item_name: 'Pasta', started_at: new Date().toISOString() },
    ]
    const staffMembers: any[] = [
      { id: 'st1', name: 'Alice', staff_code: '1', active: true },
    ]

    const { result } = renderHook(() =>
      useVoiceCloseFlow({
        sessions,
        staffMembers,
        onConfirm,
        onOpenModal,
        onCloseModal,
        speak,
        onAwaitingInput,
      })
    )

    act(() => {
      result.current.startFlow('pasta')
    })

    expect(onOpenModal).toHaveBeenCalledWith('s1')
    expect(result.current.step).toBe('awaiting_staff')

    // Staff code via text number
    await act(async () => {
      await result.current.handleTranscript('one')
    })
    expect(result.current.step).toBe('awaiting_temperature')

    // Temperature with decimals; we should not require early stop.
    await act(async () => {
      await result.current.handleTranscript('one point five')
    })
    expect(result.current.step).toBe('awaiting_confirmation')

    await act(async () => {
      await result.current.handleTranscript('confirm')
    })

    expect(onConfirm).toHaveBeenCalledWith('s1', {
      staffId: 'st1',
      staffName: 'Alice',
      temperature: 1.5,
    })
    expect(onCloseModal).toHaveBeenCalled()
    expect(result.current.step).toBe('idle')
  })

  it('does not stop early on interim temperature numbers (avoids truncating decimals)', async () => {
    const speak = vi.fn((_text: string, opts?: any) => opts?.onComplete?.())
    const onStopListening = vi.fn()

    const sessions: any[] = [{ id: 's1', item_name: 'Pasta', started_at: new Date().toISOString() }]
    const staffMembers: any[] = [{ id: 'st1', name: 'Alice', staff_code: '1', active: true }]

    const { result } = renderHook(() =>
      useVoiceCloseFlow({
        sessions,
        staffMembers,
        onConfirm: vi.fn(),
        onOpenModal: vi.fn(),
        onCloseModal: vi.fn(),
        speak,
        onAwaitingInput: vi.fn(),
        onStopListening,
      })
    )

    act(() => result.current.startFlow('pasta'))

    await act(async () => {
      await result.current.handleTranscript('one')
    })
    expect(result.current.step).toBe('awaiting_temperature')

    // Interim “one” should NOT auto-stop the mic for temperature.
    act(() => {
      const shouldStop = result.current.checkInterimTranscript('one')
      expect(shouldStop).toBe(false)
    })
    expect(onStopListening).not.toHaveBeenCalled()
  })

  it('interprets homophone "for" as 4 for temperature', async () => {
    const speak = vi.fn((_text: string, opts?: any) => opts?.onComplete?.())
    const onConfirm = vi.fn()

    const sessions: any[] = [{ id: 's1', item_name: 'Pasta', started_at: new Date().toISOString() }]
    const staffMembers: any[] = [{ id: 'st1', name: 'Alice', staff_code: '1', active: true }]

    const { result } = renderHook(() =>
      useVoiceCloseFlow({
        sessions,
        staffMembers,
        onConfirm,
        onOpenModal: vi.fn(),
        onCloseModal: vi.fn(),
        speak,
        onAwaitingInput: vi.fn(),
      })
    )

    act(() => result.current.startFlow('pasta'))

    await act(async () => {
      await result.current.handleTranscript('one')
    })
    expect(result.current.step).toBe('awaiting_temperature')

    await act(async () => {
      await result.current.handleTranscript('for')
    })

    expect(result.current.temperature).toBe(4)
    expect(result.current.step).toBe('awaiting_confirmation')
  })
})
