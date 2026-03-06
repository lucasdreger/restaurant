/**
 * OCR Service for Invoice Processing
 * 
 * All OCR processing is proxied through the Supabase Edge Function `ai-proxy`.
 * Default model: Gemini 2.0 Flash via OpenRouter (configured server-side).
 * API keys are stored as Supabase secrets — never exposed to the client.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export interface OCRInvoiceResult {
  supplier: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  items: Array<{
    id: string
    name: string
    quantity: string
    unit: string
    temperature?: string
  }>
  rawText: string
  confidence: number
  provider: string
  model: string
}

/**
 * Convert File to base64 data URL
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Normalize unit strings
 */
function normalizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    'kilogram': 'kg', 'kilograms': 'kg', 'kilo': 'kg',
    'gram': 'g', 'grams': 'g',
    'litre': 'l', 'liter': 'l', 'litres': 'l', 'liters': 'l',
    'millilitre': 'ml', 'milliliter': 'ml',
    'piece': 'pcs', 'pieces': 'pcs', 'pc': 'pcs', 'each': 'pcs', 'ea': 'pcs',
    'unit': 'pcs', 'units': 'pcs',
    'case': 'box', 'cases': 'box', 'boxes': 'box',
  }

  const lower = (unit || 'pcs').toLowerCase().trim()
  return unitMap[lower] || lower
}

/**
 * Process an invoice image via the ai-proxy Edge Function.
 * No API keys needed on the client — server-side secrets are used.
 */
export async function processInvoiceImage(
  file: File,
  siteId?: string,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRInvoiceResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured')
  }

  console.log('🔍 Starting OCR via Edge Function')
  onProgress?.(10, 'Preparing image...')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const base64Image = await fileToBase64(file)
  onProgress?.(30, 'Processing with AI...')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'ocr',
          image_base64: base64Image,
          model: 'google/gemini-2.0-flash-001',
          site_id: siteId || null,
        }),
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      console.error('OCR Edge Function error:', error)
      throw new Error(error.error || `OCR failed: ${response.status}`)
    }

    onProgress?.(90, 'Parsing results...')
    const parsed = await response.json()
    onProgress?.(100, 'Done')

    // Transform items to include IDs
    const items = (parsed.items || []).map((item: any) => ({
      id: crypto.randomUUID(),
      name: item.name || 'Unknown Item',
      quantity: String(item.quantity || '1'),
      unit: normalizeUnit(item.unit || 'pcs'),
      temperature: undefined,
    }))

    console.log('✅ Extracted', items.length, 'items via Edge Function')

    return {
      supplier: parsed.supplier || null,
      invoiceNumber: parsed.invoiceNumber || null,
      invoiceDate: parsed.invoiceDate || null,
      items,
      rawText: parsed.rawText || '',
      confidence: parsed.confidence || 95,
      provider: parsed.provider || 'openrouter',
      model: parsed.model || 'google/gemini-2.0-flash',
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OCR request timed out after 60 seconds')
    }
    console.error('OCR error:', error)
    throw error
  }
}

/**
 * OCR is always available when user is authenticated
 * (API keys are server-side, no client-side check needed)
 */
export function isOcrAvailable(): boolean {
  return true
}
