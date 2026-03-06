import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { StaffMember } from '@/types/database.types'
import { toast } from 'sonner'
import { getStaffMembers, createStaffMember, updateStaffMember, deleteStaffMember } from '@/services/staffService'

export const STAFF_KEYS = {
    all: ['staff'] as const,
    lists: () => [...STAFF_KEYS.all, 'list'] as const,
    list: (siteId: string | undefined) => [...STAFF_KEYS.lists(), siteId] as const,
}

export function useStaff(siteId: string | undefined) {
    return useQuery({
        queryKey: STAFF_KEYS.list(siteId),
        queryFn: async () => {
            if (!siteId) return []
            return getStaffMembers(siteId)
        },
        enabled: !!siteId,
    })
}

export function useCreateStaff() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: createStaffMember,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: STAFF_KEYS.lists() }) // Invalidate all staff lists
            toast.success('Staff member created')
        },
        onError: (error) => {
            console.error('Failed to add staff:', error)
            toast.error('Failed to add staff member')
        }
    })
}

export function useUpdateStaff() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<StaffMember> }) =>
            updateStaffMember(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: STAFF_KEYS.lists() })
            toast.success('Staff member updated')
        },
        onError: (error) => {
            console.error('Failed to update staff:', error)
            toast.error('Failed to update staff member')
        }
    })
}

export function useDeleteStaff() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: deleteStaffMember,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: STAFF_KEYS.lists() })
            toast.success('Staff member removed')
        },
        onError: (error) => {
            console.error('Failed to delete staff:', error)
            toast.error('Failed to remove staff member')
        }
    })
}
