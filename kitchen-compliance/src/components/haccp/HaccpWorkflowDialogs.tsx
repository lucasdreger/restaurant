import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Thermometer, Flame, Snowflake, Soup, TimerReset } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { FOOD_ITEM_PRESETS } from '@/types'
import type { HaccpCorrectiveAction, HaccpWorkflow, WorkflowKind } from '@/types'
import type { Fridge } from '@/services/fridgeService'

type StaffOption = {
  id: string
  name: string
  staff_code?: string | null
}

export type CookCompletionAction = 'close' | 'start_cooling'

export type StartContext = {
  kind: WorkflowKind
  itemName?: string
  itemCategory?: string
  batchId?: string | null
  parentWorkflowId?: string | null
  temperature?: number | null
  locationLabel?: string | null
}

export type StartPayload = {
  kind: WorkflowKind
  itemName: string
  itemCategory: string
  staffId?: string | null
  temperature?: number | null
  batchId?: string | null
  parentWorkflowId?: string | null
  locationLabel?: string | null
}

export type ActionMode = 'complete' | 'hold_check' | 'stop'

export type ActionDialogPrefill = {
  temperature?: number | null
  locationLabel?: string | null
  locationId?: string | null
  correctiveAction?: HaccpCorrectiveAction | null
  postCompletionAction?: CookCompletionAction | null
  notes?: string | null
}

export type ActionDialogContext = {
  workflow: HaccpWorkflow
  mode: ActionMode
  prefill?: ActionDialogPrefill | null
}

export type ActionPayload = {
  mode: ActionMode
  workflow: HaccpWorkflow
  staffId?: string | null
  temperature?: number | null
  locationLabel?: string | null
  locationId?: string | null
  correctiveAction?: HaccpCorrectiveAction | null
  postCompletionAction?: CookCompletionAction | null
  notes?: string | null
}

const CATEGORY_OPTIONS = [
  { value: 'sauce', label: 'Sauce' },
  { value: 'soup', label: 'Soup' },
  { value: 'meat', label: 'Meat' },
  { value: 'vegetable', label: 'Vegetable' },
  { value: 'other', label: 'Other' },
] as const

const fieldClassName =
  'input-stunning h-11 rounded-xl border-theme-input bg-theme-input pr-4 pl-4 text-theme-primary placeholder:text-theme-muted shadow-theme-sm'
const selectClassName = `${fieldClassName} appearance-none pr-10`
const textareaClassName =
  'min-h-24 w-full rounded-xl border border-theme-input bg-theme-input px-3 py-2 text-sm text-theme-primary placeholder:text-theme-muted shadow-theme-sm transition-colors focus:outline-none focus:border-theme-focus focus:ring-2 focus:ring-[hsl(var(--input-focus)/0.18)]'
const labelClassName = 'text-sm font-semibold text-theme-secondary'
const leadingFieldClassName = '!pl-14'
const leadingIconClassName =
  'pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-theme-muted'

function operatorInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function operatorReference(staff: StaffOption, index: number) {
  const trimmedCode = staff.staff_code?.trim()
  return trimmedCode ? `#${trimmedCode}` : `#${index + 1}`
}

function sortStaffOptions(staffOptions: StaffOption[]) {
  return [...staffOptions].sort((left, right) => {
    const leftCode = left.staff_code?.trim() ?? ''
    const rightCode = right.staff_code?.trim() ?? ''

    if (leftCode && rightCode) {
      return leftCode.localeCompare(rightCode, undefined, { numeric: true })
    }

    if (leftCode) return -1
    if (rightCode) return 1

    return left.name.localeCompare(right.name)
  })
}

function defaultTemperatureForStartKind(kind: WorkflowKind) {
  return kind === 'cooking' ? '' : '75'
}

function defaultTemperatureForAction(workflow: HaccpWorkflow, mode: ActionMode) {
  if (mode === 'stop') return ''
  if (workflow.workflow_kind === 'cooling' && mode === 'complete') return '4'
  return '75'
}

