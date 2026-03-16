import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { WorkflowState } from '@/types'
import {
  acknowledgeReminder,
  completeCooking,
  completeCooling,
  completeReheating,
  fetchHaccpLifecycles,
  fetchHaccpReminders,
  fetchHaccpWorkflows,
  logHotHoldCheck,
  markReminderDelivered,
  registerPushSubscription,
  removePushSubscription,
  startCooking,
  startCooling,
  startHotHold,
  startReheating,
  stopHotHold,
  transitionWorkflowToCooling,
} from '@/services/haccpService'
import { VENUE_STATS_KEYS } from '@/hooks/queries/useVenueStats'

export const LIVE_HACCP_STATES: WorkflowState[] = ['active', 'awaiting_completion', 'needs_action']
export const HISTORY_HACCP_STATES: WorkflowState[] = ['completed', 'discarded', 'cancelled', 'needs_action']

export const HACCP_KEYS = {
  all: ['haccp'] as const,
  workflows: () => [...HACCP_KEYS.all, 'workflows'] as const,
  workflowList: (siteId: string | undefined, states: WorkflowState[]) =>
    [...HACCP_KEYS.workflows(), siteId, states.join('|')] as const,
  reminders: (siteId: string | undefined) => [...HACCP_KEYS.all, 'reminders', siteId] as const,
  lifecycles: (siteId: string | undefined) => [...HACCP_KEYS.all, 'lifecycles', siteId] as const,
} as const

export function invalidateHaccpQueries(queryClient: QueryClient, siteId?: string) {
  queryClient.invalidateQueries({ queryKey: HACCP_KEYS.all })
  if (siteId) {
    queryClient.invalidateQueries({ queryKey: HACCP_KEYS.reminders(siteId) })
    queryClient.invalidateQueries({ queryKey: HACCP_KEYS.lifecycles(siteId) })
  }
  queryClient.invalidateQueries({ queryKey: VENUE_STATS_KEYS.all })
}

export function useHaccpWorkflows(siteId: string | undefined, states: WorkflowState[] = LIVE_HACCP_STATES) {
  const stableStates = useMemo(() => [...states], [states.join('|')])

  return useQuery({
    queryKey: HACCP_KEYS.workflowList(siteId, stableStates),
    queryFn: async () => {
      if (!siteId) return []
      return fetchHaccpWorkflows(siteId, stableStates)
    },
    enabled: !!siteId,
    refetchInterval: 1000 * 60,
  })
}

export function useHaccpReminders(siteId: string | undefined) {
  return useQuery({
    queryKey: HACCP_KEYS.reminders(siteId),
    queryFn: async () => {
      if (!siteId) return []
      return fetchHaccpReminders(siteId)
    },
    enabled: !!siteId,
    refetchInterval: 1000 * 30,
  })
}

export function useHaccpLifecycles(siteId: string | undefined) {
  return useQuery({
    queryKey: HACCP_KEYS.lifecycles(siteId),
    queryFn: async () => {
      if (!siteId) return []
      return fetchHaccpLifecycles(siteId)
    },
    enabled: !!siteId,
  })
}

function useHaccpMutation<TVariables>(
  siteId: string | undefined,
  mutationFn: (variables: TVariables) => Promise<unknown>,
  successMessage?: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateHaccpQueries(queryClient, siteId)
      if (successMessage) toast.success(successMessage)
    },
    onError: (error) => {
      console.error('[HACCP] Mutation failed', error)
      toast.error(error instanceof Error ? error.message : 'HACCP action failed')
    },
  })
}

export function useHaccpMutations(siteId: string | undefined) {
  return {
    startCooking: useHaccpMutation(siteId, startCooking, 'Cooking workflow started'),
    completeCooking: useHaccpMutation(siteId, completeCooking, 'Cooking workflow updated'),
    startCooling: useHaccpMutation(siteId, startCooling, 'Cooling workflow started'),
    completeCooling: useHaccpMutation(siteId, completeCooling, 'Cooling workflow updated'),
    startReheating: useHaccpMutation(siteId, startReheating, 'Reheating workflow started'),
    completeReheating: useHaccpMutation(siteId, completeReheating, 'Reheating workflow updated'),
    startHotHold: useHaccpMutation(siteId, startHotHold, 'Hot hold started'),
    logHotHoldCheck: useHaccpMutation(siteId, logHotHoldCheck, 'Hot hold check logged'),
    stopHotHold: useHaccpMutation(siteId, ({ workflowId, actor }: { workflowId: string; actor?: { id?: string | null; name?: string | null } }) => stopHotHold(workflowId, actor), 'Hot hold stopped'),
    transitionToCooling: useHaccpMutation(siteId, ({ workflowId, actor }: { workflowId: string; actor?: { id?: string | null; name?: string | null } }) => transitionWorkflowToCooling(workflowId, actor), 'Cooling started from completed stage'),
    acknowledgeReminder: useHaccpMutation(siteId, acknowledgeReminder),
    markReminderDelivered: useHaccpMutation(siteId, markReminderDelivered),
    registerPushSubscription: useHaccpMutation(siteId, registerPushSubscription),
    removePushSubscription: useHaccpMutation(siteId, removePushSubscription),
  }
}
