import type { ReactNode } from 'react'
import { Sidebar, MobileNav } from './Sidebar'
import { useAppStore } from '@/store/useAppStore'

interface MainLayoutProps {
  children: ReactNode
  currentScreen: string
  onNavigate: (screen: string) => void
  /**
   * If true, content renders full-screen without sidebar on all breakpoints.
   * If false, sidebar shows on lg+ screens.
   */
  fullScreen?: boolean
}

/**
 * MainLayout provides consistent navigation across the app:
 * - Desktop (lg+): Sidebar always visible on left, content on right
 * - Tablet/Mobile: MobileNav at bottom, content full width
 */
export function MainLayout({ 
  children, 
  currentScreen, 
  onNavigate,
  fullScreen = false 
}: MainLayoutProps) {
  const { currentSite } = useAppStore()

  // Full screen mode - no sidebar at all (e.g., for onboarding, landing)
  if (fullScreen) {
    return (
      <div className="min-h-screen bg-theme-primary">
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-theme-primary flex">
      {/* Desktop Sidebar - Always visible on lg+ */}
      <Sidebar 
        currentScreen={currentScreen} 
        onNavigate={onNavigate}
        siteName={currentSite?.name || 'Kitchen Ops'}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        {/* Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Mobile Navigation - Only visible on mobile/tablet */}
      <MobileNav currentScreen={currentScreen} onNavigate={onNavigate} />
    </div>
  )
}
