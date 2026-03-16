import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HaccpOperatorQuickPickDialog } from '@/components/haccp/HaccpOperatorQuickPickDialog'
import type { HaccpWorkflow } from '@/types'

function createWorkflow(overrides: Partial<HaccpWorkflow> = {}): HaccpWorkflow {
  const now = new Date().toISOString()

  return {
    id: 'workflow-1',
    batch_id: 'batch-1',
    site_id: 'site-1',
    workflow_kind: 'cooking',
    state: 'completed',
    title: 'Chilli cooking',
    item_name: 'Chilli',
    item_category: 'other',
    started_at: now,
    location_kind: 'kitchen',
    location_label: 'Kitchen',
    created_at: now,
    ...overrides,
  }
}

describe('HaccpOperatorQuickPickDialog', () => {
  it('shows one-tap operator tiles with numbered references', () => {
    const onSelect = vi.fn()

    render(
      <HaccpOperatorQuickPickDialog
        open
        onOpenChange={vi.fn()}
        workflow={createWorkflow({ item_name: 'Béchamel' })}
        action="transition_to_cooling"
        staffMembers={[
          {
            id: 'staff-1',
            name: 'Chris',
            initials: 'CH',
            staff_code: '0042',
            active: true,
          },
          {
            id: 'staff-2',
            name: 'Maria',
            initials: 'MA',
            staff_code: null,
            active: true,
          },
          {
            id: 'staff-3',
            name: 'Offline User',
            initials: 'OU',
            staff_code: '0999',
            active: false,
          },
        ]}
        onSelect={onSelect}
      />,
    )

    expect(screen.getByRole('heading', { name: /choose operator/i })).toBeTruthy()
    expect(screen.getByText('Béchamel')).toBeTruthy()
    expect(screen.getByText('#0042')).toBeTruthy()
    expect(screen.getByText('#2')).toBeTruthy()
    expect(screen.queryByText('Offline User')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /chris/i }))

    expect(onSelect).toHaveBeenCalledWith('staff-1')
  })
})
