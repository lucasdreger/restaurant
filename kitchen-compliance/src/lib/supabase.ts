import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

// Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

// Create the Supabase client
let supabaseClient: SupabaseClient<Database> | null = null

if (isSupabaseConfigured()) {
  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // Important for OAuth redirects
      flowType: 'pkce', // Use PKCE flow for better security
    },
  })
}

// Export the client directly - no proxy wrapper
// This is important because Supabase auth methods need direct access
export const supabase = supabaseClient as SupabaseClient<Database>

// Helper to get the raw client for auth operations
export const getSupabaseClient = () => supabaseClient

// Demo site/venue ID (created in database)
export const DEMO_SITE_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'

// Re-export database types
export type { Database }
