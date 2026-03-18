import { act, fireEvent, render, screen } from '@testing-library/react'
import { forwardRef, useImperativeHandle } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from '@/components/screens/Dashboard'
import type { HaccpReminder, HaccpWorkflow, StaffMember } from '@/types'

const mockCurrentSite = { id: 'site-1', name: 'Test Site' }
const mockSettings = {
  wakeWordEnabled: false,
  activeWakeWords: ['luma'],
  voiceProvider: 'browser',
}
const mockWorkflows: HaccpWorkflow[] = []
const mockReminders: HaccpReminder[] = []
const mockStaff: StaffMember[] = []
let mockActiveStaffId: string | null = null
const mockMutations = {
  startCooking: { isPending: false, mutateAsync: vi.fn() },
  completeCooking: { isPending: false, mutateAsync: vi.fn() },
  startCooling: { isPending: false, mutateAsync: vi.fn() },
  completeCooling: { isPending: false, mutateAsync: vi.fn() },
  startReheating: { isPending: false, mutateAsync: vi.fn() },
  completeReheating: { isPending: false, mutateAsync: vi.fn() },
  startHotHold: { isPending: false, mutateAsync: vi.fn() },
  logHotHoldCheck: { isPending: false, mutateAsync: vi.fn() },
  stopHotHold: { isPending: false, mutateAsync: vi.fn() },
  transitionToCooling: { isPending: false, mutateAsync: vi.fn() },
}

vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <div>Sidebar</div>,
  MobileNav: () => null,
}))

vi.mock('@/components/layout/DashboardHeader', () => ({
  DashboardHeader: () => <div>Header</div>,
  ProgressCard: () => <div>Progress</div>,
}))

vi.mock('@/components/fridge/FridgeTempModal', () => ({
  FridgeTempModal: () => null,
}))

vi.mock('@/components/haccp/HaccpOperatorQuickPickDialog', () => ({
  HaccpOperatorQuickPickDialog: () => null,
}))

vi.mock('@/components/haccp/LegacyHaccpBoard', () => ({
  LegacyHaccpBoard: ({
    onStartWorkflow,
  }: {
    onStartWorkflow?: (kind: 'cooking' | 'cooling' | 'reheating' | 'hot_hold') => void
  }) => (
    <div>
      <button type="button" aria-label="Start cook workflow" onClick={() => onStartWorkflow?.('cooking')}>
        Cook icon
      </button>
      <button type="button" aria-label="Start cool workflow" onClick={() => onStartWorkflow?.('cooling')}>
        Cool icon
      </button>
      <button type="button" aria-label="Start reheat workflow" onClick={() => onStartWorkflow?.('reheating')}>
        Reheat icon
      </button>
      <button type="button" aria-label="Start hold workflow" onClick={() => onStartWorkflow?.('hot_hold')}>
        Hold icon
      </button>
    </div>
  ),
}))

vi.mock('@/components/voice/VoiceButton', () => ({
  VoiceButton: forwardRef((_props, ref) => {
    useImperativeHandle(ref, () => ({
      stopVoice: vi.fn(),
      triggerVoice: vi.fn(),
    }))

    return <button type="button">Voice</button>
  }),
}))

vi.mock('@/components/haccp/HaccpWorkflowDialogs', () => ({
  HaccpStartWorkflowDialog: ({
    open,
    context,
    defaultStaffId,
  }: {
    open: boolean
    context: { kind: string } | null
    defaultStaffId?: string | null
  }) => (open && context ? <div>start-dialog:{context.kind}:{defaultStaffId ?? 'none'}</div> : null),
  HaccpWorkflowActionDialog: () => null,
}))

vi.mock('@/store/useAppStore', () => ({
  WAKE_WORD_OPTIONS: [{ id: 'luma', label: 'Luma' }],
  getUnacknowledgedAlerts: () => [],
  useAppStoreShallow: (selector: (state: any) => any) =>
    selector({
      currentSite: mockCurrentSite,
      alerts: [],
      acknowledgeAlert: vi.fn(),
      settings: mockSettings,
      activeStaffId: mockActiveStaffId,
    }),
  useAppStore: () => ({
    currentSite: mockCurrentSite,
    alerts: [],
    acknowledgeAlert: vi.fn(),
    settings: mockSettings,
    activeStaffId: mockActiveStaffId,
  }),
}))

vi.mock('@/hooks/useVoiceRecognition', () => ({
  useTextToSpeech: () => ({
    speak: vi.fn(),
  }),
}))

vi.mock('@/hooks/useVoiceFridgeFlow', () => ({
  useVoiceFridgeFlow: () => ({
    step: 'idle',
    isQuickResponseStep: false,
    temperature: null,
    staffId: null,
    startFlow: vi.fn(),
    handleTranscript: vi.fn(),
    checkInterimTranscript: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('@/hooks/useWakeWord', () => ({
  useWakeWord: () => ({
    isActive: false,
    resumeListening: vi.fn(),
  }),
  playWakeSound: vi.fn(),
  getPrimaryWakeWordLabel: () => 'Luma',
}))

vi.mock('@/services/fridgeService', () => ({
  logFridgeTemp: vi.fn(),
}))

vi.mock('@/hooks/queries/useFridges', () => ({
  useFridges: () => ({
    data: [],
  }),
}))

vi.mock('@/hooks/queries/useStaff', () => ({
  useStaff: () => ({
    data: mockStaff,
  }),
}))

vi.mock('@/hooks/queries/useHaccp', () => ({
  useHaccpWorkflows: () => ({
    data: mockWorkflows,
  }),
  useHaccpReminders: () => ({
    data: mockReminders,
  }),
  useHaccpMutations: () => mockMutations,
}))

vi.mock('@/hooks/useHaccpVoiceController', () => ({
  useHaccpVoiceController: () => ({
    conversationMode: false,
    handleVoiceCommand: vi.fn().mockResolvedValue(false),
    handleConversationTranscript: vi.fn(),
    cancelConversation: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

afterEach(() => {
  mockWorkflows.length = 0
  mockReminders.length = 0
  mockStaff.length = 0
  mockActiveStaffId = null
  vi.clearAllMocks()
})

describe('Dashboard', () => {
  it('opens the matching start dialog when a legacy board icon is clicked', async () => {
    await act(async () => {
      render(<Dashboard />)
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: /start cook workflow/i }))
    expect(await screen.findByText('start-dialog:cooking:none')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /start cool workflow/i }))
    expect(await screen.findByText('start-dialog:cooling:none')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /start reheat workflow/i }))
    expect(await screen.findByText('start-dialog:reheating:none')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /start hold workflow/i }))
    expect(await screen.findByText('start-dialog:hot_hold:none')).toBeTruthy()
  })

  it('falls back to the first real staff member when persisted kiosk state is invalid', async () => {
    mockActiveStaffId = 'auth-user-1'
    mockStaff.push({
      id: 'staff-1',
      site_id: 'site-1',
      name: 'Alice',
      initials: 'A',
      role: 'staff',
      active: true,
      staff_code: '001',
      created_at: '2026-03-17T08:00:00.000Z',
    })

    await act(async () => {
      render(<Dashboard />)
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: /start cook workflow/i }))
    expect(await screen.findByText('start-dialog:cooking:staff-1')).toBeTruthy()
  })
})
