import { useState, useEffect } from 'react'
import { useAppStoreShallow } from '@/store/useAppStore'
import { verifyPin } from '@/services/staffService'
import { toast } from 'sonner'
import type { Site } from '@/types'

export function useKiosk(currentSite: Site | null, isAuth: boolean) {
    const { kioskMode, kioskLocked, lockKiosk, unlockKiosk } = useAppStoreShallow((state) => ({
        kioskMode: state.kioskMode,
        kioskLocked: state.kioskLocked,
        lockKiosk: state.lockKiosk,
        unlockKiosk: state.unlockKiosk,
    }))
    const [pinError, setPinError] = useState<string | null>(null)
    const [pinLoading, setPinLoading] = useState(false)

    // Auto-lock on idle (5 minutes)
    useEffect(() => {
        if (!kioskMode || kioskLocked) return

        let timeout: NodeJS.Timeout
        const resetTimer = () => {
            clearTimeout(timeout)
            timeout = setTimeout(() => {
                console.log('🔒 Kiosk auto-lock triggered')
                lockKiosk()
            }, 5 * 60 * 1000) // 5 minutes
        }

        // Events to monitor
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
        events.forEach(e => document.addEventListener(e, resetTimer))

        resetTimer()

        return () => {
            clearTimeout(timeout)
            events.forEach(e => document.removeEventListener(e, resetTimer))
        }
    }, [kioskMode, kioskLocked, lockKiosk])

    const handlePinSubmit = async (pin: string) => {
        if (!currentSite?.id) return
        setPinLoading(true)
        setPinError(null)

        try {
            // Always verify server-side — PINs are hashed with bcrypt
            const verifiedStaff = await verifyPin(currentSite.id, pin)
            if (verifiedStaff) {
                unlockKiosk(verifiedStaff.id)
                toast.success(`Welcome back, ${verifiedStaff.name.split(' ')[0]}!`)
            } else {
                setPinError('Invalid PIN code')
            }
        } catch (err) {
            console.error('PIN verify error:', err)
            setPinError('Error verifying PIN')
        } finally {
            setPinLoading(false)
        }
    }

    // If in Kiosk Mode and Locked, show PinPad overlay
    // But ONLY if we are authenticated (or in demo mode) and have a site loaded
    const showPinPad = kioskMode && kioskLocked && isAuth && currentSite

    return {
        showPinPad,
        handlePinSubmit,
        pinError,
        pinLoading
    }
}
