import { useMemo } from 'react'
import { ArrowRight, BadgeCheck, Snowflake, Soup, TimerReset, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { cn } from '@/lib/utils'
import type { HaccpWorkflow } from '@/types'
import type { LegacyHaccpAction } from '@/components/haccp/LegacyHaccpBoard'

type QuickPickStaffMember = {
  id: string
  name: string
  initials?: string | null
  staff_code?: string | null
  active?: boolean | null
}

type QuickPickAction = Extract<LegacyHaccpAction, 'transition_to_cooling' | 'start_reheating' | 'start_hot_hold'>

function titleForAction(action: QuickPickAction) {
  if (action === 'transition_to_cooling') return 'Start Cooling'
  if (action === 'start_reheating') return 'Start Reheat'
  return 'Start Hold'
}

function iconForAction(action: QuickPickAction) {
  if (action === 'transition_to_cooling') return <Snowflake className="h-5 w-5 text-sky-500" />
  if (action === 'start_reheating') return <Soup className="h-5 w-5 text-orange-500" />
  return <TimerReset className="h-5 w-5 text-red-500" />
}

function initialsForStaff(staff: QuickPickStaffMember) {
  if (staff.initials?.trim()) return staff.initials.trim()

  return staff.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function referenceForStaff(staff: QuickPickStaffMember, index: number) {
  const trimmedCode = staff.staff_code?.trim()
  return trimmedCode ? `#${trimmedCode}` : `#${index + 1}`
}

export function HaccpOperatorQuickPickDialog({
  open,
  onOpenChange,
  workflow,
  action,
  staffMembers,
  loading = false,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflow: HaccpWorkflow | null
  action: QuickPickAction
  staffMembers: QuickPickStaffMember[]
  loading?: boolean
  onSelect: (staffId: string) => void | Promise<void>
}) {
  const activeStaff = useMemo(
    () =>
      staffMembers
        .filter((staff) => staff.active !== false)
        .sort((left, right) => {
          const leftCode = left.staff_code?.trim() ?? ''
          const rightCode = right.staff_code?.trim() ?? ''

          if (leftCode && rightCode) {
            return leftCode.localeCompare(rightCode, undefined, { numeric: true })
          }

          if (leftCode) return -1
          if (rightCode) return 1

          return left.name.localeCompare(right.name)
        }),
    [staffMembers],
  )

  const actionTitle = titleForAction(action)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-theme-primary bg-theme-modal p-0 shadow-theme-xl">
        <div className="relative overflow-hidden rounded-[28px]">
          <div className="border-b border-theme-primary/50 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,246,255,0.9))] px-6 py-6 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,118,110,0.18))]">
            <DialogHeader className="space-y-3 text-left">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-theme-primary/40 bg-white/80 p-3 shadow-theme-sm dark:bg-white/5">
                  {iconForAction(action)}
                </div>
                <div>
                  <DialogTitle className="text-2xl text-theme-primary">Choose operator</DialogTitle>
                  <DialogDescription className="mt-1 text-base text-theme-secondary">
                    Tap one operator to continue the workflow without opening the full form first.
                  </DialogDescription>
                </div>
              </div>

              {workflow ? (
                <div className="flex items-center gap-2 rounded-2xl border border-theme-primary/40 bg-glass px-4 py-3 text-sm text-theme-secondary shadow-theme-sm">
                  <BadgeCheck className="h-4 w-4 text-theme-muted" />
                  <span className="font-semibold text-theme-primary">{workflow.item_name}</span>
                  <ArrowRight className="h-4 w-4 text-theme-muted" />
                  <span>{actionTitle}</span>
                </div>
              ) : null}
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-6">
            {activeStaff.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeStaff.map((staff, index) => (
                  <button
                    key={staff.id}
                    type="button"
                    disabled={loading}
                    onClick={() => void onSelect(staff.id)}
                    className={cn(
                      'group rounded-[24px] border border-theme-primary/50 bg-white/90 p-4 text-left shadow-theme-sm transition-all',
                      'hover:-translate-y-0.5 hover:border-theme-focus hover:bg-theme-card hover:shadow-theme-md',
                      'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--input-focus)/0.18)]',
                      'disabled:pointer-events-none disabled:opacity-60',
                      'dark:bg-white/5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-theme-secondary text-lg font-bold text-theme-primary">
                          {initialsForStaff(staff)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-theme-primary">{staff.name}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">
                            <UserRound className="h-3.5 w-3.5" />
                            Operator
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full border border-theme-primary/40 bg-theme-secondary px-2.5 py-1 text-xs font-bold tracking-[0.18em] text-theme-secondary">
                        {referenceForStaff(staff, index)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-theme-primary/50 bg-theme-secondary px-4 py-6 text-center text-sm text-theme-secondary">
                No active staff members available. Add staff in Settings before continuing this workflow.
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-theme-primary/40 px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
