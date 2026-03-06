import { useCallback, useMemo, useRef, useState } from 'react'
import type { StaffMember } from '@/types'
import type { Fridge } from '@/services/fridgeService'
import { VOICE_LIMITS } from '@/lib/voiceConfig'

type VoiceFridgeStep = 'idle' | 'awaiting_fridge' | 'awaiting_temperature' | 'awaiting_staff' | 'awaiting_confirmation'

interface UseVoiceFridgeFlowOptions {
    fridges: Fridge[]
    staffMembers: StaffMember[]
    onConfirm: (data: { fridgeId: string; temperature: number; staffId: string }) => Promise<void> | void
    onOpenModal: (fridgeIndex?: number) => void
    onCloseModal: () => void
    speak: (text: string, options?: { rate?: number; pitch?: number; onComplete?: () => void }) => void
    onAwaitingInput?: () => void
    onStopListening?: () => void
}

interface VoiceFridgeFlowState {
    step: VoiceFridgeStep
    fridgeId: string | null
    fridgeIndex: number | null
    staffId: string | null
    temperature: number | null
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
    const match = lower.match(/-?\d+(?:\.\d+)?/)
    if (match) return Number(match[0])

    const negative = /\b(minus|negative)\b/.test(lower)

    const pointMatch = lower.match(/\b([a-z]+)\s+(?:point|dot)\s+([a-z]+)\b/)
    if (pointMatch) {
        const a = TEXT_NUMBERS[pointMatch[1]]
        const b = TEXT_NUMBERS[pointMatch[2]]
        if (typeof a === 'number' && typeof b === 'number') {
            const val = Number(`${a}.${b}`)
            return negative ? -val : val
        }
    }

    const compositeMatch = lower.match(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+(one|two|three|four|five|six|seven|eight|nine)\b/)
    if (compositeMatch) {
        const tens = TEXT_NUMBERS[compositeMatch[1]]
        const ones = TEXT_NUMBERS[compositeMatch[2]]
        if (typeof tens === 'number' && typeof ones === 'number') {
            const val = tens + ones
            return negative ? -val : val
        }
    }

    for (const [word, val] of Object.entries(TEXT_NUMBERS)) {
        const regex = new RegExp(`\\b${word}\\b`, 'i')
        if (regex.test(lower)) return negative ? -val : val
    }

