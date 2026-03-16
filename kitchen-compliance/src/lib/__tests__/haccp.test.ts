import { describe, expect, it } from 'vitest'
import {
  addMinutesIso,
  getHotHoldReminderAlert,
  getHotHoldSeverity,
  getWorkflowStateFromTemperature,
  isWorkflowTemperatureCompliant,
  shouldShowWorkflowOnBoard,
} from '@/lib/haccp'

describe('HACCP rules', () => {
  it('treats cooking and reheating as compliant only at 75C or above', () => {
    expect(isWorkflowTemperatureCompliant('cooking', 74.9)).toBe(false)
    expect(isWorkflowTemperatureCompliant('cooking', 75)).toBe(true)
    expect(isWorkflowTemperatureCompliant('reheating', 74.9)).toBe(false)
    expect(isWorkflowTemperatureCompliant('reheating', 75)).toBe(true)
  })

  it('derives awaiting_completion for unsafe cooking/reheating temps', () => {
    expect(getWorkflowStateFromTemperature('cooking', 72)).toBe('awaiting_completion')
    expect(getWorkflowStateFromTemperature('reheating', 73)).toBe('awaiting_completion')
    expect(getWorkflowStateFromTemperature('cooking', 75)).toBe('completed')
  })

  it('classifies hot hold severity bands correctly', () => {
    expect(getHotHoldSeverity(65)).toBe('pass')
    expect(getHotHoldSeverity(57)).toBe('warning')
    expect(getHotHoldSeverity(54.9)).toBe('critical')
  })

  it('calculates the next reminder 90 minutes after the check', () => {
    expect(addMinutesIso('2026-03-13T10:00:00.000Z', 90)).toBe('2026-03-13T11:30:00.000Z')
  })

  it('raises a warning when a hot hold check is inside the pre-alert window', () => {
    expect(
      getHotHoldReminderAlert('2026-03-13T11:30:00.000Z', new Date('2026-03-13T11:20:00.000Z').getTime()),
    ).toEqual({
      state: 'warning',
      minutesUntilDue: 10,
    })
  })

  it('raises an alarm once the hot hold check is overdue', () => {
    expect(
      getHotHoldReminderAlert('2026-03-13T11:30:00.000Z', new Date('2026-03-13T11:36:00.000Z').getTime()),
    ).toEqual({
      state: 'alarm',
      minutesUntilDue: -6,
    })
  })

  it('hides completed reheating workflows from the active board immediately', () => {
    expect(
      shouldShowWorkflowOnBoard(
        {
          id: 'workflow-1',
          batch_id: 'batch-1',
          site_id: 'site-1',
          workflow_kind: 'reheating',
          state: 'completed',
          title: 'Reheat soup',
          item_name: 'Soup',
          item_category: 'soup',
          started_at: '2026-03-13T10:00:00.000Z',
          completed_at: '2026-03-13T10:20:00.000Z',
          location_kind: 'kitchen',
          location_label: 'Pass',
          created_at: '2026-03-13T10:00:00.000Z',
        },
        new Date('2026-03-13T10:21:00.000Z').getTime(),
      ),
    ).toBe(false)
  })

  it('hides completed cooling workflows from the active board immediately', () => {
    expect(
      shouldShowWorkflowOnBoard(
        {
          id: 'workflow-2',
          batch_id: 'batch-2',
          site_id: 'site-1',
          workflow_kind: 'cooling',
          state: 'completed',
          title: 'Cool sauce',
          item_name: 'Bechamel',
          item_category: 'sauce',
          started_at: '2026-03-13T10:00:00.000Z',
          completed_at: '2026-03-13T10:50:00.000Z',
          location_kind: 'fridge',
          location_label: 'Walk-in',
          created_at: '2026-03-13T10:00:00.000Z',
        },
        new Date('2026-03-13T10:51:00.000Z').getTime(),
      ),
    ).toBe(false)
  })
})
