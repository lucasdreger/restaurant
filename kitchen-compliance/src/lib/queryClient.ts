import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 60, // 1 hour
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Kiosk/admin workflows should not refetch aggressively just because the tab regains focus.
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
        },
    },
})
