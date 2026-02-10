import '@testing-library/jest-dom'
import { vi } from 'vitest'
import createFetchMock from 'vitest-fetch-mock'

const fetchMocker = createFetchMock(vi)
fetchMocker.enableMocks()

// Mock crypto.randomUUID
if (!global.crypto) {
    (global as any).crypto = {
        randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 11)
    }
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
})

// Mock Supabase to avoid real network calls in unit tests
vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
        })),
        storage: {
            from: vi.fn(() => ({
                upload: vi.fn().mockResolvedValue({ data: { path: 'test' }, error: null }),
                getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://test.com' } })),
            }))
        }
    }
}))
