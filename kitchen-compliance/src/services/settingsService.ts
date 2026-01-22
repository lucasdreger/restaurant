import { supabase } from '@/lib/supabase'
import type { StaffMember, StaffMemberInsert, StaffMemberUpdate, FoodItem, FoodItemInsert } from '@/types/database.types'

// Site Management
export const updateSiteSubscription = async (siteId: string, tier: 'basic' | 'pro' | 'enterprise') => {
  const { data, error } = await (supabase
    .from('sites') as any)
    .update({ subscription_tier: tier, updated_at: new Date().toISOString() })
    .eq('id', siteId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

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

// Food Presets Management
export const getFoodPresets = async (siteId?: string) => {
  let query = (supabase
    .from('food_items') as any)
    .select('*')

  if (siteId) {
    // Get both global items (null site_id) and site-specific items
    query = query.or(`site_id.eq.${siteId},site_id.is.null`)
  }
  
  const { data, error } = await query.order('name', { ascending: true })
  
  if (error) throw error
  return data as FoodItem[]
}

export const createFoodPreset = async (item: FoodItemInsert) => {
  // Using explicit cast to avoid TypeScript complex union inference issues with generated types
  const { data, error } = await supabase
    .from('food_items')
    .insert(item as any)
    .select()
    .single()
  
  if (error) throw error
  return data as FoodItem
}

export const deleteFoodPreset = async (id: string) => {
  const { error } = await supabase
    .from('food_items')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
