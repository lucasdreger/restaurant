import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { RefObject } from 'react'
import type { VoiceButtonHandle } from '@/components/voice/VoiceButton'
import type {
  ActionDialogContext,
  ActionDialogPrefill,
  CookCompletionAction,
  StartContext,
} from '@/components/haccp/HaccpWorkflowDialogs'
import { isWorkflowTemperatureCompliant } from '@/lib/haccp'
import type { HaccpCorrectiveAction, HaccpReminder, HaccpWorkflow, VoiceCommand, WorkflowKind } from '@/types'
import type { HaccpWorkflowActor } from '@/services/haccpService'

type MutationLike<TVariables> = {
  mutateAsync: (variables: TVariables) => Promise<unknown>
}

type HaccpMutations = {
  startCooking: MutationLike<any>
  completeCooking: MutationLike<any>
  startCooling: MutationLike<any>
  completeCooling: MutationLike<any>
  startReheating: MutationLike<any>
  completeReheating: MutationLike<any>
  startHotHold: MutationLike<any>
  logHotHoldCheck: MutationLike<any>
  stopHotHold: MutationLike<any>
  transitionToCooling: MutationLike<any>
  markReminderDelivered: MutationLike<string>
}

type PendingFlow =
  | {
      type: 'start_cooking'
      itemName?: string
      step: 'item'
      retries: number
      prompt: string
    }
  | {
      type: 'complete_cooking'
      workflow: HaccpWorkflow
      temperature?: number
      postCompletionAction?: CookCompletionAction
      step: 'temperature' | 'post_completion_action'
      retries: number
      prompt: string
    }
  | {
      type: 'start_cooling'
      itemName?: string
      step: 'item' | 'temperature'
      retries: number
      prompt: string
    }
  | {
      type: 'complete_cooling'
      workflow: HaccpWorkflow
      step: 'temperature'
      retries: number
      prompt: string
    }
  | {
      type: 'start_reheating'
      itemName?: string
      step: 'item'
      retries: number
      prompt: string
    }
  | {
      type: 'complete_reheating'
      workflow: HaccpWorkflow
      step: 'temperature'
      retries: number
      prompt: string
    }
  | {
      type: 'start_hot_hold'
      itemName?: string
      step: 'item' | 'temperature'
      retries: number
      prompt: string
    }
  | {
      type: 'log_hot_hold_check'
      workflow: HaccpWorkflow
      itemName?: string
      temperature?: number
      step: 'temperature' | 'corrective_action'
      retries: number
      prompt: string
    }

type StaffIdentity = {
  id?: string | null
  name?: string | null
}

function normalise(text: string) {
  return text.trim().toLowerCase()
}

function parseTemperature(text: string): number | null {
  const match = text.match(/-?\d+(?:\.\d+)?/)
  if (match) return Number(match[0])
  return null
}

function parseCorrectiveAction(text: string): HaccpCorrectiveAction | null {
  const normalized = normalise(text)
  if (normalized.includes('reheat')) return 'reheat'
  if (normalized.includes('discard') || normalized.includes('bin') || normalized.includes('throw')) return 'discard'
  if (normalized.includes('override')) return 'manual_override'
  return null
}

function parseCookCompletionAction(text: string): CookCompletionAction | null {
  const normalized = normalise(text)

  const startCoolingHints = [
    'start cooling',
    'cooling',
    'cool it',
    'move to cooling',
    'start cooling event',
    'resfri',
    'cool',
  ]

  if (startCoolingHints.some((hint) => normalized.includes(hint))) {
    return 'start_cooling'
  }

  const closeHints = [
    'just close',
    'only close',
    'close',
    'finish',
    'end cook',
    'encerrar',
    'fechar',
  ]

  if (closeHints.some((hint) => normalized.includes(hint))) {
    return 'close'
  }

  return null
}

function sameItem(workflow: HaccpWorkflow, item?: string) {
  if (!item) return true
  return normalise(workflow.item_name) === normalise(item)
}

function chooseWorkflow(
  workflows: HaccpWorkflow[],
  kind: WorkflowKind,
  states: string[],
  item?: string,
) {
  return workflows.find(
    (workflow) =>
      workflow.workflow_kind === kind &&
      states.includes(workflow.state) &&
      sameItem(workflow, item),
  )
}

