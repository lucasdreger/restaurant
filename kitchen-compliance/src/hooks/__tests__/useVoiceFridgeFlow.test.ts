import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceFridgeFlow } from '@/hooks/useVoiceFridgeFlow'

describe('useVoiceFridgeFlow', () => {
  it('logs fridge temp with negative decimal and confirms', async () => {
    const speak = vi.fn((_text: string, opts?: any) => opts?.onComplete?.())
    const onOpenModal = vi.fn()
    const onCloseModal = vi.fn()
    const onConfirm = vi.fn()

    const fridges: any[] = [
      { id: 'f1', name: 'Main Fridge', fridge_code: '1' },
    ]
    const staffMembers: any[] = [
      { id: 'st1', name: 'Alice', staff_code: '1', active: true },
    ]

    const { result } = renderHook(() =>
      useVoiceFridgeFlow({
        fridges,
        staffMembers,
        onConfirm,
        onOpenModal,
        onCloseModal,
        speak,
        onAwaitingInput: vi.fn(),
        onStopListening: vi.fn(),
      })
    )

    act(() => {
      result.current.startFlow('1')
    })
    expect(result.current.step).toBe('awaiting_temperature')

    await act(async () => {
      await result.current.handleTranscript('minus one point five')
    })
    expect(result.current.step).toBe('awaiting_staff')
    expect(result.current.temperature).toBe(-1.5)

    await act(async () => {
      await result.current.handleTranscript('one')
    })
    expect(result.current.step).toBe('awaiting_confirmation')

    await act(async () => {
      await result.current.handleTranscript('confirm')
    })

    expect(onConfirm).toHaveBeenCalledWith({ fridgeId: 'f1', temperature: -1.5, staffId: 'st1' })
    expect(onCloseModal).toHaveBeenCalled()
    expect(result.current.step).toBe('idle')
  })

  it('does not stop early on interim temperature numbers', async () => {
    const speak = vi.fn((_text: string, opts?: any) => opts?.onComplete?.())
    const onStopListening = vi.fn()

    const fridges: any[] = [{ id: 'f1', name: 'Main Fridge', fridge_code: '1' }]
    const staffMembers: any[] = [{ id: 'st1', name: 'Alice', staff_code: '1', active: true }]

    const { result } = renderHook(() =>
      useVoiceFridgeFlow({
        fridges,
        staffMembers,
        onConfirm: vi.fn(),
        onOpenModal: vi.fn(),
        onCloseModal: vi.fn(),
        speak,
        onAwaitingInput: vi.fn(),
        onStopListening,
      })
    )

    act(() => result.current.startFlow('1'))
    expect(result.current.step).toBe('awaiting_temperature')

    act(() => {
      const shouldStop = result.current.checkInterimTranscript('one')
      expect(shouldStop).toBe(false)
    })
    expect(onStopListening).not.toHaveBeenCalled()
  })

  it('interprets homophone "for" as 4 for fridge temperature', async () => {
    const speak = vi.fn((_text: string, opts?: any) => opts?.onComplete?.())

    const fridges: any[] = [{ id: 'f1', name: 'Main Fridge', fridge_code: '1' }]
    const staffMembers: any[] = [{ id: 'st1', name: 'Alice', staff_code: '1', active: true }]

    const { result } = renderHook(() =>
      useVoiceFridgeFlow({
        fridges,
        staffMembers,
        onConfirm: vi.fn(),
        onOpenModal: vi.fn(),
        onCloseModal: vi.fn(),
        speak,
        onAwaitingInput: vi.fn(),
        onStopListening: vi.fn(),
      })
    )

    act(() => result.current.startFlow('1'))
    expect(result.current.step).toBe('awaiting_temperature')

    await act(async () => {
      await result.current.handleTranscript('for')
    })

    expect(result.current.temperature).toBe(4)
    expect(result.current.step).toBe('awaiting_staff')
  })
})
