import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'defaut' | 'heavy' | 'interactive' | 'alert';
  glow?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', glow = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          'relative overflow-hidden rounded-[var(--radius)] transition-all duration-300',
          'border',
          
          // Variants
          variant === 'default' && [
            'bg-[var(--bg-glass)] backdrop-blur-[var(--blur-md)]',
            'border-[var(--border-glass)]',
            'shadow-[var(--shadow-lg)]',
          ],
          variant === 'heavy' && [
            'bg-[var(--bg-glass-heavy)] backdrop-blur-[var(--blur-lg)]',
            'border-[var(--border-secondary)]',
            'shadow-[var(--shadow-xl)]',
          ],
          variant === 'interactive' && [
            'bg-[var(--bg-glass)] backdrop-blur-[var(--blur-sm)]',
            'border-[var(--border-glass)]',
            'hover:bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)]/30',
            'hover:shadow-[var(--shadow-glow)] hover:-translate-y-1',
            'cursor-pointer',
          ],
          variant === 'alert' && [
            'bg-red-500/10 backdrop-blur-[var(--blur-md)]',
            'border-red-500/20',
            'shadow-[var(--shadow-md)]',
          ],

          // Glow effect (optional)
          glow && 'after:absolute after:inset-0 after:rounded-[var(--radius)] after:shadow-[inset_0_0_20px_rgba(255,255,255,0.2)] after:pointer-events-none',

          className
        )}
        {...props}
      >
        {/* Shine effect on hover for interactive cards */}
        {variant === 'interactive' && (
          <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-tr from-white/0 via-white/5 to-white/0" />
        )}
        
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