function chooseTransitionSource(workflows: HaccpWorkflow[], item?: string) {
  return workflows.find(
    (workflow) =>
      workflow.workflow_kind === 'cooking' &&
      workflow.state === 'completed' &&
      sameItem(workflow, item),
  )
}

function buildStartPreview(flow: PendingFlow): StartContext | null {
  if (flow.type === 'start_cooking') {
    return {
      kind: 'cooking',
      itemName: flow.itemName,
    }
  }

  if (flow.type === 'start_cooling') {
    return {
      kind: 'cooling',
      itemName: flow.itemName,
    }
  }

  if (flow.type === 'start_reheating') {
    return {
      kind: 'reheating',
      itemName: flow.itemName,
    }
  }

  if (flow.type === 'start_hot_hold') {
    return {
      kind: 'hot_hold',
      itemName: flow.itemName,
      locationLabel: 'Hot Pass',
    }
  }

  return null
}

function buildActionPreview(flow: PendingFlow): ActionDialogContext | null {
  if (flow.type === 'complete_cooking') {
    const prefill: ActionDialogPrefill = {}
    if (flow.temperature != null) {
      prefill.temperature = flow.temperature
    }
    if (flow.postCompletionAction) {
      prefill.postCompletionAction = flow.postCompletionAction
    }

    return {
      workflow: flow.workflow,
      mode: 'complete',
      prefill: Object.keys(prefill).length > 0 ? prefill : undefined,
    }
  }

  if (flow.type === 'complete_cooling') {
    return {
      workflow: flow.workflow,
      mode: 'complete',
    }
  }

  if (flow.type === 'complete_reheating') {
    return {
      workflow: flow.workflow,
      mode: 'complete',
    }
  }

  if (flow.type === 'log_hot_hold_check') {
    const prefill: ActionDialogPrefill = {
      temperature: flow.temperature ?? null,
    }

    return {
      workflow: flow.workflow,
      mode: 'hold_check',
      prefill,
    }
  }

  return null
}

async function showReminderNotification(title: string, body: string) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false
  if (Notification.permission !== 'granted') return false

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.showNotification(title, { body, tag: title })
        return true
      }
    }

    new Notification(title, { body })
    return true
  } catch {
    return false
  }
}

