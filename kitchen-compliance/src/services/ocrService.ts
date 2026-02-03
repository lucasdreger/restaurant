/**
 * OCR Service for Invoice Processing
 * Supports multiple providers:
 * - OpenAI GPT-4o Vision (direct API)
 * - OpenRouter (Claude, GPT-4o, Gemini via OpenRouter)
 * 
 * Note: Tesseract.js was removed due to performance issues with mobile camera images.
 * API-based OCR is now required.
 */

import type { OCRModel, OCRProvider } from '@/store/useAppStore'

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
  provider: OCRProvider
  model: string
}

// Settings passed from the app
export interface OCRSettings {
  provider: OCRProvider
  model: OCRModel
  openaiApiKey: string | null
  openrouterApiKey: string | null
}

// Model display names and info
export const OCR_MODEL_INFO: Record<OCRModel, { name: string; provider: OCRProvider; price: string; badge?: string }> = {
  'openai/gpt-4o': { name: 'GPT-4o', provider: 'openai', price: '$2.50/1M tokens', badge: 'Best' },
  'openai/gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'openai', price: '$0.15/1M tokens', badge: 'Value' },
  'anthropic/claude-sonnet': { name: 'Claude 3.5 Sonnet', provider: 'openrouter', price: '$3/1M tokens' },
  'anthropic/claude-haiku': { name: 'Claude 3 Haiku', provider: 'openrouter', price: '$0.25/1M tokens', badge: 'Fast' },
  'google/gemini-2.0-flash': { name: 'Gemini 2.0 Flash', provider: 'openrouter', price: '$0.10/1M tokens', badge: 'Recommended' },
  'google/gemini-flash-1.5': { name: 'Gemini 1.5 Flash', provider: 'openrouter', price: '$0.075/1M tokens' },
}

