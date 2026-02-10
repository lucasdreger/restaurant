import { useCallback, useMemo, useState } from 'react'
import type { StaffMember } from '@/types'
import type { Fridge } from '@/services/fridgeService'

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
}

function findNumber(text: string): number | null {
    const lower = text.toLowerCase().trim()
    const match = lower.match(/-?\d+(?:\.\d+)?/)
    if (match) return Number(match[0])

    for (const [word, val] of Object.entries(TEXT_NUMBERS)) {
        const regex = new RegExp(`\\b${word}\\b`, 'i')
        if (regex.test(lower)) return val
    }
    return null
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

    const activeStaff = useMemo(() => staffMembers.filter((s) => s.active), [staffMembers])

    const reset = useCallback(() => {
        setState({ step: 'idle', fridgeId: null, fridgeIndex: null, staffId: null, temperature: null })
    }, [])

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

            const cleaned = transcript.toLowerCase()
                .replace(/^(okay|ok|hey|hi)\s+luma\s*,?\s*/i, '')
                .trim()

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
                    speak(`I didn't catch that. Please say the number or name: ${fridgeList}`, {
                        onComplete: () => onAwaitingInput?.()
                    })
                    return
                }

                const fridge = fridges[foundIndex]
                setState(prev => ({ ...prev, step: 'awaiting_temperature', fridgeId: fridge.id, fridgeIndex: foundIndex }))
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
                    speak("I didn't catch the temperature. Please say the number.", {
                        onComplete: () => onAwaitingInput?.()
                    })
                    return
                }
                setState(prev => ({ ...prev, step: 'awaiting_staff', temperature: num }))
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
                    speak("Please say your staff code.", {
                        onComplete: () => onAwaitingInput?.()
                    })
                    return
                }
                const staff = activeStaff.find(s => s.staff_code === code || parseInt(s.staff_code || '', 10) === parseInt(code, 10))
                if (!staff) {
                    speak(`Staff code ${code} not found. Try again.`, {
                        onComplete: () => onAwaitingInput?.()
                    })
                    return
                }
                setState(prev => ({ ...prev, step: 'awaiting_confirmation', staffId: staff.id }))
                const fridge = fridges.find(f => f.id === state.fridgeId)
                const fridgeLabel = fridge?.fridge_code ? `Fridge ${fridge.fridge_code}` : fridge?.name || 'Fridge'
                speak(`Log ${state.temperature} degrees for ${fridgeLabel} by ${staff.name}? Say confirm to save.`, {
                    onComplete: () => onAwaitingInput?.()
                })
                return
            }

            // Step 4: Awaiting Confirmation
            if (state.step === 'awaiting_confirmation') {
                const isConfirm = cleaned.includes('confirm') || cleaned.includes('save') || cleaned.includes('yes') || cleaned.includes('ok')
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
                speak("Say confirm to save, or cancel.", {
                    onComplete: () => onAwaitingInput?.()
                })
            }
        },
        [state, fridges, activeStaff, onConfirm, onOpenModal, onCloseModal, reset, speak, onAwaitingInput]
    )

    const checkInterimTranscript = useCallback(
        (transcript: string): boolean => {
            if (state.step === 'idle') return false
            const cleaned = transcript.toLowerCase()
                .replace(/^(okay|ok|hey|hi)\s+luma\s*,?\s*/i, '')
                .trim()

            if (cleaned === 'cancel' || cleaned === 'stop' || cleaned === 'exit') {
                onStopListening?.()
                return true
            }

            if (state.step === 'awaiting_fridge' || state.step === 'awaiting_temperature' || state.step === 'awaiting_staff') {
                if (findNumber(cleaned) !== null) {
                    onStopListening?.()
                    return true
                }
            }

            if (state.step === 'awaiting_confirmation') {
                const isConfirm = cleaned.includes('confirm') || cleaned.includes('save') || cleaned.includes('yes') || cleaned.includes('ok')
                if (isConfirm) {
                    onStopListening?.()
                    return true
                }
            }

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
