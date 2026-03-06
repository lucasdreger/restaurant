import { useState, useEffect } from 'react'
import { clearKitchenComplianceAppStorage } from '@/lib/appStorage'

export const LoadingScreen = () => {
    const [showEscape, setShowEscape] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setShowEscape(true), 5000)
        return () => clearTimeout(timer)
    }, [])

    return (
        <div className="min-h-screen bg-theme-primary flex flex-col items-center justify-center p-4">
            <div className="text-center mb-8">
                <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-theme-muted text-sm animate-pulse">Loading Kitchen Compliance...</p>
            </div>

            {showEscape && (
                <div className="animate-fade-in text-center">
                    <p className="text-xs text-theme-muted mb-3">Taking longer than expected?</p>
                    <button
                        onClick={async () => {
                            // Keep this safe: do not wipe Supabase auth tokens or remembered email.
                            // A reload is often enough to recover from a transient chunk/network issue.
                            window.location.reload()
                        }}
                        className="px-4 py-2 bg-theme-bg border border-theme-primary rounded-lg text-theme-muted text-xs hover:text-theme-primary transition-colors"
                    >
                        Reload Application
                    </button>

                    <button
                        onClick={() => {
                            // Optional escape hatch: clears only app UI/cache state.
                            // Does NOT clear Supabase auth or remembered email.
                            clearKitchenComplianceAppStorage()
                            window.location.reload()
                        }}
                        className="mt-2 block mx-auto text-[11px] text-theme-muted hover:text-theme-primary underline decoration-theme-secondary hover:decoration-theme-primary underline-offset-4"
                    >
                        Reset app UI/cache
                    </button>
                </div>
            )}
        </div>
    )
}