function OperatorQuickSelect({
  staffOptions,
  selectedStaffId,
  onSelect,
}: {
  staffOptions: StaffOption[]
  selectedStaffId: string
  onSelect: (staffId: string) => void
}) {
  const sortedStaffOptions = useMemo(() => sortStaffOptions(staffOptions), [staffOptions])

  if (sortedStaffOptions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-theme-primary/50 bg-theme-secondary px-4 py-6 text-sm text-theme-secondary">
        No active staff available. Add staff in Settings before continuing.
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sortedStaffOptions.map((staff, index) => {
        const isSelected = selectedStaffId === staff.id

        return (
          <button
            key={staff.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(staff.id)}
            className={cn(
              'min-h-18 rounded-2xl border p-4 text-left transition-all',
              'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--input-focus)/0.18)]',
              isSelected
                ? 'border-sky-500/70 bg-sky-500/10 text-theme-primary shadow-[0_0_0_1px_rgba(14,165,233,0.12),0_16px_36px_rgba(14,165,233,0.18)] dark:border-sky-400/55 dark:bg-sky-500/18'
                : 'border-theme-primary/35 bg-theme-input text-theme-secondary hover:bg-theme-card hover:border-theme-focus/60',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold',
                    isSelected
                      ? 'bg-sky-500 text-white shadow-[0_10px_24px_rgba(14,165,233,0.28)]'
                      : 'bg-theme-secondary text-theme-primary',
                  )}
                >
                  {operatorInitials(staff.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-theme-primary">{staff.name}</p>
                  <p
                    className={cn(
                      'mt-1 text-xs font-semibold uppercase tracking-[0.18em]',
                      isSelected ? 'text-sky-700 dark:text-sky-100' : 'text-theme-muted',
                    )}
                  >
                    {isSelected ? 'Selected' : 'Tap to select'}
                  </p>
                </div>
              </div>

              <span
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-bold tracking-[0.18em]',
                  isSelected
                    ? 'border-sky-500/40 bg-sky-500/15 text-sky-700 dark:border-sky-400/45 dark:bg-sky-500/20 dark:text-sky-100'
                    : 'border-theme-primary/40 bg-theme-secondary text-theme-secondary',
                )}
              >
                {operatorReference(staff, index)}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function labelForKind(kind: WorkflowKind) {
  switch (kind) {
    case 'cooking':
      return 'Cooking'
    case 'cooling':
      return 'Cooling'
    case 'reheating':
      return 'Reheating'
    case 'hot_hold':
      return 'Hot Hold'
  }
}

function iconForKind(kind: WorkflowKind) {
  switch (kind) {
    case 'cooking':
      return <Flame className="h-5 w-5 text-amber-500" />
    case 'cooling':
      return <Snowflake className="h-5 w-5 text-sky-500" />
    case 'reheating':
      return <Soup className="h-5 w-5 text-orange-500" />
    case 'hot_hold':
      return <TimerReset className="h-5 w-5 text-red-500" />
  }
}

function actionTitleForWorkflow(workflow: HaccpWorkflow, mode: ActionMode) {
  if (mode === 'stop') return 'Stop Hot Hold'
  if (workflow.workflow_kind === 'hot_hold') return 'Log Hot Hold Check'

  switch (workflow.workflow_kind) {
    case 'cooking':
      return 'Finish Cooking'
    case 'cooling':
      return 'Finish Cooling'
    case 'reheating':
      return 'Finish Reheating'
  }
}

function actionDescriptionForWorkflow(workflow: HaccpWorkflow, mode: ActionMode) {
  if (mode === 'stop') {
    return 'Close the active hot-hold workflow and cancel future reminders.'
  }

  if (workflow.workflow_kind === 'cooking') {
    return 'Record who is closing this cook, the current temperature, and whether to close the cook or start cooling next.'
  }

  if (workflow.workflow_kind === 'cooling') {
    return 'Record who is closing cooling, the current temperature, and where the batch is moving next.'
  }

  if (workflow.workflow_kind === 'reheating') {
    return 'Record who is closing reheating and the current temperature before releasing the batch.'
  }

  return 'Record the latest reading and keep the lifecycle audit trail intact.'
}

export function HaccpStartWorkflowDialog({
  open,
  onOpenChange,
  context,
  staffOptions,
  defaultStaffId,
  loading,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: StartContext | null
  staffOptions: StaffOption[]
  defaultStaffId?: string | null
  loading?: boolean
  onSubmit: (payload: StartPayload) => Promise<void> | void
}) {
  const [itemName, setItemName] = useState('')
  const [itemCategory, setItemCategory] = useState('other')
  const [temperature, setTemperature] = useState('')
  const [staffId, setStaffId] = useState<string>('')
  const [locationLabel, setLocationLabel] = useState('')

  useEffect(() => {
    if (!open || !context) return
    setItemName(context.itemName ?? '')
    setItemCategory(context.itemCategory ?? 'other')
    setTemperature(context.temperature != null ? String(context.temperature) : defaultTemperatureForStartKind(context.kind))
    setStaffId(defaultStaffId ?? '')
    setLocationLabel(context.locationLabel ?? (context.kind === 'hot_hold' ? 'Hot Pass' : ''))
  }, [context, defaultStaffId, open])

  const presets = useMemo(
    () => FOOD_ITEM_PRESETS.filter((preset) => itemCategory === 'other' || preset.category === itemCategory || preset.category === 'other'),
    [itemCategory],
  )

  if (!context) return null

  const isLocationVisible = context.kind === 'hot_hold'
  const showStartTemperature = context.kind !== 'cooking'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedItemName = itemName.trim()
    if (!trimmedItemName || !staffId) return

    await onSubmit({
      kind: context.kind,
      itemName: trimmedItemName,
      itemCategory,
      staffId: staffId || null,
      temperature: showStartTemperature && temperature !== '' ? Number(temperature) : null,
      batchId: context.batchId ?? null,
      parentWorkflowId: context.parentWorkflowId ?? null,
      locationLabel: isLocationVisible ? locationLabel.trim() || null : null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-theme-primary bg-theme-modal backdrop-blur shadow-theme-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-theme-primary">
            {iconForKind(context.kind)}
            Start {labelForKind(context.kind)}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-theme-secondary">
            Create a new HACCP workflow entry. Voice fallback opens this same form with any captured values prefilled.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className={labelClassName}>Item</label>
            <Input
              list="haccp-item-presets"
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              placeholder="Roast beef, tomato sauce, soup..."
              className={fieldClassName}
              autoFocus
            />
            <datalist id="haccp-item-presets">
              {presets.map((preset) => (
                <option key={preset.id} value={preset.name} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <label className={labelClassName}>Category</label>
            <select
              className={selectClassName}
              value={itemCategory}
              onChange={(event) => setItemCategory(event.target.value)}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className={labelClassName}>Operator</label>
            <OperatorQuickSelect
              staffOptions={staffOptions}
              selectedStaffId={staffId}
              onSelect={setStaffId}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {showStartTemperature ? (
              <div className="space-y-2">
                <label className={labelClassName}>Current Temperature</label>
                <div className="relative">
                  <Thermometer className={leadingIconClassName} />
                  <Input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    className={cn(fieldClassName, leadingFieldClassName)}
                    value={temperature}
                    onChange={(event) => setTemperature(event.target.value)}
                    placeholder={context.kind === 'cooling' ? 'Optional' : 'Required for voice parity'}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-theme-primary/40 bg-glass p-4 shadow-theme-sm md:col-span-2">
                <p className="text-sm font-medium text-theme-secondary">
                  Cooking starts without a temperature reading. Record the final temperature when closing the cook event.
                </p>
              </div>
            )}
            {isLocationVisible ? (
              <div className="space-y-2">
                <label className={labelClassName}>Hold Location</label>
                <Input
                  value={locationLabel}
                  onChange={(event) => setLocationLabel(event.target.value)}
                  placeholder="Hot pass, bain marie, service line..."
                  className={fieldClassName}
                />
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Start {labelForKind(context.kind)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function HaccpWorkflowActionDialog({
  open,
  onOpenChange,
  mode,
  workflow,
  prefill,
  staffOptions,
  defaultStaffId,
  fridges,
  loading,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: ActionMode
  workflow: HaccpWorkflow | null
  prefill?: ActionDialogPrefill | null
  staffOptions: StaffOption[]
  defaultStaffId?: string | null
  fridges: Fridge[]
  loading?: boolean
  onSubmit: (payload: ActionPayload) => Promise<void> | void
}) {
  const [temperature, setTemperature] = useState('')
  const [staffId, setStaffId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState<HaccpCorrectiveAction | ''>('')
  const [postCompletionAction, setPostCompletionAction] = useState<CookCompletionAction>('close')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open || !workflow) return
    setTemperature(
      prefill?.temperature != null
        ? String(prefill.temperature)
        : defaultTemperatureForAction(workflow, mode),
    )
    setStaffId(defaultStaffId ?? '')
    setLocationId(prefill?.locationId ?? '')
    setLocationLabel(prefill?.locationLabel ?? workflow.location_label ?? '')
    setCorrectiveAction(prefill?.correctiveAction ?? '')
    setPostCompletionAction(prefill?.postCompletionAction ?? 'close')
    setNotes(prefill?.notes ?? '')
  }, [defaultStaffId, open, prefill, workflow])

  if (!workflow) return null

  const parsedTemperature = temperature === '' ? null : Number(temperature)
  const showCoolingLocation = workflow.workflow_kind === 'cooling' && mode === 'complete'
  const showCorrectiveAction =
    workflow.workflow_kind === 'hot_hold' &&
    mode === 'hold_check' &&
    parsedTemperature != null &&
    parsedTemperature < 63
  const showCookCompletionAction = workflow.workflow_kind === 'cooking' && mode === 'complete'

  const title = actionTitleForWorkflow(workflow, mode)
  const description = actionDescriptionForWorkflow(workflow, mode)
  const temperatureLabel =
    mode === 'hold_check'
      ? 'Check Temperature'
      : mode === 'complete'
        ? 'Current Temperature'
        : 'Temperature'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!staffId) return

    await onSubmit({
      mode,
      workflow,
      staffId: staffId || null,
      temperature: mode === 'stop' ? null : parsedTemperature,
      locationId: showCoolingLocation ? locationId || null : null,
      locationLabel: showCoolingLocation
        ? locationLabel.trim() || fridges.find((fridge) => fridge.id === locationId)?.name || null
        : null,
      correctiveAction: showCorrectiveAction ? (correctiveAction || null) : null,
      postCompletionAction: showCookCompletionAction ? postCompletionAction : null,
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-theme-primary bg-theme-modal backdrop-blur shadow-theme-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-theme-primary">
            {iconForKind(workflow.workflow_kind)}
            {title}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-theme-secondary">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-theme-primary bg-glass p-4 shadow-theme-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">Workflow</p>
            <p className="mt-2 text-lg font-semibold text-theme-primary">{workflow.item_name}</p>
            <p className="mt-1 text-sm text-theme-secondary">
              {labelForKind(workflow.workflow_kind)} · {workflow.state.replace('_', ' ')}
            </p>
          </div>

          {mode !== 'stop' ? (
            <>
              <div className="space-y-2">
                <label className={labelClassName}>{temperatureLabel}</label>
                <div className="relative">
                  <Thermometer className={leadingIconClassName} />
                  <Input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    className={cn(fieldClassName, leadingFieldClassName)}
                    value={temperature}
                    onChange={(event) => setTemperature(event.target.value)}
                    placeholder="Temperature in °C"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClassName}>Operator</label>
                <OperatorQuickSelect
                  staffOptions={staffOptions}
                  selectedStaffId={staffId}
                  onSelect={setStaffId}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <label className={labelClassName}>Operator</label>
              <OperatorQuickSelect
                staffOptions={staffOptions}
                selectedStaffId={staffId}
                onSelect={setStaffId}
              />
            </div>
          )}

          {showCoolingLocation ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className={labelClassName}>Fridge</label>
                <select
                  className={selectClassName}
                  value={locationId}
                  onChange={(event) => {
                    const nextId = event.target.value
                    setLocationId(nextId)
                    const fridge = fridges.find((entry) => entry.id === nextId)
                    if (fridge) {
                      setLocationLabel(fridge.name)
                    }
                  }}
                >
                  <option value="">Select fridge</option>
                  {fridges.map((fridge) => (
                    <option key={fridge.id} value={fridge.id}>
                      {fridge.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className={labelClassName}>Location Label</label>
                <Input
                  className={fieldClassName}
                  value={locationLabel}
                  onChange={(event) => setLocationLabel(event.target.value)}
                  placeholder="Visible fridge label"
                />
              </div>
            </div>
          ) : null}

          {showCookCompletionAction ? (
            <div className="space-y-2">
              <label className={labelClassName}>After Cooking</label>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPostCompletionAction('close')}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition-colors',
                    postCompletionAction === 'close'
                      ? 'border-theme-focus bg-theme-card text-theme-primary shadow-theme-sm'
                      : 'border-theme-primary/35 bg-theme-input text-theme-secondary hover:bg-theme-card',
                  )}
                >
                  <p className="text-sm font-semibold">Close Cook Event</p>
                  <p className="mt-1 text-xs text-theme-muted">End cooking and stop there.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPostCompletionAction('start_cooling')}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition-colors',
                    postCompletionAction === 'start_cooling'
                      ? 'border-theme-focus bg-theme-card text-theme-primary shadow-theme-sm'
                      : 'border-theme-primary/35 bg-theme-input text-theme-secondary hover:bg-theme-card',
                  )}
                >
                  <p className="text-sm font-semibold">Start Cooling Event</p>
                  <p className="mt-1 text-xs text-theme-muted">Close cooking and immediately open cooling.</p>
                </button>
              </div>
              <p className="text-xs text-theme-muted">
                {parsedTemperature != null && parsedTemperature < 75
                  ? 'Cooling only starts once the final cook temperature reaches 75C.'
                  : 'Choose what should happen as soon as cooking is completed.'}
              </p>
            </div>
          ) : null}

          {showCorrectiveAction ? (
            <div className="space-y-2">
              <label className={labelClassName}>Corrective Action</label>
              <select
                className={selectClassName}
                value={correctiveAction}
                onChange={(event) => setCorrectiveAction(event.target.value as HaccpCorrectiveAction | '')}
              >
                <option value="">Select action</option>
                <option value="reheat">Reheat</option>
                <option value="discard">Discard</option>
                <option value="manual_override">Manual Override</option>
              </select>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className={labelClassName}>Notes</label>
            <textarea
              className={textareaClassName}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional corrective context, handoff detail, or exception note"
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {mode === 'stop' ? 'Stop Hot Hold' : 'Save Reading'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
