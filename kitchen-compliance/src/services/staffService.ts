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

export const verifyPin = async (siteId: string, pin: string) => {
    const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('site_id', siteId)
        .eq('pin', pin)
        .eq('active', true)
        .maybeSingle()

    if (error) throw error
    return data as StaffMember | null
}