    const words = lower.split(/\s+/).filter(Boolean)
    for (const word of words) {
        if (word in HOMOPHONE_NUMBERS) {
            const value = HOMOPHONE_NUMBERS[word]
            return negative ? -value : value
        }
    }
    return null
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

export function useVoiceFridgeFlow({
    fridges,
    staffMembers,
    onConfirm,
    onOpenModal,
    onCloseModal,
    speak,
    onAwaitingInput,
    onStopListening,
}: UseVoiceFridgeFlowOptions) {
    const [state, setState] = useState<VoiceFridgeFlowState>({
        step: 'idle',
        fridgeId: null,
        fridgeIndex: null,
        staffId: null,
        temperature: null,
    })
    const retryRef = useRef<Record<VoiceFridgeStep, number>>({
        idle: 0,
        awaiting_fridge: 0,
        awaiting_temperature: 0,
        awaiting_staff: 0,
        awaiting_confirmation: 0,
    })

    const activeStaff = useMemo(() => staffMembers.filter((s) => s.active), [staffMembers])

    const reset = useCallback(() => {
        setState({ step: 'idle', fridgeId: null, fridgeIndex: null, staffId: null, temperature: null })
        retryRef.current = {
            idle: 0,
            awaiting_fridge: 0,
            awaiting_temperature: 0,
            awaiting_staff: 0,
            awaiting_confirmation: 0,
        }
    }, [])

    const promptRetryOrFallback = useCallback((step: VoiceFridgeStep, retryPrompt: string) => {
        retryRef.current[step] = (retryRef.current[step] ?? 0) + 1
        const attempts = retryRef.current[step]

        if (attempts >= VOICE_LIMITS.MAX_RETRIES_PER_STEP) {
            speak('I could not validate this step after several tries. Please complete it on screen.', {
                onComplete: () => reset()
            })
            return
        }

        speak(retryPrompt, {
            onComplete: () => onAwaitingInput?.()
        })
    }, [onAwaitingInput, reset, speak])

    const startFlow = useCallback(
        (fridgeNumber?: string) => {
            let preselectedFridge: Fridge | undefined
            let preselectedIndex: number | undefined

            if (fridgeNumber) {
                const num = findNumber(fridgeNumber)
                if (num !== null) {
                    // Try to match by code first
                    const numStr = num.toString()
                    const indexByCode = fridges.findIndex(f =>
                        f.fridge_code === numStr ||
                        (f.fridge_code && parseInt(f.fridge_code, 10) === num)
                    )

                    if (indexByCode !== -1) {
                        preselectedFridge = fridges[indexByCode]
                        preselectedIndex = indexByCode
                    } else {
                        // Fallback to sequential index
                        const index = Math.max(1, Math.floor(num)) - 1
                        if (fridges[index]) {
                            preselectedFridge = fridges[index]
                            preselectedIndex = index
                        }
                    }
                }
            }

            if (preselectedFridge) {
                onOpenModal(preselectedIndex)
                setState({
                    step: 'awaiting_temperature',
                    fridgeId: preselectedFridge.id,
                    fridgeIndex: preselectedIndex ?? null,
                    staffId: null,
                    temperature: null
                })
                retryRef.current.awaiting_temperature = 0
                const label = preselectedFridge.fridge_code ? `Fridge ${preselectedFridge.fridge_code}` : preselectedFridge.name
                speak(`${label} selected. What is the temperature?`, {
                    onComplete: () => onAwaitingInput?.()
                })
            } else {
                onOpenModal()
                setState({
                    step: 'awaiting_fridge',
                    fridgeId: null,
                    fridgeIndex: null,
                    staffId: null,
                    temperature: null
                })
                retryRef.current.awaiting_fridge = 0
                speak('Opening fridge temperature logger.')
                const fridgeList = fridges.map((f, i) => `${f.fridge_code || (i + 1)} ${f.name}`).join(', ')
                speak(`I found ${fridges.length} fridges. ${fridgeList}. Which one are you checking?`, {
                    onComplete: () => onAwaitingInput?.()
                })
            }
        },
        [fridges, onOpenModal, speak, onAwaitingInput]
    )

    const handleTranscript = useCallback(
        async (transcript: string) => {
            if (state.step === 'idle') return

            const cleaned = normalizeVoiceInput(transcript)

            if (cleaned === 'cancel' || cleaned === 'stop' || cleaned === 'exit') {
                speak('Cancelled.')
                onCloseModal()
                reset()
                return
            }

            // Step 1: Awaiting Fridge
            if (state.step === 'awaiting_fridge') {
                const num = findNumber(cleaned)
                let foundIndex = -1

                if (num !== null) {
                    const numStr = num.toString()
                    foundIndex = fridges.findIndex(f =>
                        f.fridge_code === numStr ||
                        (f.fridge_code && parseInt(f.fridge_code, 10) === num) ||
                        (fridges.indexOf(f) + 1) === num
                    )
                } else {
                    // Try name match
                    foundIndex = fridges.findIndex(f => cleaned.includes(f.name.toLowerCase()))
                }

                if (foundIndex === -1) {
                    const fridgeList = fridges.map((f, i) => `${f.fridge_code || (i + 1)} ${f.name}`).join(', ')
                    promptRetryOrFallback('awaiting_fridge', `I did not catch that. Please say the number or name: ${fridgeList}`)
                    return
                }

                const fridge = fridges[foundIndex]
                setState(prev => ({ ...prev, step: 'awaiting_temperature', fridgeId: fridge.id, fridgeIndex: foundIndex }))
                retryRef.current.awaiting_fridge = 0
                retryRef.current.awaiting_temperature = 0
                onOpenModal(foundIndex)
                const label = fridge.fridge_code ? `Fridge ${fridge.fridge_code}` : fridge.name
                speak(`Selected ${label}. What is the temperature?`, {
                    onComplete: () => onAwaitingInput?.()
                })
                return
            }

            // Step 2: Awaiting Temperature
            if (state.step === 'awaiting_temperature') {
                const num = findNumber(cleaned)
                if (num === null || Number.isNaN(num)) {
                    promptRetryOrFallback('awaiting_temperature', 'I did not catch the temperature. Please say the number.')
                    return
                }
                if (num < -30 || num > 30) {
                    promptRetryOrFallback('awaiting_temperature', `That sounds out of range. I heard ${num}. Please repeat the fridge temperature.`)
                    return
                }
                setState(prev => ({ ...prev, step: 'awaiting_staff', temperature: num }))
                retryRef.current.awaiting_temperature = 0
                retryRef.current.awaiting_staff = 0
                speak(`${num} degrees. What is your staff code?`, {
                    onComplete: () => onAwaitingInput?.()
                })
                return
            }

            // Step 3: Awaiting Staff
            if (state.step === 'awaiting_staff') {
                const num = findNumber(cleaned)
                const code = num?.toString()
                if (!code) {
                    promptRetryOrFallback('awaiting_staff', 'Please say your staff code.')
                    return
                }
                const staff = activeStaff.find(s => s.staff_code === code || parseInt(s.staff_code || '', 10) === parseInt(code, 10))
                if (!staff) {
                    promptRetryOrFallback('awaiting_staff', `Staff code ${code} not found. Try again.`)
                    return
                }
                setState(prev => ({ ...prev, step: 'awaiting_confirmation', staffId: staff.id }))
                retryRef.current.awaiting_staff = 0
                retryRef.current.awaiting_confirmation = 0
                const fridge = fridges.find(f => f.id === state.fridgeId)
                const fridgeLabel = fridge?.fridge_code ? `Fridge ${fridge.fridge_code}` : fridge?.name || 'Fridge'
                speak(`Log ${state.temperature} degrees for ${fridgeLabel} by ${staff.name}? Say confirm to save.`, {
                    onComplete: () => onAwaitingInput?.()
                })
                return
            }

            // Step 4: Awaiting Confirmation
            if (state.step === 'awaiting_confirmation') {
                const isConfirm = isPositiveConfirmation(cleaned)
                if (isConfirm) {
                    if (state.fridgeId && state.temperature !== null && state.staffId) {
                        await onConfirm({
                            fridgeId: state.fridgeId,
                            temperature: state.temperature,
                            staffId: state.staffId
                        })
                    }
                    speak('Temperature logged successfully.')
                    onCloseModal()
                    reset()
                    return
                }
                if (isNegativeResponse(cleaned)) {
                    setState(prev => ({ ...prev, step: 'awaiting_temperature' }))
                    retryRef.current.awaiting_confirmation = 0
                    speak('Okay, let us correct it. What is the temperature?', {
                        onComplete: () => onAwaitingInput?.()
                    })
                    return
                }
                promptRetryOrFallback('awaiting_confirmation', 'Say confirm to save, or cancel.')
                return
            }
        },
        [state, fridges, activeStaff, onConfirm, onOpenModal, onCloseModal, reset, speak, onAwaitingInput, promptRetryOrFallback]
    )

    const checkInterimTranscript = useCallback(
        (transcript: string): boolean => {
            if (state.step === 'idle') return false
            const cleaned = normalizeVoiceInput(transcript)

            if (cleaned === 'cancel' || cleaned === 'stop' || cleaned === 'exit') {
                onStopListening?.()
                return true
            }

            // IMPORTANT:
            // Do not stop early on interim numeric/confirmation guesses.
            // In Realtime mode this can cut audio before final transcript is emitted.
            // Let final transcript or post-speech timeout close naturally.
            return false
        },
        [state.step, onStopListening]
    )

    const isQuickResponseStep = state.step === 'awaiting_temperature' || state.step === 'awaiting_staff'

    return {
        step: state.step,
        fridgeIndex: state.fridgeIndex,
        temperature: state.temperature,
        staffId: state.staffId,
        isQuickResponseStep,
        startFlow,
        handleTranscript,
        checkInterimTranscript,
        reset,
    }
}
