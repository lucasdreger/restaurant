import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

// Supabase configuration
// These should be set via environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

// Create Supabase client only if configured
// Use a placeholder client that returns empty results if not configured
let _supabase: SupabaseClient<Database> | null = null

if (isSupabaseConfigured()) {
  _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
}

// Export a proxy that checks configuration before use
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    if (!_supabase) {
      // Return a mock that logs warnings for unconfigured Supabase
      if (prop === 'from') {
        return () => ({
          select: () => Promise.resolve({ data: [], error: null }),
          insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          upsert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          update: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          delete: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        })
      }
      return () => {}
    }
    return (_supabase as unknown as Record<string, unknown>)[prop as string]
  },
})

// Demo site ID (created in database)
export const DEMO_SITE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

// Re-export database types
export type { Database }
