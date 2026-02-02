import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive'
}

function Badge({ className, variant, ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
  
  const variants = {
    default: 'border-transparent bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 shadow hover:bg-zinc-900/80 dark:hover:bg-zinc-50/80',
    secondary: 'border-transparent bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80',
    destructive: 'border-transparent bg-red-500 text-red-50 shadow hover:bg-red-500/80',
    outline: 'text-zinc-900 dark:text-zinc-50 border-zinc-200 dark:border-zinc-700',
  }

  return (
    <div className={cn(baseStyles, variants[variant || 'default'], className)} {...props} />
  )
}

export { Badge }