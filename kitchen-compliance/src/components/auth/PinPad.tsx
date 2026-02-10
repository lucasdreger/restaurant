import { useState, useEffect } from 'react'
import { Delete, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PinPadProps {
    onSuccess: (pin: string) => void
    onCancel?: () => void
    error?: string | null
    isLoading?: boolean
    label?: string
}

export function PinPad({ onSuccess, onCancel, error, isLoading, label = "Enter Staff Code" }: PinPadProps) {
    const [pin, setPin] = useState('')

    const handleNumberClick = (num: number) => {
        if (pin.length < 4) {
            const newPin = pin + num.toString()
            setPin(newPin)
            if (newPin.length === 4) {
                // Auto-submit on 4th digit
                // Small delay to show the 4th dot
                setTimeout(() => onSuccess(newPin), 300)
            }
        }
    }

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1))
    }

    const handleClear = () => {
        setPin('')
    }

    // Handle keyboard input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isLoading) return

            if (e.key >= '0' && e.key <= '9') {
                handleNumberClick(parseInt(e.key))
            } else if (e.key === 'Backspace') {
                handleDelete()
            } else if (e.key === 'Escape' && onCancel) {
                onCancel()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [pin, isLoading, onCancel]) // Dependencies for pin length check inside handleNumberClick if it wasn't using closure

    return (
        <div className="flex flex-col items-center justify-center max-w-sm mx-auto p-6 animate-in zoom-in-95 duration-200">
            <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-sky-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-sky-500">
                    <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold mb-2">{label}</h2>
                <p className="text-theme-muted text-sm">Use your 4-digit Staff Code</p>
            </div>

            {/* PIN Dots */}
            <div className="flex gap-4 mb-8 justify-center">
                {[0, 1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-4 h-4 rounded-full transition-all duration-200",
                            i < pin.length
                                ? "bg-sky-500 scale-110"
                                : "bg-theme-ghost border border-theme-primary"
                        )}
                    />
                ))}
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-3 bg-red-500/10 text-red-500 rounded-lg text-sm font-medium animate-shake text-center w-full">
                    {error}
                </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-4 mb-6 w-full">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        onClick={() => handleNumberClick(num)}
                        disabled={isLoading}
                        className="h-16 rounded-2xl bg-theme-ghost border border-theme-primary text-2xl font-semibold hover:bg-theme-secondary transition-colors active:scale-95 disabled:opacity-50"
                    >
                        {num}
                    </button>
                ))}
                <button
                    onClick={handleClear}
                    disabled={isLoading || pin.length === 0}
                    className="h-16 rounded-2xl text-theme-muted hover:text-theme-primary hover:bg-theme-ghost transition-colors font-medium text-sm"
                >
                    CLEAR
                </button>
                <button
                    onClick={() => handleNumberClick(0)}
                    disabled={isLoading}
                    className="h-16 rounded-2xl bg-theme-ghost border border-theme-primary text-2xl font-semibold hover:bg-theme-secondary transition-colors active:scale-95 disabled:opacity-50"
                >
                    0
                </button>
                <button
                    onClick={handleDelete}
                    disabled={isLoading || pin.length === 0}
                    className="h-16 rounded-2xl text-theme-muted hover:text-red-500 hover:bg-red-500/5 transition-colors flex items-center justify-center"
                >
                    <Delete className="w-6 h-6" />
                </button>
            </div>

            {onCancel && (
                <button
                    onClick={onCancel}
                    className="text-theme-muted hover:text-theme-primary text-sm font-medium p-2"
                >
                    Cancel
                </button>
            )}
        </div>
    )
}
