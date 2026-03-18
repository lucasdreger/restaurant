import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HaccpDashboard } from '@/components/screens/HaccpDashboard'
import type { HaccpReminder, HaccpWorkflow, StaffMember } from '@/types'

const mockUser = { id: 'user-1' }
const mockCurrentSite = { id: 'site-1' }
const mockSettings = {
  wakeWordEnabled: false,
  activeWakeWords: ['luma'],
}
const mockStaff: StaffMember[] = []
let mockActiveStaffId: string | null = null
const mockWorkflows: HaccpWorkflow[] = []
const mockReminders: HaccpReminder[] = []
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

function createWorkflow(overrides: Partial<HaccpWorkflow> = {}): HaccpWorkflow {
  const now = '2026-03-16T10:00:00.000Z'

  return {
    id: 'workflow-1',
    batch_id: 'batch-1',
    site_id: 'site-1',
    workflow_kind: 'cooling',
    state: 'active',
    title: 'Cool sauce',
    item_name: 'Bechamel',
    item_category: 'sauce',
    started_at: now,
    location_kind: 'kitchen',
    location_label: 'Kitchen',
    created_at: now,
    ...overrides,
  }
}

vi.mock('@/components/auth/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}))

vi.mock('@/store/useAppStore', () => ({
  WAKE_WORD_OPTIONS: [{ id: 'luma', label: 'Luma' }],
  useAppStoreShallow: (selector: (state: any) => any) =>
    selector({
      currentSite: mockCurrentSite,
      settings: mockSettings,
      activeStaffId: mockActiveStaffId,
    }),
  useAppStore: () => ({
    currentSite: mockCurrentSite,
    settings: mockSettings,
    activeStaffId: mockActiveStaffId,
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
    handleVoiceCommand: vi.fn(),
    handleConversationTranscript: vi.fn(),
  }),
}))

vi.mock('@/hooks/useWakeWord', () => ({
  useWakeWord: vi.fn(),
  playWakeSound: vi.fn(),
  getPrimaryWakeWordLabel: () => 'Luma',
}))

vi.mock('@/hooks/queries/useFridges', () => ({
  useFridges: () => ({
    data: [],
  }),
}))

vi.mock('@/services/pushService', () => ({
  ensurePushSubscription: vi.fn(),
  isPushSupported: () => false,
  requestNotificationPermission: vi.fn(),
}))

vi.mock('@/components/voice/VoiceButton', () => ({
  VoiceButton: () => <button type="button">Voice</button>,
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

afterEach(() => {
  mockWorkflows.length = 0
  mockReminders.length = 0
  mockStaff.length = 0
  mockActiveStaffId = null
  vi.clearAllMocks()
})

describe('HaccpDashboard', () => {
  it('starts the respective workflow when a lane icon is clicked', async () => {
    await act(async () => {
      render(<HaccpDashboard />)
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: /start cook event/i }))
    expect(screen.getByText('start-dialog:cooking:none')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /start cool event/i }))
    expect(screen.getByText('start-dialog:cooling:none')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /start reheat event/i }))
    expect(screen.getByText('start-dialog:reheating:none')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /start hold event/i }))
    expect(screen.getByText('start-dialog:hot_hold:none')).toBeTruthy()
  })

  it('does not render completed cooling workflows on the active board', async () => {
    mockWorkflows.push(
      createWorkflow({
        state: 'completed',
        completed_at: '2026-03-16T10:50:00.000Z',
        updated_at: '2026-03-16T10:50:00.000Z',
      }),
    )

    await act(async () => {
      render(<HaccpDashboard />)
      await Promise.resolve()
    })

    expect(screen.queryByText('Bechamel')).toBeNull()
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
      render(<HaccpDashboard />)
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: /start cook event/i }))
    expect(screen.getByText('start-dialog:cooking:staff-1')).toBeTruthy()
  })
})