// OpenRouter model IDs (some need mapping)
const OPENROUTER_MODEL_IDS: Record<string, string> = {
  'anthropic/claude-sonnet': 'anthropic/claude-3.5-sonnet',
  'anthropic/claude-haiku': 'anthropic/claude-3-haiku',
  'google/gemini-2.0-flash': 'google/gemini-2.0-flash-001',
  'google/gemini-flash-1.5': 'google/gemini-flash-1.5',
  'openai/gpt-4o': 'openai/gpt-4o',
  'openai/gpt-4o-mini': 'openai/gpt-4o-mini',
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
 * Get the system prompt for invoice parsing
 */
function getInvoiceParserPrompt(): string {
  return `You are an expert invoice/delivery note parser for a restaurant kitchen. 
Extract the following information from the invoice image and return it as valid JSON:

{
  "supplier": "Company name of the supplier",
  "invoiceNumber": "Invoice or delivery note number",
  "invoiceDate": "Date in YYYY-MM-DD format",
  "items": [
    {
      "name": "Product name",
      "quantity": "Numeric quantity as string",
      "unit": "Unit (kg, g, l, ml, pcs, box, case, etc.)"
    }
  ],
  "rawText": "Brief summary of what you see on the invoice"
}

Rules:
- Extract ALL line items you can find
- Normalize units: kg, g, l, ml, pcs, box, case
- If quantity and unit are combined (e.g., "2.5kg"), separate them
- For items without clear units, use "pcs"
- Dates should be converted to YYYY-MM-DD format
- If you cannot find a field, use null
- Return ONLY valid JSON, no markdown or explanations`
}

/**
 * Process an invoice image and extract relevant data
 * Requires either OpenAI or OpenRouter API key to be configured
 */
export async function processInvoiceImage(
  file: File,
  settings: OCRSettings,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRInvoiceResult> {
  const { provider, model, openaiApiKey, openrouterApiKey } = settings

  console.log(`🔍 Starting OCR with provider: ${provider}, model: ${model}`)

  // Route to the appropriate processor
  if (provider === 'openai') {
    if (!openaiApiKey) {
      console.warn('⚠️ OpenAI requested but no API key, trying OpenRouter...')
      // Try OpenRouter as fallback
      if (openrouterApiKey) {
        return processWithOpenRouter(file, openrouterApiKey, 'google/gemini-2.0-flash', onProgress)
      }
      throw new Error('No API key configured. Please add your OpenAI or OpenRouter API key in Settings to use OCR scanning.')
    }
    return processWithOpenAI(file, openaiApiKey, model, onProgress)
  }

  if (provider === 'openrouter') {
    if (!openrouterApiKey) {
      console.warn('⚠️ OpenRouter requested but no API key, trying OpenAI...')
      // Try OpenAI as fallback
      if (openaiApiKey) {
        return processWithOpenAI(file, openaiApiKey, 'openai/gpt-4o-mini', onProgress)
      }
      throw new Error('No API key configured. Please add your OpenAI or OpenRouter API key in Settings to use OCR scanning.')
    }
    return processWithOpenRouter(file, openrouterApiKey, model, onProgress)
  }

  // No valid provider configured
  throw new Error('No API key configured. Please add your OpenAI or OpenRouter API key in Settings to use OCR scanning.')
}

/**
 * Process invoice using OpenAI Vision API (direct)
 * With timeout to prevent hanging
 */
async function processWithOpenAI(
  file: File,
  apiKey: string,
  model: OCRModel,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRInvoiceResult> {
  console.log('🤖 Using OpenAI Vision API')
  onProgress?.(10, 'Sending to OpenAI...')

  const OPENAI_TIMEOUT = 60000 // 60 seconds timeout for API calls

  try {
    const base64Image = await fileToBase64(file)
    onProgress?.(30, 'Processing with GPT-4o...')

    // Create fetch with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model.replace('openai/', ''), // Remove prefix for direct API
        messages: [
          { role: 'system', content: getInvoiceParserPrompt() },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Please extract all invoice data from this image.' },
              { type: 'image_url', image_url: { url: base64Image, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    onProgress?.(90, 'Parsing results...')
    const data = await response.json()
    onProgress?.(100, 'Done')
    return parseVisionResponse(data, 'openai', model)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI request timed out after 60 seconds')
    }
    console.error('OpenAI Vision OCR error:', error)
    throw error
  }
}

/**
 * Process invoice using OpenRouter API (supports Claude, GPT-4o, Gemini)
 * With timeout to prevent hanging
 */
async function processWithOpenRouter(
  file: File,
  apiKey: string,
  model: OCRModel,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRInvoiceResult> {
  console.log('🔀 Using OpenRouter API with model:', model)
  onProgress?.(10, 'Sending to OpenRouter...')

  const OPENROUTER_TIMEOUT = 60000 // 60 seconds timeout for API calls

  try {
    const base64Image = await fileToBase64(file)
    onProgress?.(30, 'Processing with AI...')

    // Get the correct model ID for OpenRouter
    const openrouterModelId = OPENROUTER_MODEL_IDS[model] || model

    // Create fetch with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT)

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Kitchen Compliance OCR',
      },
      body: JSON.stringify({
        model: openrouterModelId,
        messages: [
          { role: 'system', content: getInvoiceParserPrompt() },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Please extract all invoice data from this image.' },
              { type: 'image_url', image_url: { url: base64Image } },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenRouter API error:', error)
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
    }

    onProgress?.(90, 'Parsing results...')
    const data = await response.json()
    onProgress?.(100, 'Done')
    return parseVisionResponse(data, 'openrouter', model)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenRouter request timed out after 60 seconds')
    }
    console.error('OpenRouter OCR error:', error)
    throw error
  }
}

/**
 * Parse the response from vision APIs
 */
function parseVisionResponse(
  data: any,
  provider: OCRProvider,
  model: OCRModel
): OCRInvoiceResult {
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('No content in API response')
  }

  console.log('📄 Vision API Response:', content.substring(0, 500))

  // Parse JSON response
  let parsed: any
  try {
    // Remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim()
    parsed = JSON.parse(jsonStr)
  } catch (parseError) {
    console.error('JSON parse error:', parseError)
    // Try to extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      throw new Error('Could not parse JSON from response')
    }
  }

  // Transform items to include IDs
  const items = (parsed.items || []).map((item: any) => ({
    id: crypto.randomUUID(),
    name: item.name || 'Unknown Item',
    quantity: String(item.quantity || '1'),
    unit: normalizeUnit(item.unit || 'pcs'),
    temperature: undefined,
  }))

  console.log('✅ Extracted', items.length, 'items via', provider)

  return {
    supplier: parsed.supplier || null,
    invoiceNumber: parsed.invoiceNumber || null,
    invoiceDate: parsed.invoiceDate || null,
    items,
    rawText: parsed.rawText || content.substring(0, 500),
    confidence: 95, // Vision APIs are highly accurate
    provider,
    model,
  }
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
 * Check if a specific provider is available (has API key configured)
 */
export function isProviderAvailable(
  provider: OCRProvider,
  settings: { openaiApiKey: string | null; openrouterApiKey: string | null }
): boolean {
  if (provider === 'openai') return Boolean(settings.openaiApiKey)
  if (provider === 'openrouter') return Boolean(settings.openrouterApiKey)
  return false
}

/**
 * Check if any OCR provider is available
 */
export function isAnyOcrAvailable(
  settings: { openaiApiKey: string | null; openrouterApiKey: string | null }
): boolean {
  return Boolean(settings.openaiApiKey || settings.openrouterApiKey)
}
