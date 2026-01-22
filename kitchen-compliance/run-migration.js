import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const sql = readFileSync('./supabase/migrations/20260122150000_auto_create_profile.sql', 'utf-8')

console.log('🚀 Running migration...')

// Split SQL into individual statements
const statements = sql.split(';').filter(s => s.trim().length > 0)

for (const statement of statements) {
  console.log('\n📝 Executing:', statement.substring(0, 100) + '...')
  const { error } = await supabase.rpc('exec_sql', { sql_query: statement })
  if (error) {
    console.error('❌ Error:', error)
  } else {
    console.log('✅ Success')
  }
}

console.log('\n🎉 Migration complete!')
