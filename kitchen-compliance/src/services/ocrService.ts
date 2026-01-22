/**
 * OCR Service for Invoice Processing
 * Uses OpenAI Vision API (GPT-4o) for intelligent document extraction
 */

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
}

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY

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
 * Process an invoice image and extract relevant data using OpenAI Vision
 */
export async function processInvoiceImage(file: File): Promise<OCRInvoiceResult> {
  console.log('🔍 Starting OpenAI Vision OCR processing...')
  
  // Check for API key
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ OpenAI API key not found, falling back to basic extraction')
    return fallbackExtraction()
  }
  
  try {
    // Convert image to base64
    const base64Image = await fileToBase64(file)
    console.log('📸 Image converted to base64')
    
    // Call OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert invoice/delivery note parser for a restaurant kitchen. 
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
- Return ONLY valid JSON, no markdown or explanations`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract all invoice data from this image. Focus on supplier name, invoice number, date, and all line items with their quantities and units.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: base64Image,
                  detail: 'high',
                },
              },
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
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    console.log('📄 OpenAI Response:', content)

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

    console.log('✅ Extracted', items.length, 'items')

    return {
      supplier: parsed.supplier || null,
      invoiceNumber: parsed.invoiceNumber || null,
      invoiceDate: parsed.invoiceDate || null,
      items,
      rawText: parsed.rawText || content.substring(0, 500),
      confidence: 95, // GPT-4o is highly accurate
    }
  } catch (error) {
    console.error('OpenAI Vision OCR error:', error)
    throw error
  }
}

/**
 * Fallback extraction when API is not available
 */
function fallbackExtraction(): OCRInvoiceResult {
  return {
    supplier: null,
    invoiceNumber: null,
    invoiceDate: new Date().toISOString().split('T')[0],
    items: [],
    rawText: 'OpenAI API key not configured - please add VITE_OPENAI_API_KEY to .env file or enter data manually',
    confidence: 0,
  }
}

/**
 * Normalize unit strings
 */
function normalizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    'kilogram': 'kg',
    'kilograms': 'kg',
    'kilo': 'kg',
    'gram': 'g',
    'grams': 'g',
    'litre': 'l',
    'liter': 'l',
    'litres': 'l',
    'liters': 'l',
    'millilitre': 'ml',
    'milliliter': 'ml',
    'piece': 'pcs',
    'pieces': 'pcs',
    'pc': 'pcs',
    'each': 'pcs',
    'ea': 'pcs',
    'unit': 'pcs',
    'units': 'pcs',
    'case': 'box',
    'cases': 'box',
    'boxes': 'box',
  }
  
  const lower = (unit || 'pcs').toLowerCase().trim()
  return unitMap[lower] || lower
}
