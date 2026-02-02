import { supabase } from '@/lib/supabase'
import type { StaffMember, StaffMemberInsert, StaffMemberUpdate, FoodItem, FoodItemInsert } from '@/types/database.types'
import type { WakeWordId } from '@/store/useAppStore'

export interface SiteSettingsPayload {
  site_id: string
  theme?: string | null
  language?: string | null
  voice_provider?: string | null
  audio_model?: string | null
  openai_api_key?: string | null
  openrouter_api_key?: string | null
  ocr_provider?: string | null
  ocr_model?: string | null
  tts_enabled?: boolean | null
  wake_word_enabled?: boolean | null
  active_wake_words?: WakeWordId[] | null
}

export interface SiteSettingsRecord {
  id: string
  site_id: string
  theme: string | null
  language: string | null
  voice_provider: string | null
  audio_model: string | null
  openai_api_key: string | null
  openrouter_api_key: string | null
  ocr_provider: string | null
  ocr_model: string | null
  tts_enabled: boolean | null
  wake_word_enabled: boolean | null
  active_wake_words: WakeWordId[] | null
  created_at: string | null
  updated_at: string | null
}

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

// Site Settings (per restaurant)
export const getSiteSettings = async (siteId: string) => {
  const { data, error } = await (supabase
    .from('site_settings') as any)
    .select('*')
    .eq('site_id', siteId)
    .maybeSingle()

  if (error) throw error
  return data as SiteSettingsRecord | null
}

export const upsertSiteSettings = async (payload: SiteSettingsPayload) => {
  const { data, error } = await (supabase
    .from('site_settings') as any)
    .upsert({
      ...payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'site_id' })
    .select()
    .single()

  if (error) throw error
  return data as SiteSettingsRecord
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
