import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RefObject } from 'react'
import { useHaccpVoiceController } from '@/hooks/useHaccpVoiceController'
import type { VoiceButtonHandle } from '@/components/voice/VoiceButton'
import type { HaccpWorkflow } from '@/types'

function createVoiceRef(): RefObject<VoiceButtonHandle | null> {
  return {
    current: {
      triggerVoice: vi.fn(),
      stopVoice: vi.fn(),
      speakText: vi.fn(() => true),
      isRealtimeConversation: false,
    },
  }
}

function createWorkflow(overrides: Partial<HaccpWorkflow> = {}): HaccpWorkflow {
  return {
    id: 'wf-1',
    batch_id: 'batch-1',
    site_id: 'site-1',
    workflow_kind: 'hot_hold',
    state: 'active',
    title: 'Soup hot hold',
    item_name: 'Soup',
    item_category: 'soup',
    started_at: new Date().toISOString(),
    location_kind: 'hot_hold',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function createMutations() {
  return {
    startCooking: { mutateAsync: vi.fn() },
    completeCooking: { mutateAsync: vi.fn() },
    startCooling: { mutateAsync: vi.fn() },
    completeCooling: { mutateAsync: vi.fn() },
    startReheating: { mutateAsync: vi.fn() },
    completeReheating: { mutateAsync: vi.fn() },
    startHotHold: { mutateAsync: vi.fn() },
    logHotHoldCheck: { mutateAsync: vi.fn() },
    stopHotHold: { mutateAsync: vi.fn() },
    transitionToCooling: { mutateAsync: vi.fn() },
    markReminderDelivered: { mutateAsync: vi.fn() },
  }
}

describe('useHaccpVoiceController', () => {
  it('starts cooking once the item is known without asking for a start temperature', async () => {
    const voiceRef = createVoiceRef()
    const mutations = createMutations()

    const { result } = renderHook(() =>
      useHaccpVoiceController({
        siteId: 'site-1',
        workflows: [],
        reminders: [],
        actor: { id: 'staff-1', name: 'Alice' },
        voiceButtonRef: voiceRef,
        isVoiceBusy: false,
        onOpenStartDialog: vi.fn(),
        onOpenActionDialog: vi.fn(),
        mutations,
      }),
    )

    await act(async () => {
      await result.current.handleVoiceCommand({ type: 'start_cooking' })
    })

    expect(result.current.conversationMode).toBe(true)

    await act(async () => {
      await result.current.handleConversationTranscript('Soup')
    })

    expect(mutations.startCooking.mutateAsync).toHaveBeenCalledWith({
      siteId: 'site-1',
      itemName: 'Soup',
      startedBy: { id: 'staff-1', name: 'Alice' },
    })
    expect(result.current.conversationMode).toBe(false)
  })

  it('refuses HACCP voice actions when no operator is selected', async () => {
    const voiceRef = createVoiceRef()
    const mutations = createMutations()

    const { result } = renderHook(() =>
      useHaccpVoiceController({
        siteId: 'site-1',
        workflows: [],
        reminders: [],
        actor: null,
        voiceButtonRef: voiceRef,
        isVoiceBusy: false,
        onOpenStartDialog: vi.fn(),
        onOpenActionDialog: vi.fn(),
        mutations,
      }),
    )

    await act(async () => {
      await result.current.handleVoiceCommand({ type: 'start_cooking', item: 'Soup' })
    })

    expect(mutations.startCooking.mutateAsync).not.toHaveBeenCalled()
    expect(voiceRef.current?.speakText).toHaveBeenCalled()
    expect(result.current.conversationMode).toBe(false)
  })

  it('requires corrective action for unsafe hot hold checks', async () => {
    const voiceRef = createVoiceRef()
    const mutations = createMutations()
    const workflow = createWorkflow()

    const { result } = renderHook(() =>
      useHaccpVoiceController({
        siteId: 'site-1',
        workflows: [workflow],
        reminders: [],
        actor: { id: 'staff-1', name: 'Alice' },
        voiceButtonRef: voiceRef,
        isVoiceBusy: false,
        onOpenStartDialog: vi.fn(),
        onOpenActionDialog: vi.fn(),
        mutations,
      }),
    )

    await act(async () => {
      await result.current.handleVoiceCommand({ type: 'log_hot_hold_check', item: 'Soup', temperature: 58 })
    })

    expect(result.current.conversationMode).toBe(true)

    await act(async () => {
      await result.current.handleConversationTranscript('reheat')
    })

    expect(mutations.logHotHoldCheck.mutateAsync).toHaveBeenCalledWith({
      workflowId: 'wf-1',
      temperature: 58,
      correctiveAction: 'reheat',
      actor: { id: 'staff-1', name: 'Alice' },
    })
    expect(result.current.conversationMode).toBe(false)
  })

  it('collects a cooling temperature and starts the workflow', async () => {
    const voiceRef = createVoiceRef()
    const mutations = createMutations()

    const { result } = renderHook(() =>
      useHaccpVoiceController({
        siteId: 'site-1',
        workflows: [],
        reminders: [],
        actor: { id: 'staff-1', name: 'Alice' },
        voiceButtonRef: voiceRef,
        isVoiceBusy: false,
        onOpenStartDialog: vi.fn(),
        onOpenActionDialog: vi.fn(),
        mutations,
      }),
    )

    await act(async () => {
      await result.current.handleVoiceCommand({ type: 'start_cooling', item: 'Stock' })
    })

    expect(result.current.conversationMode).toBe(true)

    await act(async () => {
      await result.current.handleConversationTranscript('12 degrees')
    })

    expect(mutations.startCooling.mutateAsync).toHaveBeenCalledWith({
      siteId: 'site-1',
      itemName: 'Stock',
      initialTemperature: 12,
      startedBy: { id: 'staff-1', name: 'Alice' },
      locationKind: 'kitchen',
    })
    expect(result.current.conversationMode).toBe(false)
  })

  it('syncs the completion dialog and starts cooling after compliant cook completion', async () => {
    const voiceRef = createVoiceRef()
    const mutations = createMutations()
    const workflow = createWorkflow({
      workflow_kind: 'cooking',
      item_name: 'Tomato Sauce',
      state: 'active',
      location_kind: 'kitchen',
    })
    const onSyncActionDialog = vi.fn()

    const { result } = renderHook(() =>
      useHaccpVoiceController({
        siteId: 'site-1',
        workflows: [workflow],
        reminders: [],
        actor: { id: 'staff-1', name: 'Alice' },
        voiceButtonRef: voiceRef,
        isVoiceBusy: false,
        onOpenStartDialog: vi.fn(),
        onOpenActionDialog: vi.fn(),
        onSyncActionDialog,
        mutations,
      }),
    )

    await act(async () => {
      await result.current.handleVoiceCommand({ type: 'complete_cooking', item: 'Tomato Sauce' })
    })

    expect(onSyncActionDialog).toHaveBeenLastCalledWith({
      workflow,
      mode: 'complete',
    })

    await act(async () => {
      await result.current.handleConversationTranscript('78 degrees')
    })

    expect(onSyncActionDialog).toHaveBeenCalledWith({
      workflow,
      mode: 'complete',
      prefill: { temperature: 78 },
    })
    expect(result.current.conversationMode).toBe(true)

    await act(async () => {
      await result.current.handleConversationTranscript('start cooling')
    })

    expect(onSyncActionDialog).toHaveBeenCalledWith({
      workflow,
      mode: 'complete',
      prefill: { temperature: 78, postCompletionAction: 'start_cooling' },
    })
    expect(mutations.completeCooking.mutateAsync).toHaveBeenCalledWith({
      workflowId: 'wf-1',
      temperature: 78,
      completedBy: { id: 'staff-1', name: 'Alice' },
    })
    expect(mutations.transitionToCooling.mutateAsync).toHaveBeenCalledWith({
      workflowId: 'wf-1',
      actor: { id: 'staff-1', name: 'Alice' },
    })
    expect(result.current.conversationMode).toBe(false)
  })

  it('completes active cooling after collecting the final temperature', async () => {
    const voiceRef = createVoiceRef()
    const mutations = createMutations()
    const workflow = createWorkflow({
      workflow_kind: 'cooling',
      item_name: 'Soup',
      state: 'active',
      location_kind: 'kitchen',
    })

    const { result } = renderHook(() =>
      useHaccpVoiceController({
        siteId: 'site-1',
        workflows: [workflow],
        reminders: [],
        actor: { id: 'staff-1', name: 'Alice' },
        voiceButtonRef: voiceRef,
        isVoiceBusy: false,
        onOpenStartDialog: vi.fn(),
        onOpenActionDialog: vi.fn(),
        mutations,
      }),
    )

    await act(async () => {
      await result.current.handleVoiceCommand({ type: 'stop_cooling', item: 'Soup' })
    })

    expect(result.current.conversationMode).toBe(true)

    await act(async () => {
      await result.current.handleConversationTranscript('5 degrees')
    })

    expect(mutations.completeCooling.mutateAsync).toHaveBeenCalledWith({
      workflowId: 'wf-1',
      temperature: 5,
      completedBy: { id: 'staff-1', name: 'Alice' },
      locationKind: 'fridge',
    })
    expect(result.current.conversationMode).toBe(false)
  })

  it('falls back to the exact manual form after three failed validations', async () => {
    const voiceRef = createVoiceRef()
    const mutations = createMutations()
    const onOpenStartDialog = vi.fn()

    const { result } = renderHook(() =>
      useHaccpVoiceController({
        siteId: 'site-1',
        workflows: [],
        reminders: [],
        actor: { id: 'staff-1', name: 'Alice' },
        voiceButtonRef: voiceRef,
        isVoiceBusy: false,
        onOpenStartDialog,
        onOpenActionDialog: vi.fn(),
        mutations,
      }),
    )

    await act(async () => {
      await result.current.handleVoiceCommand({ type: 'start_cooking' })
    })

    await act(async () => {
      await result.current.handleConversationTranscript('')
    })
    await act(async () => {
      await result.current.handleConversationTranscript('')
    })
    await act(async () => {
      await result.current.handleConversationTranscript('')
    })

    expect(onOpenStartDialog).toHaveBeenCalledWith({ kind: 'cooking', itemName: undefined })
  })
})