export function useHaccpVoiceController({
  siteId,
  workflows,
  reminders,
  actor,
  voiceButtonRef,
  isVoiceBusy,
  onOpenStartDialog,
  onOpenActionDialog,
  onSyncStartDialog,
  onSyncActionDialog,
  mutations,
}: {
  siteId?: string
  workflows: HaccpWorkflow[]
  reminders: HaccpReminder[]
  actor?: StaffIdentity | null
  voiceButtonRef: RefObject<VoiceButtonHandle | null>
  isVoiceBusy: boolean
  onOpenStartDialog: (context: StartContext) => void
  onOpenActionDialog: (context: ActionDialogContext) => void
  onSyncStartDialog?: (context: StartContext | null) => void
  onSyncActionDialog?: (context: ActionDialogContext | null) => void
  mutations: HaccpMutations
}) {
  const [pendingFlow, setPendingFlow] = useState<PendingFlow | null>(null)
  const spokenRemindersRef = useRef<Set<string>>(new Set())
  const lastPromptKeyRef = useRef<string | null>(null)

  const conversationMode = Boolean(pendingFlow)

  const speak = useCallback(
    (text: string) => {
      const voiceButton = voiceButtonRef.current
      if (!voiceButton) return

      voiceButton.stopVoice()
      if (voiceButton.isRealtimeConversation) {
        voiceButton.triggerVoice()
        window.setTimeout(() => {
          voiceButton.speakText(text, { preferRealtime: true })
        }, 100)
        return
      }

      voiceButton.speakText(text, {
        preferRealtime: true,
        onComplete: () => {
          if (conversationMode) {
            voiceButton.triggerVoice()
          }
        },
      })
    },
    [conversationMode, voiceButtonRef],
  )

  useEffect(() => {
    if (!pendingFlow) {
      lastPromptKeyRef.current = null
      return
    }

    const promptKey = `${pendingFlow.type}:${pendingFlow.step}:${pendingFlow.retries}:${pendingFlow.prompt}`
    if (lastPromptKeyRef.current === promptKey) return
    lastPromptKeyRef.current = promptKey
    speak(pendingFlow.prompt)
  }, [pendingFlow, speak])

  useEffect(() => {
    if (!onSyncStartDialog && !onSyncActionDialog) return

    if (!pendingFlow) {
      onSyncStartDialog?.(null)
      onSyncActionDialog?.(null)
      return
    }

    onSyncStartDialog?.(buildStartPreview(pendingFlow))
    onSyncActionDialog?.(buildActionPreview(pendingFlow))
  }, [onSyncActionDialog, onSyncStartDialog, pendingFlow])

  const fallbackToManual = useCallback(
    (flow: PendingFlow) => {
      setPendingFlow(null)
      if (flow.type === 'start_cooking') {
        onOpenStartDialog({ kind: 'cooking', itemName: flow.itemName })
        return
      }
      if (flow.type === 'complete_cooking') {
        onOpenActionDialog({
          workflow: flow.workflow,
          mode: 'complete',
          prefill: {
            temperature: flow.temperature ?? null,
            postCompletionAction: flow.postCompletionAction ?? null,
          },
        })
        return
      }
      if (flow.type === 'start_cooling') {
        onOpenStartDialog({ kind: 'cooling', itemName: flow.itemName })
        return
      }
      if (flow.type === 'complete_cooling') {
        onOpenActionDialog({ workflow: flow.workflow, mode: 'complete' })
        return
      }
      if (flow.type === 'start_reheating') {
        onOpenStartDialog({ kind: 'reheating', itemName: flow.itemName })
        return
      }
      if (flow.type === 'complete_reheating') {
        onOpenActionDialog({ workflow: flow.workflow, mode: 'complete' })
        return
      }
      if (flow.type === 'start_hot_hold') {
        onOpenStartDialog({ kind: 'hot_hold', itemName: flow.itemName })
        return
      }
      if (flow.type === 'log_hot_hold_check') {
        onOpenActionDialog({ workflow: flow.workflow, mode: 'hold_check' })
      }
    },
    [onOpenActionDialog, onOpenStartDialog],
  )

  const retryOrFallback = useCallback(
    (flow: PendingFlow, prompt: string) => {
      if (flow.retries >= 2) {
        fallbackToManual(flow)
        toast.error('Voice validation failed three times. Opening manual HACCP form.')
        return
      }

      setPendingFlow({
        ...flow,
        retries: flow.retries + 1,
        prompt,
      })
    },
    [fallbackToManual],
  )

  const actorPayload = useMemo<HaccpWorkflowActor | undefined>(() => {
    if (!actor?.id && !actor?.name) return undefined
    return {
      id: actor?.id ?? null,
      name: actor?.name ?? null,
    }
  }, [actor?.id, actor?.name])

  const ensureActorAvailable = useCallback(() => {
    if (actorPayload) return true

    const message = 'Select an operator first so I can record the HACCP action.'
    toast.error(message)
    speak(message)
    return false
  }, [actorPayload, speak])

  const startCookingWorkflow = useCallback(
    async (itemName: string) => {
      onSyncStartDialog?.({
        kind: 'cooking',
        itemName,
      })
      await mutations.startCooking.mutateAsync({
        siteId,
        itemName,
        startedBy: actorPayload,
      })
      onSyncStartDialog?.(null)
    },
    [actorPayload, mutations.startCooking, onSyncStartDialog, siteId],
  )

  const completeCookingWorkflow = useCallback(
    async (workflow: HaccpWorkflow, temperature: number, postCompletionAction: CookCompletionAction) => {
      const compliant = isWorkflowTemperatureCompliant('cooking', temperature)

      onSyncActionDialog?.({
        workflow,
        mode: 'complete',
        prefill: {
          temperature,
          postCompletionAction: compliant ? postCompletionAction : 'close',
        },
      })

      await mutations.completeCooking.mutateAsync({
        workflowId: workflow.id,
        temperature,
        completedBy: actorPayload,
      })

      if (!compliant) {
        onSyncActionDialog?.(null)
        speak(`${workflow.item_name} is still below seventy five degrees and remains open.`)
        return
      }

      if (postCompletionAction === 'start_cooling') {
        await mutations.transitionToCooling.mutateAsync({
          workflowId: workflow.id,
          actor: actorPayload,
        })
        onSyncActionDialog?.(null)
        speak(`${workflow.item_name} cooking is complete and cooling has started.`)
        return
      }

      onSyncActionDialog?.(null)
      speak(`${workflow.item_name} cooking is complete and the cook event is closed.`)
    },
    [actorPayload, mutations.completeCooking, mutations.transitionToCooling, onSyncActionDialog, speak],
  )

  const handleVoiceCommand = useCallback(
    async (command: VoiceCommand) => {
      if (command.type === 'noise' || command.type === 'unknown') {
        return false
      }

      if (!ensureActorAvailable()) {
        return true
      }

      if (command.type === 'start_cooking') {
        if (!command.item) {
          setPendingFlow({
            type: 'start_cooking',
            step: 'item',
            retries: 0,
            prompt: 'What item are you cooking?',
          })
          return true
        }

        await startCookingWorkflow(command.item)
        speak(`Cooking started for ${command.item}. Tell me the final temperature when you are ready to close the cook event.`)
        return true
      }

      if (command.type === 'complete_cooking') {
        const workflow = chooseWorkflow(workflows, 'cooking', ['active', 'awaiting_completion'], command.item)
        if (!workflow) {
          speak('There is no active cooking workflow to complete.')
          return true
        }

        if (typeof command.temperature === 'number') {
          if (isWorkflowTemperatureCompliant('cooking', command.temperature)) {
            setPendingFlow({
              type: 'complete_cooking',
              workflow,
              temperature: command.temperature,
              step: 'post_completion_action',
              retries: 0,
              prompt: `Should I start cooling for ${workflow.item_name}, or just close the cook event?`,
            })
            return true
          }

          await completeCookingWorkflow(workflow, command.temperature, 'close')
          return true
        }

        setPendingFlow({
          type: 'complete_cooking',
          workflow,
          step: 'temperature',
          retries: 0,
          prompt: `What temperature did ${workflow.item_name} reach?`,
        })
        return true
      }

      if (command.type === 'start_cooling') {
        if (!command.item) {
          setPendingFlow({
            type: 'start_cooling',
            step: 'item',
            retries: 0,
            prompt: 'What item are you cooling?',
          })
          return true
        }

        const sourceWorkflow = chooseTransitionSource(workflows, command.item)
        if (sourceWorkflow) {
          await mutations.transitionToCooling.mutateAsync({
            workflowId: sourceWorkflow.id,
            actor: actorPayload,
          })
          speak(`${sourceWorkflow.item_name} is now in cooling.`)
          return true
        }

        setPendingFlow({
          type: 'start_cooling',
          itemName: command.item,
          step: 'temperature',
          retries: 0,
          prompt: `What is the current temperature for ${command.item}?`,
        })
        return true
      }

      if (command.type === 'stop_cooling') {
        const workflow = chooseWorkflow(workflows, 'cooling', ['active', 'awaiting_completion', 'needs_action'], command.item)
        if (!workflow) {
          speak('There is no active cooling workflow to complete.')
          return true
        }

        setPendingFlow({
          type: 'complete_cooling',
          workflow,
          step: 'temperature',
          retries: 0,
          prompt: `What temperature should I record for ${workflow.item_name}?`,
        })
        return true
      }

      if (command.type === 'start_reheating') {
        if (!command.item) {
          setPendingFlow({
            type: 'start_reheating',
            step: 'item',
            retries: 0,
            prompt: 'What item are you reheating?',
          })
          return true
        }

        onSyncStartDialog?.({
          kind: 'reheating',
          itemName: command.item,
        })
        await mutations.startReheating.mutateAsync({
          siteId,
          itemName: command.item,
          startedBy: actorPayload,
        })
        speak(`Reheating started for ${command.item}. Say reheating complete with the temperature when ready.`)
        return true
      }

      if (command.type === 'complete_reheating') {
        const workflow = chooseWorkflow(workflows, 'reheating', ['active', 'awaiting_completion'], command.item)
        if (!workflow) {
          speak('There is no active reheating workflow to complete.')
          return true
        }

        if (typeof command.temperature === 'number') {
          onSyncActionDialog?.({
            workflow,
            mode: 'complete',
            prefill: { temperature: command.temperature },
          })
          await mutations.completeReheating.mutateAsync({
            workflowId: workflow.id,
            temperature: command.temperature,
            completedBy: actorPayload,
          })
          speak(
            command.temperature >= 75
              ? `${workflow.item_name} reheating is complete.`
              : `${workflow.item_name} is still below seventy five degrees and remains open.`,
          )
          return true
        }

        setPendingFlow({
          type: 'complete_reheating',
          workflow,
          step: 'temperature',
          retries: 0,
          prompt: `What temperature did ${workflow.item_name} reach?`,
        })
        return true
      }

      if (command.type === 'start_hot_hold') {
        if (!command.item) {
          setPendingFlow({
            type: 'start_hot_hold',
            step: 'item',
            retries: 0,
            prompt: 'What item are you placing on hot hold?',
          })
          return true
        }

        setPendingFlow({
          type: 'start_hot_hold',
          itemName: command.item,
          step: 'temperature',
          retries: 0,
          prompt: `What is the current hot hold temperature for ${command.item}?`,
        })
        return true
      }

      if (command.type === 'log_hot_hold_check') {
        const workflow = chooseWorkflow(workflows, 'hot_hold', ['active', 'needs_action'], command.item)
        if (!workflow) {
          speak('There is no active hot hold workflow for that item.')
          return true
        }

        if (typeof command.temperature === 'number') {
          if (command.temperature < 63) {
            setPendingFlow({
              type: 'log_hot_hold_check',
              workflow,
              itemName: workflow.item_name,
              temperature: command.temperature,
              step: 'corrective_action',
              retries: 0,
              prompt: `Temperature is below sixty three degrees. Should I reheat, discard, or manual override ${workflow.item_name}?`,
            })
            return true
          }

          await mutations.logHotHoldCheck.mutateAsync({
            workflowId: workflow.id,
            temperature: command.temperature,
            actor: actorPayload,
          })
          speak(`${workflow.item_name} hot hold check recorded.`)
          return true
        }

        setPendingFlow({
          type: 'log_hot_hold_check',
          workflow,
          itemName: workflow.item_name,
          step: 'temperature',
          retries: 0,
          prompt: `What temperature should I record for ${workflow.item_name}?`,
        })
        return true
      }

      if (command.type === 'stop_hot_hold') {
        const workflow = chooseWorkflow(workflows, 'hot_hold', ['active', 'needs_action'], command.item)
        if (!workflow) {
          speak('There is no active hot hold workflow to stop.')
          return true
        }

        await mutations.stopHotHold.mutateAsync({ workflowId: workflow.id, actor: actorPayload })
        speak(`${workflow.item_name} hot hold is closed.`)
        return true
      }

      if (command.type === 'transition_to_cooling') {
        const workflow = chooseTransitionSource(workflows, command.item)
        if (!workflow) {
          speak('I could not find a completed cooking or reheating workflow to move into cooling.')
          return true
        }

        await mutations.transitionToCooling.mutateAsync({ workflowId: workflow.id, actor: actorPayload })
        speak(`${workflow.item_name} is now in cooling.`)
        return true
      }

      return false
    },
    [
      actorPayload,
      completeCookingWorkflow,
      ensureActorAvailable,
      mutations,
      onSyncActionDialog,
      onSyncStartDialog,
      siteId,
      speak,
      startCookingWorkflow,
      workflows,
    ],
  )

  const handleConversationTranscript = useCallback(
    async (transcript: string) => {
      if (!pendingFlow) return

      if (pendingFlow.type === 'start_cooking') {
        const itemName = transcript.trim() || pendingFlow.itemName
        if (!itemName) {
          retryOrFallback(pendingFlow, 'I did not catch the item name. What item are you cooking?')
          return
        }

        await startCookingWorkflow(itemName)
        setPendingFlow(null)
        speak(`Cooking started for ${itemName}. Tell me the final temperature when you are ready to close the cook event.`)
        return
      }

      if (pendingFlow.type === 'complete_cooking') {
        if (pendingFlow.step === 'temperature') {
          const temperature = parseTemperature(transcript)
          if (temperature == null) {
            retryOrFallback(pendingFlow, `I need the final cooking temperature for ${pendingFlow.workflow.item_name}.`)
            return
          }

          if (!isWorkflowTemperatureCompliant('cooking', temperature)) {
            await completeCookingWorkflow(pendingFlow.workflow, temperature, 'close')
            setPendingFlow(null)
            return
          }

          setPendingFlow({
            ...pendingFlow,
            temperature,
            step: 'post_completion_action',
            prompt: `Should I start cooling for ${pendingFlow.workflow.item_name}, or just close the cook event?`,
          })
          return
        }

        const postCompletionAction = parseCookCompletionAction(transcript)
        if (!postCompletionAction || pendingFlow.temperature == null) {
          retryOrFallback(
            pendingFlow,
            `Say start cooling or just close for ${pendingFlow.workflow.item_name}.`,
          )
          return
        }

        onSyncActionDialog?.({
          workflow: pendingFlow.workflow,
          mode: 'complete',
          prefill: {
            temperature: pendingFlow.temperature,
            postCompletionAction,
          },
        })
        await completeCookingWorkflow(pendingFlow.workflow, pendingFlow.temperature, postCompletionAction)
        setPendingFlow(null)
        return
      }

      if (pendingFlow.type === 'start_cooling') {
        if (pendingFlow.step === 'item') {
          const itemName = transcript.trim()
          if (!itemName) {
            retryOrFallback(pendingFlow, 'I did not catch the item name. What item are you cooling?')
            return
          }

          const sourceWorkflow = chooseTransitionSource(workflows, itemName)
          if (sourceWorkflow) {
            await mutations.transitionToCooling.mutateAsync({
              workflowId: sourceWorkflow.id,
              actor: actorPayload,
            })
            setPendingFlow(null)
            speak(`${sourceWorkflow.item_name} is now in cooling.`)
            return
          }

          setPendingFlow({
            ...pendingFlow,
            itemName,
            step: 'temperature',
            prompt: `What is the current temperature for ${itemName}?`,
          })
          return
        }

        const temperature = parseTemperature(transcript)
        if (temperature == null || !pendingFlow.itemName) {
          retryOrFallback(
            pendingFlow,
            `I need the current temperature for ${pendingFlow.itemName ?? 'that item'}. What is it in degrees Celsius?`,
          )
          return
        }

        onSyncStartDialog?.({
          kind: 'cooling',
          itemName: pendingFlow.itemName,
          temperature,
        })
        await mutations.startCooling.mutateAsync({
          siteId,
          itemName: pendingFlow.itemName,
          initialTemperature: temperature,
          startedBy: actorPayload,
          locationKind: 'kitchen',
        })
        setPendingFlow(null)
        speak(`${pendingFlow.itemName} cooling started.`)
        return
      }

      if (pendingFlow.type === 'complete_cooling') {
        const temperature = parseTemperature(transcript)
        if (temperature == null) {
          retryOrFallback(
            pendingFlow,
            `I need the final cooling temperature for ${pendingFlow.workflow.item_name}.`,
          )
          return
        }

        onSyncActionDialog?.({
          workflow: pendingFlow.workflow,
          mode: 'complete',
          prefill: { temperature },
        })
        await mutations.completeCooling.mutateAsync({
          workflowId: pendingFlow.workflow.id,
          temperature,
          completedBy: actorPayload,
          locationKind: 'fridge',
        })
        setPendingFlow(null)
        speak(
          temperature <= 8
            ? `${pendingFlow.workflow.item_name} cooling is complete and moved to fridge.`
            : `${pendingFlow.workflow.item_name} is above eight degrees and needs action.`,
        )
        return
      }

      if (pendingFlow.type === 'start_reheating') {
        const itemName = transcript.trim() || pendingFlow.itemName
        if (!itemName) {
          retryOrFallback(pendingFlow, 'I did not catch the item name. What item are you reheating?')
          return
        }

        onSyncStartDialog?.({
          kind: 'reheating',
          itemName,
        })
        await mutations.startReheating.mutateAsync({
          siteId,
          itemName,
          startedBy: actorPayload,
        })
        setPendingFlow(null)
        speak(`Reheating started for ${itemName}. Say reheating complete with the temperature when ready.`)
        return
      }

      if (pendingFlow.type === 'complete_reheating') {
        const temperature = parseTemperature(transcript)
        if (temperature == null) {
          retryOrFallback(pendingFlow, `I need the final reheating temperature for ${pendingFlow.workflow.item_name}.`)
          return
        }

        onSyncActionDialog?.({
          workflow: pendingFlow.workflow,
          mode: 'complete',
          prefill: { temperature },
        })
        await mutations.completeReheating.mutateAsync({
          workflowId: pendingFlow.workflow.id,
          temperature,
          completedBy: actorPayload,
        })
        setPendingFlow(null)
        speak(
          temperature >= 75
            ? `${pendingFlow.workflow.item_name} reheating is complete.`
            : `${pendingFlow.workflow.item_name} is still below seventy five degrees and remains open.`,
        )
        return
      }

      if (pendingFlow.type === 'start_hot_hold') {
        if (pendingFlow.step === 'item') {
          const itemName = transcript.trim()
          if (!itemName) {
            retryOrFallback(pendingFlow, 'I did not catch the item name. What item are you placing on hot hold?')
            return
          }

          setPendingFlow({
            ...pendingFlow,
            itemName,
            step: 'temperature',
            prompt: `What is the current hot hold temperature for ${itemName}?`,
          })
          return
        }

        const temperature = parseTemperature(transcript)
        if (temperature == null || !pendingFlow.itemName) {
          retryOrFallback(pendingFlow, `I need the hot hold temperature for ${pendingFlow.itemName ?? 'that item'}.`)
          return
        }

        onSyncStartDialog?.({
          kind: 'hot_hold',
          itemName: pendingFlow.itemName,
          temperature,
          locationLabel: 'Hot Pass',
        })
        await mutations.startHotHold.mutateAsync({
          siteId,
          itemName: pendingFlow.itemName,
          initialTemperature: temperature,
          startedBy: actorPayload,
          locationLabel: 'Hot Pass',
        })
        setPendingFlow(null)
        speak(
          temperature >= 63
            ? `${pendingFlow.itemName} is on hot hold. I will remind you again in ninety minutes.`
            : `${pendingFlow.itemName} is below the hot hold threshold and needs action.`,
        )
        return
      }

      if (pendingFlow.type === 'log_hot_hold_check') {
        if (pendingFlow.step === 'temperature') {
          const temperature = parseTemperature(transcript)
          if (temperature == null) {
            retryOrFallback(pendingFlow, `I need the current temperature for ${pendingFlow.workflow.item_name}.`)
            return
          }

          if (temperature < 63) {
            setPendingFlow({
              ...pendingFlow,
              temperature,
              step: 'corrective_action',
              prompt: `Temperature is below sixty three degrees. Should I reheat, discard, or manual override ${pendingFlow.workflow.item_name}?`,
            })
            return
          }

          await mutations.logHotHoldCheck.mutateAsync({
            workflowId: pendingFlow.workflow.id,
            temperature,
            actor: actorPayload,
          })
          setPendingFlow(null)
          speak(`${pendingFlow.workflow.item_name} hot hold check recorded.`)
          return
        }

        const correctiveAction = parseCorrectiveAction(transcript)
        if (!correctiveAction || pendingFlow.temperature == null) {
          retryOrFallback(pendingFlow, `Say reheat, discard, or manual override for ${pendingFlow.workflow.item_name}.`)
          return
        }

        await mutations.logHotHoldCheck.mutateAsync({
          workflowId: pendingFlow.workflow.id,
          temperature: pendingFlow.temperature,
          correctiveAction,
          actor: actorPayload,
        })
        setPendingFlow(null)
        speak(`${pendingFlow.workflow.item_name} corrective action has been logged.`)
      }
    },
    [
      actorPayload,
      completeCookingWorkflow,
      mutations,
      onSyncActionDialog,
      onSyncStartDialog,
      pendingFlow,
      retryOrFallback,
      siteId,
      speak,
      startCookingWorkflow,
      workflows,
    ],
  )

  useEffect(() => {
    const now = Date.now()
    const dueReminders = reminders.filter((reminder) => {
      if (spokenRemindersRef.current.has(reminder.id)) return false
      if (reminder.delivery_state === 'acknowledged' || reminder.delivery_state === 'cancelled') return false
      return new Date(reminder.due_at).getTime() <= now
    })

    if (dueReminders.length === 0 || pendingFlow || isVoiceBusy) return

    const reminder = dueReminders[0]
    const workflow = workflows.find((entry) => entry.id === reminder.workflow_id)
    const itemName = workflow?.item_name ?? 'hot hold item'
    const message = `${itemName} is due for a hot hold check.`

    spokenRemindersRef.current.add(reminder.id)

    void (async () => {
      if (typeof document !== 'undefined' && document.hidden) {
        await showReminderNotification('ChefVoice HACCP Reminder', message)
      } else {
        speak(message)
      }
      await mutations.markReminderDelivered.mutateAsync(reminder.id)
    })()
  }, [isVoiceBusy, mutations, pendingFlow, reminders, speak, workflows])

  return {
    conversationMode,
    handleVoiceCommand,
    handleConversationTranscript,
    cancelConversation: () => setPendingFlow(null),
    activeFlowLabel: pendingFlow?.type ?? null,
  }
}
