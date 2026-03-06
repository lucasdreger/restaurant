import { describe, it, expect, beforeEach } from 'vitest'
import { processInvoiceImage } from '../ocrService'

// Mock fetch for API calls
// setup.ts already enables fetch mocks

describe('ocrService', () => {
    beforeEach(() => {
        fetchMock.resetMocks()
    })

    it('should process invoice via the ai-proxy Edge Function', async () => {
        const mockFile = new File(['test'], 'invoice.jpg', { type: 'image/jpeg' })

        fetchMock.mockResponseOnce(
            JSON.stringify({
                supplier: 'Test Coop',
                invoiceNumber: 'INV-123',
                invoiceDate: '2026-01-01',
                items: [{ name: 'Tomato', quantity: '10', unit: 'kg' }],
                rawText: 'Test invoice',
                confidence: 95,
                provider: 'openrouter',
                model: 'google/gemini-2.0-flash',
            })
        )

        const result = await processInvoiceImage(mockFile, 'test-site')

        expect(result.supplier).toBe('Test Coop')
        expect(result.items).toHaveLength(1)
        expect(result.items[0].name).toBe('Tomato')
        expect(fetchMock).toHaveBeenCalled()
    })

    it('should handle empty items response', async () => {
        const mockFile = new File(['test'], 'invoice.jpg', { type: 'image/jpeg' })

        fetchMock.mockResponseOnce(
            JSON.stringify({
                supplier: 'Supplier X',
                invoiceNumber: 'OA-1',
                items: [],
                rawText: '',
                confidence: 80,
                provider: 'openrouter',
                model: 'google/gemini-2.0-flash',
            })
        )

        const result = await processInvoiceImage(mockFile, 'test-site')
        expect(result.supplier).toBe('Supplier X')
        expect(result.items).toHaveLength(0)
    })
})
