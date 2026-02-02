import { createClient } from '@supabase/supabase-js'

// Test script para verificar inserção no modo demo
async function testDemoReceipt() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })

  console.log('🔍 Testando inserção no modo demo...')
  
  // Testar autenticação com demo user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'demo@chefvoice.app',
    password: 'demo123!@#'
  })
  
  if (authError) {
    console.error('❌ Erro de autenticação:', authError.message)
    return
  }
  
  console.log('✅ Autenticado como:', authData.user.email)
  
  // Testar inserção direta
  const receiptData = {
    site_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    supplier_name: 'Test Supplier',
    invoice_number: 'TEST-' + Date.now(),
    invoice_date: new Date().toISOString().split('T')[0],
    received_by_staff_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    received_by_name: 'John Chef',
    received_at: new Date().toISOString(),
    overall_temperature: 5.0,
    temperature_compliant: true,
    ocr_raw_text: 'Test OCR text',
    ocr_confidence: 0.95,
    notes: 'Test receipt from script',
    status: 'completed'
  }
  
  const { data, error } = await supabase
    .from('goods_receipts')
    .insert(receiptData)
    .select()
    .single()
    
  if (error) {
    console.error('❌ Erro ao inserir receipt:', error)
    console.error('Detalhes:', {
      code: error.code,
      details: error.details,
      hint: error.hint
    })
  } else {
    console.log('✅ Receipt criado com sucesso:', data.id)
    
    // Testar inserção de item
    const itemData = {
      receipt_id: data.id,
      item_name: 'Test Item',
      quantity: 5.0,
      unit: 'kg',
      temperature: 4.5,
      temperature_compliant: true,
      category: 'chilled',
      notes: 'Test item',
      sort_order: 0
    }
    
    const { data: item, error: itemError } = await supabase
      .from('goods_receipt_items')
      .insert(itemData)
      .select()
      .single()
      
    if (itemError) {
      console.error('❌ Erro ao inserir item:', itemError)
    } else {
      console.log('✅ Item criado com sucesso:', item.id)
    }
  }
  
  // Verificar sessão atual
  const { data: sessionData } = await supabase.auth.getSession()
  console.log('🔄 Sessão atual:', sessionData.session?.user?.id)
}

testDemoReceipt().catch(console.error)
