import { useCallback, useMemo, useState } from 'react'
import type { CloseCoolingData, CoolingSession, StaffMember } from '@/types'

type VoiceCloseStep = 'idle' | 'awaiting_staff' | 'awaiting_temperature' | 'awaiting_confirmation'

interface UseVoiceCloseFlowOptions {
  sessions: CoolingSession[]
  staffMembers: StaffMember[]
  onConfirm: (sessionId: string, data: CloseCoolingData) => Promise<void> | void
  onOpenModal: (sessionId: string) => void
  onCloseModal?: () => void
  speak: (text: string, options?: { rate?: number; pitch?: number; onComplete?: () => void }) => void
  onAwaitingInput?: () => void
  onStopListening?: () => void // Called to immediately stop listening when valid input detected
}

interface VoiceCloseFlowState {
  step: VoiceCloseStep
  sessionId: string | null
  staffId: string | null
  temperature?: number
}

const TEXT_NUMBERS: Record<string, number> = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
  'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
}

function findNumber(text: string): number | null {
  const lower = text.toLowerCase().trim()

  // Try direct numeric match first
  const match = lower.match(/-?\d+(?:\.\d+)?/)
  if (match) return Number(match[0])

  // Try text number match with word boundaries
  for (const [word, val] of Object.entries(TEXT_NUMBERS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    if (regex.test(lower)) return val
  }

  return null
}

function shouldSkipTemperature(text: string) {
  const lower = text.toLowerCase()
  return lower.includes('skip') || lower.includes('no temp') || lower.includes('no temperature') || lower.includes('without')
}

export function useVoiceCloseFlow({
  sessions,
  staffMembers,
  onConfirm,
  onOpenModal,
  onCloseModal,
  speak,
  onAwaitingInput,
  onStopListening,
}: UseVoiceCloseFlowOptions) {
  const [state, setState] = useState<VoiceCloseFlowState>({
    step: 'idle',
    sessionId: null,
    staffId: null,
  })

  const activeStaff = useMemo(() => staffMembers.filter((staff) => staff.active), [staffMembers])

  const resolveSession = useCallback(
    (item?: string) => {
      if (sessions.length === 0) return null
      if (!item) return sessions[0]

      const normalized = item.toLowerCase().trim()
      const numericIndex = findNumber(normalized)

      if (numericIndex !== null && !Number.isNaN(numericIndex)) {
        const index = Math.max(1, Math.floor(numericIndex)) - 1
        return sessions[index] || sessions[0]
      }

      return (
        sessions.find((session) => session.item_name.toLowerCase().includes(normalized)) ||
        sessions.find((session) => normalized.includes(session.item_name.toLowerCase())) ||
        sessions[0]
      )
    },
    [sessions]
  )

  const reset = useCallback(() => {
    setState({ step: 'idle', sessionId: null, staffId: null })
  }, [])

  const startFlow = useCallback(
    (item?: string) => {
      const session = resolveSession(item)
      if (!session) {
        speak(item ? `No active cooling session found for ${item}.` : 'No active cooling sessions found.')
        return
      }
      onOpenModal(session.id)
      setState({ step: 'awaiting_staff', sessionId: session.id, staffId: null })
      speak(`Closing ${session.item_name}. What is your staff code?`, {
        onComplete: () => onAwaitingInput?.()
      })
    },
    [resolveSession, onOpenModal, speak, onAwaitingInput]
  )

  const handleTranscript = useCallback(
    async (transcript: string) => {
      // Ignore if not in active flow
      if (state.step === 'idle') {
        console.log('[VoiceCloseFlow] Ignoring transcript - flow is idle')
        return
      }

      // Natural interaction: remove wake words if user accidentally says them again
      const cleaned = transcript.toLowerCase()
        .replace(/^(okay|ok|hey|hi)\s+luma\s*,?\s*/i, '')
        .trim()

      console.log(`[VoiceCloseFlow] Step: ${state.step}, Raw: "${transcript}", Cleaned: "${cleaned}"`)

      // Universal cancel/stop handler
      if (cleaned === 'cancel' || cleaned === 'stop' || cleaned === 'exit') {
        speak('Closing cancelled.')
        onCloseModal?.()
        reset()
        return
      }

      // 1. Handling Staff Code
      if (state.step === 'awaiting_staff') {
        const staffCode = findNumber(cleaned)?.toString()

        if (!staffCode) {
          console.log('[VoiceCloseFlow] No code found in:', cleaned)
          speak("I didn't catch a number. Please say your staff code.", {
            onComplete: () => onAwaitingInput?.()
          })
          return
        }

        const staff = activeStaff.find((member) =>
          member.staff_code === staffCode ||
          parseInt(member.staff_code || '', 10) === parseInt(staffCode, 10)
        )

        if (!staff) {
          speak(`I could not find a staff member with code ${staffCode}. Please try again.`, {
            onComplete: () => onAwaitingInput?.()
          })
          return
        }

        setState((prev) => ({ ...prev, staffId: staff.id, step: 'awaiting_temperature' }))
        speak(`Recognized ${staff.name}. What is the final temperature?`, {
          onComplete: () => onAwaitingInput?.()
        })
        return
      }

      // 2. Handling Temperature
      if (state.step === 'awaiting_temperature') {
        let temperatureValue: number | undefined = undefined

        if (shouldSkipTemperature(cleaned)) {
          temperatureValue = undefined
        } else {
          const num = findNumber(cleaned)
          if (num === null || Number.isNaN(num)) {
            speak('I didn\'t catch that temperature. Please say the number, or say skip.', {
              onComplete: () => onAwaitingInput?.()
            })
            return
          }
          temperatureValue = num
        }

        const staffMatched = activeStaff.find((m) => m.id === state.staffId)
        const sessionMatched = sessions.find((s) => s.id === state.sessionId)

        setState((prev) => ({ ...prev, temperature: temperatureValue, step: 'awaiting_confirmation' }))

        const tempText = temperatureValue !== undefined ? `${temperatureValue} degrees celsius` : 'temperature skipped'
        speak(`Summary: ${sessionMatched?.item_name || 'Item'}, by ${staffMatched?.name || 'staff'}, ${tempText}. Say confirm to save, or cancel.`, {
          onComplete: () => onAwaitingInput?.()
        })
        return
      }

      // 3. Handling Final Confirmation
      if (state.step === 'awaiting_confirmation') {
        const isConfirm = cleaned.includes('confirm') || cleaned.includes('save') ||
          cleaned.includes('yes') || cleaned.includes('ok')

        if (isConfirm) {
          if (state.sessionId) {
            const staff = activeStaff.find((member) => member.id === state.staffId)
            await onConfirm(state.sessionId, {
              staffId: staff?.id,
              staffName: staff?.name,
              temperature: state.temperature,
            })
          }
          speak('Successfully saved. Cooling record closed.')
          reset()
          onCloseModal?.()
          return
        }

        speak('I didn\'t get that. Say confirm to save the record, or cancel.', {
          onComplete: () => onAwaitingInput?.()
        })
      }
    },
    [state, activeStaff, sessions, onConfirm, onCloseModal, reset, speak, onAwaitingInput]
  )

  /**
   * Check interim transcript and stop listening if valid input detected
   * Returns true if should immediately stop listening and process
   */
  const checkInterimTranscript = useCallback(
    (transcript: string): boolean => {
      if (state.step === 'idle') return false
      
      const cleaned = transcript.toLowerCase()
        .replace(/^(okay|ok|hey|hi)\s+luma\s*,?\s*/i, '')
        .trim()
      
      // Cancel/stop commands - stop immediately
      if (cleaned === 'cancel' || cleaned === 'stop' || cleaned === 'exit') {
        console.log('[VoiceCloseFlow] Interim: Detected cancel command, stopping')
        onStopListening?.()
        return true
      }
      
      // Staff code step: stop as soon as we hear a number
      if (state.step === 'awaiting_staff') {
        const hasNumber = findNumber(cleaned) !== null
        if (hasNumber) {
          console.log('[VoiceCloseFlow] Interim: Detected number for staff code, stopping')
          onStopListening?.()
          return true
        }
      }
      
      // Temperature step: stop as soon as we hear a number or skip keywords
      if (state.step === 'awaiting_temperature') {
        const hasNumber = findNumber(cleaned) !== null
        const hasSkip = shouldSkipTemperature(cleaned)
        if (hasNumber || hasSkip) {
          console.log('[VoiceCloseFlow] Interim: Detected temp/skip, stopping')
          onStopListening?.()
          return true
        }
      }
      
      // Confirmation step: stop as soon as we hear confirm or cancel keywords
      if (state.step === 'awaiting_confirmation') {
        const isConfirm = cleaned.includes('confirm') || cleaned.includes('save') ||
          cleaned.includes('yes') || cleaned.includes('ok')
        const isCancel = cleaned.includes('cancel') || cleaned.includes('no')
        if (isConfirm || isCancel) {
          console.log('[VoiceCloseFlow] Interim: Detected confirm/cancel, stopping')
          onStopListening?.()
          return true
        }
      }
      
      return false
    },
    [state.step, onStopListening]
  )

  // Determine if current step expects a quick response (staff code, temperature)
  const isQuickResponseStep = state.step === 'awaiting_staff' || state.step === 'awaiting_temperature'

  return {
    step: state.step,
    sessionId: state.sessionId,
    staffId: state.staffId,
    temperature: state.temperature,
    isQuickResponseStep,
    startFlow,
    handleTranscript,
    checkInterimTranscript,
    reset,
  }
}
