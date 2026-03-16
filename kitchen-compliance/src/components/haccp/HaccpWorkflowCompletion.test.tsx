import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HaccpStartWorkflowDialog, HaccpWorkflowActionDialog } from '@/components/haccp/HaccpWorkflowDialogs'
import { LegacyHaccpBoard } from '@/components/haccp/LegacyHaccpBoard'
import type { Fridge } from '@/services/fridgeService'
import type { HaccpWorkflow } from '@/types'

function createWorkflow(overrides: Partial<HaccpWorkflow> = {}): HaccpWorkflow {
  const now = new Date().toISOString()

  return {
    id: 'workflow-1',
    batch_id: 'batch-1',
    site_id: 'site-1',
    workflow_kind: 'cooking',
    state: 'active',
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

function createFridge(overrides: Partial<Fridge> = {}): Fridge {
  const now = new Date().toISOString()

  return {
    id: 'fridge-1',
    site_id: 'site-1',
    name: 'Main Fridge',
    sort_order: 1,
    min_temp: 0,
    max_temp: 5,
    active: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('cook workflow completion UI', () => {
  it('shows an explicit finish action for active cooking workflows', async () => {
    const onAction = vi.fn()

    render(
      <LegacyHaccpBoard
        workflows={[createWorkflow()]}
        dueReminders={0}
        onAction={onAction}
      />,
    )

    const finishButton = screen.getByRole('button', { name: /finish cook/i })
    fireEvent.click(finishButton)

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ item_name: 'Chilli' }), 'complete')
  })

  it('starts a workflow from the matching lane icon', () => {
    const onStartWorkflow = vi.fn()

    render(
      <LegacyHaccpBoard
        workflows={[]}
        dueReminders={0}
        onAction={vi.fn()}
        onStartWorkflow={onStartWorkflow}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /start cook workflow/i }))
    expect(onStartWorkflow).toHaveBeenCalledWith('cooking')

    fireEvent.click(screen.getByRole('button', { name: /start cool workflow/i }))
    expect(onStartWorkflow).toHaveBeenCalledWith('cooling')

    fireEvent.click(screen.getByRole('button', { name: /start reheat workflow/i }))
    expect(onStartWorkflow).toHaveBeenCalledWith('reheating')

    fireEvent.click(screen.getByRole('button', { name: /start hold workflow/i }))
    expect(onStartWorkflow).toHaveBeenCalledWith('hot_hold')
  })

  it('makes current temperature and cooling handoff choices explicit when finishing cook', () => {
    render(
      <HaccpWorkflowActionDialog
        open
        onOpenChange={vi.fn()}
        mode="complete"
        workflow={createWorkflow()}
        staffOptions={[{ id: 'staff-1', name: 'Alice' }]}
        defaultStaffId="staff-1"
        fridges={[createFridge()]}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: /finish cooking/i })).toBeTruthy()
    expect(screen.getByText(/record who is closing this cook/i)).toBeTruthy()
    expect(screen.getByText('Current Temperature')).toBeTruthy()
    expect(screen.getByRole('button', { name: /close cook event/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /start cooling event/i })).toBeTruthy()
    expect(screen.getByDisplayValue('75')).toBeTruthy()
    expect(screen.getByRole('spinbutton').className).toContain('!pl-14')
    expect(screen.getByRole('button', { name: /alice/i })).toBeTruthy()
    expect(screen.getByText('#1')).toBeTruthy()
  })

  it('uses the same wider icon inset in start workflow dialogs', () => {
    render(
      <HaccpStartWorkflowDialog
        open
        onOpenChange={vi.fn()}
        context={{
          kind: 'cooling',
          itemName: 'Béchamel',
          itemCategory: 'sauce',
          temperature: 12,
        }}
        staffOptions={[{ id: 'staff-1', name: 'Alice' }]}
        defaultStaffId="staff-1"
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: /start cooling/i })).toBeTruthy()
    expect(screen.getByDisplayValue('12').className).toContain('!pl-14')
    expect(screen.getByRole('button', { name: /alice/i })).toBeTruthy()
    expect(screen.getByText('#1')).toBeTruthy()
  })

  it('renders the selected operator tile with a stronger contrast state', () => {
    render(
      <HaccpStartWorkflowDialog
        open
        onOpenChange={vi.fn()}
        context={{
          kind: 'reheating',
          itemName: 'Béchamel',
          itemCategory: 'sauce',
          temperature: 75,
        }}
        staffOptions={[
          { id: 'staff-1', name: 'Gui', staff_code: '1' },
          { id: 'staff-2', name: 'Chris', staff_code: '2' },
        ]}
        defaultStaffId="staff-1"
        onSubmit={vi.fn()}
      />,
    )

    const selectedTile = screen.getByRole('button', { name: /gui/i })
    const unselectedTile = screen.getByRole('button', { name: /chris/i })

    expect(selectedTile.getAttribute('aria-pressed')).toBe('true')
    expect(selectedTile.className).toContain('bg-sky-500/10')
    expect(within(selectedTile).getByText(/selected/i)).toBeTruthy()
    expect(unselectedTile.className).toContain('bg-theme-input')
    expect(within(unselectedTile).getByText(/tap to select/i)).toBeTruthy()
  })

  it('defaults final cooling temperature to 4 and submits the picked operator tile', () => {
    const onSubmit = vi.fn()

    render(
      <HaccpWorkflowActionDialog
        open
        onOpenChange={vi.fn()}
        mode="complete"
        workflow={createWorkflow({
          workflow_kind: 'cooling',
          item_name: 'Béchamel',
        })}
        staffOptions={[
          { id: 'staff-1', name: 'Alice', staff_code: '0042' },
          { id: 'staff-2', name: 'Bob', staff_code: null },
        ]}
        fridges={[createFridge()]}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByDisplayValue('4')).toBeTruthy()
    expect(screen.getByText('#0042')).toBeTruthy()
    expect(screen.getByText('#2')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /alice/i }))
    fireEvent.click(screen.getByRole('button', { name: /save reading/i }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        staffId: 'staff-1',
        temperature: 4,
      }),
    )
  })

  it('defaults start temperatures to 75 when no reading is prefilled', () => {
    render(
      <HaccpStartWorkflowDialog
        open
        onOpenChange={vi.fn()}
        context={{
          kind: 'cooling',
          itemName: 'Béchamel',
          itemCategory: 'sauce',
        }}
        staffOptions={[{ id: 'staff-1', name: 'Alice', staff_code: '0042' }]}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByDisplayValue('75')).toBeTruthy()
    expect(screen.getByText('#0042')).toBeTruthy()
  })

  it('allows dragging a completed cook workflow into the cool lane to start cooling', () => {
    const workflow = createWorkflow({
      state: 'completed',
      item_name: 'Béchamel',
      last_temperature: 75,
    })
    const onAction = vi.fn()

    render(
      <LegacyHaccpBoard
        workflows={[workflow]}
        dueReminders={0}
        onAction={onAction}
      />,
    )

    const card = screen.getByText('Béchamel').closest('article')
    const coolLane = screen.getByRole('region', { name: /cool lane/i })

    expect(card).toBeTruthy()
    expect(coolLane).toBeTruthy()

    fireEvent.dragStart(card!)
    fireEvent.dragOver(coolLane)
    fireEvent.drop(coolLane)

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ item_name: 'Béchamel' }), 'transition_to_cooling')
  })

  it('does not expose active cook workflows as draggable cards', () => {
    render(
      <LegacyHaccpBoard
        workflows={[createWorkflow({ item_name: 'Chilli', state: 'active' })]}
        dueReminders={0}
        onAction={vi.fn()}
      />,
    )

    const card = screen.getByText('Chilli').closest('article')

    expect(card).toBeTruthy()
    expect(card?.getAttribute('draggable')).toBe('false')
  })

  it('does not offer follow-up transitions for completed reheating workflows', () => {
    render(
      <LegacyHaccpBoard
        workflows={[
          createWorkflow({
            workflow_kind: 'reheating',
            state: 'completed',
            item_name: 'Lasagna',
            last_temperature: 78,
          }),
        ]}
        dueReminders={0}
        onAction={vi.fn()}
      />,
    )

    const card = screen.getByText('Lasagna').closest('article')
    expect(card).toBeTruthy()
    expect(within(card!).queryByRole('button', { name: /start cooling/i })).toBeNull()
    expect(within(card!).queryByRole('button', { name: /start hold/i })).toBeNull()
    expect(card?.getAttribute('draggable')).toBe('false')
  })

  it('warns on screen before a hot hold check reaches the 90 minute mark', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-13T11:20:00.000Z'))

    render(
      <LegacyHaccpBoard
        workflows={[
          createWorkflow({
            workflow_kind: 'hot_hold',
            item_name: 'Soup',
            next_due_at: '2026-03-13T11:30:00.000Z',
            last_temperature: 68,
          }),
        ]}
        dueReminders={0}
        onAction={vi.fn()}
      />,
    )

    expect(screen.getByText(/hot hold warning/i)).toBeTruthy()
    expect(screen.getAllByText(/soup needs a temperature check in 10 min/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/90-minute check window is approaching/i)).toBeTruthy()
  })

  it('shows an alarm banner when a hot hold check is overdue', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-13T11:36:00.000Z'))

    render(
      <LegacyHaccpBoard
        workflows={[
          createWorkflow({
            workflow_kind: 'hot_hold',
            item_name: 'Soup',
            next_due_at: '2026-03-13T11:30:00.000Z',
            last_temperature: 68,
          }),
        ]}
        dueReminders={1}
        onAction={vi.fn()}
      />,
    )

    expect(screen.getByText(/hot hold alarm/i)).toBeTruthy()
    expect(screen.getAllByText(/soup is overdue by 6 min/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/log it now/i)).toBeTruthy()
  })

  it('lets the user start a hot hold check directly from the overdue banner', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-13T11:36:00.000Z'))

    const onAction = vi.fn()

    render(
      <LegacyHaccpBoard
        workflows={[
          createWorkflow({
            workflow_kind: 'hot_hold',
            item_name: 'Soup',
            next_due_at: '2026-03-13T11:30:00.000Z',
            last_temperature: 68,
          }),
        ]}
        dueReminders={1}
        onAction={onAction}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /log check for soup/i }))

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ item_name: 'Soup' }), 'hold_check')
  })

  it('promotes a hot hold item into warning state as time passes on the open board', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-13T11:20:00.000Z'))

    render(
      <LegacyHaccpBoard
        workflows={[
          createWorkflow({
            workflow_kind: 'hot_hold',
            item_name: 'Soup',
            next_due_at: '2026-03-13T11:40:00.000Z',
            last_temperature: 68,
          }),
        ]}
        dueReminders={0}
        onAction={vi.fn()}
      />,
    )

    expect(screen.queryByText(/hot hold warning/i)).toBeNull()

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000)
    })

    expect(screen.getByText(/hot hold warning/i)).toBeTruthy()
    expect(screen.getAllByText(/soup needs a temperature check in 15 min/i).length).toBeGreaterThan(0)
  })
})
