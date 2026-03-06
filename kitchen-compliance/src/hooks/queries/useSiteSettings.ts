import { useQuery } from '@tanstack/react-query'
import { getSiteSettings } from '@/services/settingsService'

export const SETTINGS_KEYS = {
    site: (siteId: string | undefined) => ['settings', 'site', siteId] as const,
}

export function useSiteSettings(siteId: string | undefined) {
    return useQuery({
        queryKey: SETTINGS_KEYS.site(siteId),
        queryFn: async () => {
            if (!siteId) return null
            return getSiteSettings(siteId)
        },
        enabled: !!siteId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    })
}
