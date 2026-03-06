import { useCallback, useMemo, useRef, useState } from 'react'
import type { CloseCoolingData, CoolingSession, StaffMember } from '@/types'
import { VOICE_LIMITS } from '@/lib/voiceConfig'

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
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60,
  'seventy': 70, 'eighty': 80, 'ninety': 90,
}

const HOMOPHONE_NUMBERS: Record<string, number> = {
  'won': 1,
  'to': 2,
  'too': 2,
  'tree': 3,
  'free': 3,
  'for': 4,
  'fore': 4,
  'ate': 8,
  'oh': 0,
}

function findNumber(text: string): number | null {
  const lower = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Try direct numeric match first
  const match = lower.match(/-?\d+(?:\.\d+)?/)
  if (match) return Number(match[0])

  // Handle "minus one" / "negative one"
  const negative = /\b(minus|negative)\b/.test(lower)

  // Handle "one point five" / "one dot five"
  const pointMatch = lower.match(/\b([a-z]+)\s+(?:point|dot)\s+([a-z]+)\b/)
  if (pointMatch) {
    const a = TEXT_NUMBERS[pointMatch[1]]
    const b = TEXT_NUMBERS[pointMatch[2]]
    if (typeof a === 'number' && typeof b === 'number') {
      const val = Number(`${a}.${b}`)
      return negative ? -val : val
    }
  }

  // Handle simple composite like "twenty one"
  const compositeMatch = lower.match(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+(one|two|three|four|five|six|seven|eight|nine)\b/)
  if (compositeMatch) {
    const tens = TEXT_NUMBERS[compositeMatch[1]]
    const ones = TEXT_NUMBERS[compositeMatch[2]]
    if (typeof tens === 'number' && typeof ones === 'number') {
      const val = tens + ones
      return negative ? -val : val
    }
  }

  // Try text number match with word boundaries
  for (const [word, val] of Object.entries(TEXT_NUMBERS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    if (regex.test(lower)) return negative ? -val : val
  }

  // Handle common ASR homophones in noisy kitchens ("for" -> 4)
  const words = lower.split(/\s+/).filter(Boolean)
  for (const word of words) {
    if (word in HOMOPHONE_NUMBERS) {
      const value = HOMOPHONE_NUMBERS[word]
      return negative ? -value : value
    }
  }

  return null
}

function shouldSkipTemperature(text: string) {
  const lower = text.toLowerCase()
  return lower.includes('skip') || lower.includes('no temp') || lower.includes('no temperature') || lower.includes('without')
}

function normalizeVoiceInput(text: string): string {
  return text
    .toLowerCase()
    .replace(/^(okay|ok|hey|hi)\s+luma\s*,?\s*/i, '')
    .replace(/[^\w\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isNegativeResponse(text: string): boolean {
  return /\b(no|wrong|change|incorrect|not correct)\b/i.test(text)
}

function isPositiveConfirmation(text: string): boolean {
  return /\b(confirm|save|yes|ok|okay|correct)\b/i.test(text)
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
  const retryRef = useRef<Record<VoiceCloseStep, number>>({
    idle: 0,
    awaiting_staff: 0,
    awaiting_temperature: 0,
    awaiting_confirmation: 0,
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
    retryRef.current = {
      idle: 0,
      awaiting_staff: 0,
      awaiting_temperature: 0,
      awaiting_confirmation: 0,
    }
  }, [])

  const promptRetryOrFallback = useCallback(
    (step: VoiceCloseStep, retryPrompt: string) => {
      retryRef.current[step] = (retryRef.current[step] ?? 0) + 1
      const attempts = retryRef.current[step]

      if (attempts >= VOICE_LIMITS.MAX_RETRIES_PER_STEP) {
        speak('I could not validate this step after several tries. Please complete it on screen.', {
          onComplete: () => {
            // Keep modal open for touch fallback, but end voice flow.
            reset()
          }
        })
        return
      }

      speak(retryPrompt, {
        onComplete: () => onAwaitingInput?.()
      })
    },
    [onAwaitingInput, reset, speak]
  )

  const startFlow = useCallback(
    (item?: string) => {
      const session = resolveSession(item)
      if (!session) {
        speak(item ? `No active cooling session found for ${item}.` : 'No active cooling sessions found.')
        return
      }
      onOpenModal(session.id)
      setState({ step: 'awaiting_staff', sessionId: session.id, staffId: null })
      retryRef.current.awaiting_staff = 0
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
      const cleaned = normalizeVoiceInput(transcript)

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
          promptRetryOrFallback('awaiting_staff', "I didn't catch a number. Please say your staff code.")
          return
        }

        const staff = activeStaff.find((member) =>
          member.staff_code === staffCode ||
          parseInt(member.staff_code || '', 10) === parseInt(staffCode, 10)
        )

        if (!staff) {
          promptRetryOrFallback('awaiting_staff', `I could not find a staff member with code ${staffCode}. Please try again.`)
          return
        }

        setState((prev) => ({ ...prev, staffId: staff.id, step: 'awaiting_temperature' }))
        retryRef.current.awaiting_staff = 0
        retryRef.current.awaiting_temperature = 0
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
            promptRetryOrFallback('awaiting_temperature', 'I did not catch that temperature. Please say the number, or say skip.')
            return
          }
          if (num < -30 || num > 130) {
            promptRetryOrFallback('awaiting_temperature', `That sounds out of range. I heard ${num}. Please repeat the temperature.`)
            return
          }
          temperatureValue = num
        }

        const staffMatched = activeStaff.find((m) => m.id === state.staffId)
        const sessionMatched = sessions.find((s) => s.id === state.sessionId)

        setState((prev) => ({ ...prev, temperature: temperatureValue, step: 'awaiting_confirmation' }))
        retryRef.current.awaiting_temperature = 0
        retryRef.current.awaiting_confirmation = 0

        const tempText = temperatureValue !== undefined ? `${temperatureValue} degrees celsius` : 'temperature skipped'
        speak(`Summary: ${sessionMatched?.item_name || 'Item'}, by ${staffMatched?.name || 'staff'}, ${tempText}. Say confirm to save, or cancel.`, {
          onComplete: () => onAwaitingInput?.()
        })
        return
      }

      // 3. Handling Final Confirmation
      if (state.step === 'awaiting_confirmation') {
        const isConfirm = isPositiveConfirmation(cleaned)

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
        if (isNegativeResponse(cleaned)) {
          setState((prev) => ({ ...prev, step: 'awaiting_temperature' }))
          retryRef.current.awaiting_confirmation = 0
          speak('Okay, let us correct it. What is the final temperature?', {
            onComplete: () => onAwaitingInput?.()
          })
          return
        }
        promptRetryOrFallback('awaiting_confirmation', 'I did not get that. Say confirm to save the record, or cancel.')
      }
    },
    [state, activeStaff, sessions, onConfirm, onCloseModal, reset, speak, onAwaitingInput, promptRetryOrFallback]
  )

  /**
   * Check interim transcript and stop listening if valid input detected
   * Returns true if should immediately stop listening and process
   */
  const checkInterimTranscript = useCallback(
    (transcript: string): boolean => {
      if (state.step === 'idle') return false
      
      const cleaned = normalizeVoiceInput(transcript)
      
      // Cancel/stop commands - stop immediately
      if (cleaned === 'cancel' || cleaned === 'stop' || cleaned === 'exit') {
        console.log('[VoiceCloseFlow] Interim: Detected cancel command, stopping')
        onStopListening?.()
        return true
      }

      // IMPORTANT:
      // Do not stop early on interim numeric/confirmation guesses.
      // In Realtime mode this can cut audio before a final transcript event is emitted,
      // stalling the flow after staff code/temperature.
      // Let final transcript or post-speech timeout close naturally.
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
