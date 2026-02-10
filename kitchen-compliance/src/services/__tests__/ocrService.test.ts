import { describe, it, expect, beforeEach } from 'vitest'
import { processInvoiceImage } from '../ocrService'

// Mock fetch for API calls
// setup.ts already enables fetch mocks

describe('ocrService', () => {
    beforeEach(() => {
        fetchMock.resetMocks()
    })

    it('should process invoice using OpenRouter', async () => {
        const mockFile = new File(['test'], 'invoice.jpg', { type: 'image/jpeg' })
        const mockSettings = {
            provider: 'openrouter' as const,
            model: 'google/gemini-2.0-flash' as const,
            openaiApiKey: null,
            openrouterApiKey: 'test-key'
        }

        fetchMock.mockResponseOnce(JSON.stringify({
            choices: [{
                message: {
                    content: JSON.stringify({
                        supplier: 'Test Coop',
                        invoiceNumber: 'INV-123',
                        invoiceDate: '2026-01-01',
                        items: [{ name: 'Tomato', quantity: '10', unit: 'kg' }],
                        rawText: 'Test invoice'
                    })
                }
            }]
        }))

        const result = await processInvoiceImage(mockFile, mockSettings)

        expect(result.supplier).toBe('Test Coop')
        expect(result.items).toHaveLength(1)
        expect(result.items[0].name).toBe('Tomato')
        expect(fetchMock).toHaveBeenCalled()
    })

    it('should fallback to OpenAI if OpenRouter key is missing', async () => {
        const mockFile = new File(['test'], 'invoice.jpg', { type: 'image/jpeg' })
        const mockSettings = {
            provider: 'openrouter' as const,
            model: 'google/gemini-2.0-flash' as const,
            openaiApiKey: 'openai-key',
            openrouterApiKey: null
        }

        fetchMock.mockResponseOnce(JSON.stringify({
            choices: [{
                message: {
                    content: JSON.stringify({
                        supplier: 'OpenAI Supplier',
                        invoiceNumber: 'OA-1',
                        items: []
                    })
                }
            }]
        }))

        const result = await processInvoiceImage(mockFile, mockSettings)
        expect(result.supplier).toBe('OpenAI Supplier')
    })
})
