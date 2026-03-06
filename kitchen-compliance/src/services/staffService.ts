import { supabase } from '@/lib/supabase'
import type { StaffMember, StaffMemberInsert, StaffMemberUpdate } from '@/types/database.types'

// Staff Management
export const getStaffMembers = async (siteId: string) => {
    const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('site_id', siteId)
        .order('name')

    if (error) throw error
    return data as StaffMember[]
}

export const createStaffMember = async (staff: StaffMemberInsert) => {
    // Using explicit cast to avoid TypeScript complex union inference issues with generated types
    const { data, error } = await supabase
        .from('staff_members')
        .insert(staff as any)
        .select()
        .single()

    if (error) throw error
    return data as StaffMember
}

export const updateStaffMember = async (id: string, updates: StaffMemberUpdate) => {
    const { data, error } = await supabase
        .from('staff_members')
        // @ts-ignore - Typescript inference issue with generated types
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data as StaffMember
}

export const deleteStaffMember = async (id: string) => {
    const { error } = await supabase
        .from('staff_members')
        .delete()
        .eq('id', id)

    if (error) throw error
}

/**
 * Verify a staff PIN securely via Edge Function.
 * PINs are hashed with bcrypt server-side — never compared in plaintext.
 */
export const verifyPin = async (siteId: string, pin: string): Promise<StaffMember | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-pin`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ siteId, pin }),
        }
    )

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error || 'PIN verification failed')
    }

    const result = await response.json()
    return result.staff as StaffMember | null
}
