/**
 * OCR Service for Invoice Processing
 * Supports multiple providers:
 * - OpenAI GPT-4o Vision (direct API)
 * - OpenRouter (Claude, GPT-4o, Gemini via OpenRouter)
 * - Tesseract.js (free, local)
 */

import Tesseract from 'tesseract.js'
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
  'google/gemini-2.0-flash': { name: 'Gemini 2.0 Flash', provider: 'openrouter', price: '$0.10/1M tokens', badge: 'Cheap' },
  'google/gemini-flash-1.5': { name: 'Gemini 1.5 Flash', provider: 'openrouter', price: '$0.075/1M tokens' },
  'tesseract': { name: 'Tesseract.js', provider: 'tesseract', price: 'Free', badge: 'Free' },
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
 */
export async function processInvoiceImage(
  file: File, 
  settings: OCRSettings,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRInvoiceResult> {
  const { provider, model, openaiApiKey, openrouterApiKey } = settings
  
  console.log(`🔍 Starting OCR with provider: ${provider}, model: ${model}`)
  
  // Route to the appropriate processor
  if (provider === 'tesseract' || model === 'tesseract') {
    return processWithTesseract(file, onProgress)
  }
  
  if (provider === 'openai') {
    if (!openaiApiKey) {
      console.warn('⚠️ OpenAI requested but no API key, falling back to Tesseract')
      return processWithTesseract(file, onProgress)
    }
    return processWithOpenAI(file, openaiApiKey, model)
  }
  
  if (provider === 'openrouter') {
    if (!openrouterApiKey) {
      console.warn('⚠️ OpenRouter requested but no API key, falling back to Tesseract')
      return processWithTesseract(file, onProgress)
    }
    return processWithOpenRouter(file, openrouterApiKey, model)
  }
  
  // Default fallback
  return processWithTesseract(file, onProgress)
}

/**
 * Process invoice using OpenAI Vision API (direct)
 */
async function processWithOpenAI(
  file: File, 
  apiKey: string,
  model: OCRModel
): Promise<OCRInvoiceResult> {
  console.log('🤖 Using OpenAI Vision API')
  
  try {
    const base64Image = await fileToBase64(file)
    
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
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return parseVisionResponse(data, 'openai', model)
  } catch (error) {
    console.error('OpenAI Vision OCR error:', error)
    throw error
  }
}

/**
 * Process invoice using OpenRouter API (supports Claude, GPT-4o, Gemini)
 */
async function processWithOpenRouter(
  file: File, 
  apiKey: string,
  model: OCRModel
): Promise<OCRInvoiceResult> {
  console.log('🔀 Using OpenRouter API with model:', model)
  
  try {
    const base64Image = await fileToBase64(file)
    
    // Get the correct model ID for OpenRouter
    const openrouterModelId = OPENROUTER_MODEL_IDS[model] || model
    
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
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenRouter API error:', error)
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return parseVisionResponse(data, 'openrouter', model)
  } catch (error) {
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
 * Process invoice using Tesseract.js (free, local processing)
 */
async function processWithTesseract(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRInvoiceResult> {
  console.log('📝 Using Tesseract.js (free) for OCR')
  
  try {
    const imageUrl = URL.createObjectURL(file)
    
    const result = await Tesseract.recognize(imageUrl, 'eng', {
      logger: (info) => {
        if (info.status === 'recognizing text') {
          const progress = Math.round(info.progress * 100)
          onProgress?.(progress, 'Recognizing text...')
        } else if (info.status === 'loading tesseract core') {
          onProgress?.(5, 'Loading OCR engine...')
        } else if (info.status === 'initializing tesseract') {
          onProgress?.(10, 'Initializing...')
        } else if (info.status === 'loading language traineddata') {
          onProgress?.(20, 'Loading language data...')
        } else if (info.status === 'initializing api') {
          onProgress?.(30, 'Preparing...')
        }
      },
    })
    
    URL.revokeObjectURL(imageUrl)
    
    const rawText = result.data.text
    const parsed = parseInvoiceText(rawText)
    
    console.log('✅ Tesseract extracted', parsed.items.length, 'items')
    
    return {
      ...parsed,
      rawText,
      confidence: Math.round(result.data.confidence),
      provider: 'tesseract',
      model: 'tesseract',
    }
  } catch (error) {
    console.error('Tesseract OCR error:', error)
    throw error
  }
}

/**
 * Parse raw OCR text to extract invoice data (for Tesseract)
 */
function parseInvoiceText(text: string): Omit<OCRInvoiceResult, 'rawText' | 'confidence' | 'provider' | 'model'> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  
  let supplier: string | null = null
  let invoiceNumber: string | null = null
  let invoiceDate: string | null = null
  const items: OCRInvoiceResult['items'] = []
  
  // Common patterns for invoice data
  const invoiceNumberPatterns = [
    /invoice\s*#?\s*:?\s*(\w+[-/]?\w+)/i,
    /inv\s*#?\s*:?\s*(\w+[-/]?\w+)/i,
    /delivery\s*note\s*#?\s*:?\s*(\w+[-/]?\w+)/i,
    /order\s*#?\s*:?\s*(\w+[-/]?\w+)/i,
    /#\s*(\d{4,})/i,
  ]
  
  const datePatterns = [
    /date\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
    /(\d{2,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
  ]
  
  // Pattern to match line items
  const itemPatterns = [
    /(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pcs|box|case|ea|each|unit|pc)s?\s+(.+)/i,
    /(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pcs|box|case|ea|each|unit|pc)s?/i,
    /(\d+(?:\.\d+)?)\s*x\s*(.+)/i,
  ]
  
  // Find supplier
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i]
    if (line.length > 3 && !line.match(/^\d/) && !line.match(/tel|phone|fax|email|www\.|@/i)) {
      if (!supplier && line.length < 50) {
        supplier = line
        break
      }
    }
  }
  
  // Search for invoice number and date
  for (const line of lines) {
    if (!invoiceNumber) {
      for (const pattern of invoiceNumberPatterns) {
        const match = line.match(pattern)
        if (match) {
          invoiceNumber = match[1]
          break
        }
      }
    }
    
    if (!invoiceDate) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern)
        if (match) {
          invoiceDate = normalizeDate(match[1])
          break
        }
      }
    }
  }
  
  // Extract line items
  for (const line of lines) {
    for (const pattern of itemPatterns) {
      const match = line.match(pattern)
      if (match) {
        let name: string, quantity: string, unit: string
        
        if (match[3] && match[3].length > 2) {
          quantity = match[1]
          unit = match[2]
          name = match[3]
        } else if (match[2] && !isNaN(parseFloat(match[2]))) {
          name = match[1]
          quantity = match[2]
          unit = match[3] || 'pcs'
        } else {
          quantity = match[1]
          name = match[2]
          unit = 'pcs'
        }
        
        name = name.replace(/[\$€£]\s*\d+[\.,]\d+/g, '').trim()
        name = name.replace(/^\W+|\W+$/g, '').trim()
        
        if (name.length > 2 && !name.match(/total|subtotal|vat|tax|delivery|shipping/i)) {
          items.push({
            id: crypto.randomUUID(),
            name,
            quantity,
            unit: normalizeUnit(unit),
          })
        }
        break
      }
    }
  }
  
  // Fallback: extract product-like words
  if (items.length === 0) {
    const productWords = text.match(/\b[A-Za-z]{3,}\s+[A-Za-z]{3,}\b/g)
    if (productWords) {
      const seen = new Set<string>()
      for (const word of productWords.slice(0, 10)) {
        const clean = word.toLowerCase()
        if (!seen.has(clean) && !clean.match(/invoice|delivery|address|phone|email|date|total/)) {
          seen.add(clean)
          items.push({
            id: crypto.randomUUID(),
            name: word,
            quantity: '1',
            unit: 'pcs',
          })
        }
      }
    }
  }
  
  return {
    supplier,
    invoiceNumber,
    invoiceDate,
    items: items.slice(0, 50),
  }
}

/**
 * Normalize date string to YYYY-MM-DD format
 */
function normalizeDate(dateStr: string): string {
  const parts = dateStr.split(/[\/\-\.]/)
  if (parts.length !== 3) return dateStr
  
  let [a, b, c] = parts.map(p => parseInt(p, 10))
  
  if (a > 1900) {
    return `${a}-${String(b).padStart(2, '0')}-${String(c).padStart(2, '0')}`
  } else if (c > 1900 || c > 31) {
    const year = c < 100 ? 2000 + c : c
    if (a > 12) {
      return `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
    } else if (b > 12) {
      return `${year}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
    } else {
      return `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
    }
  }
  
  return dateStr
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
 * Check if a specific provider is available
 */
export function isProviderAvailable(
  provider: OCRProvider, 
  settings: { openaiApiKey: string | null; openrouterApiKey: string | null }
): boolean {
  if (provider === 'tesseract') return true
  if (provider === 'openai') return Boolean(settings.openaiApiKey)
  if (provider === 'openrouter') return Boolean(settings.openrouterApiKey)
  return false
}
