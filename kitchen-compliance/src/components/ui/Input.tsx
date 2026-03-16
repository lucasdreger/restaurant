import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'input-stunning flex h-11 w-full rounded-xl border-theme-input bg-theme-input px-3 py-2 text-sm text-theme-primary shadow-theme-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-theme-muted focus-visible:border-theme-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--input-focus)/0.18)] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
