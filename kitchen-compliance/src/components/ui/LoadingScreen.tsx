import { useEffect, useMemo, useState } from 'react'
import { ChefHat, LockKeyhole, Radio, ShieldCheck, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type LoadingVariant = 'auth' | 'dashboard' | 'screen' | 'onboarding' | 'kiosk'

type LoadingScreenProps = {
  variant?: LoadingVariant
  label?: string
}

type LoadingConfig = {
  eyebrow: string
  title: string
  description: string
  stages: string[]
  tips: string[]
  accentClassName: string
  icon: typeof Sparkles
}

const ESCAPE_REVEAL_MS = 7000
const STAGE_ADVANCE_MS = 2400
const TIP_ROTATION_MS = 3600

function formatElapsedLabel(elapsedMs: number) {
  if (elapsedMs < 1000) return 'Just now'

  const seconds = Math.floor(elapsedMs / 1000)
  return `${seconds}s elapsed`
}

function getLoadingConfig(variant: LoadingVariant, label?: string): LoadingConfig {
  switch (variant) {
    case 'auth':
      return {
        eyebrow: 'Restoring Session',
        title: 'Preparing your kitchen',
        description: label
          ? `Checking access and restoring ${label}.`
          : 'Checking access, venue context, and saved workspace settings.',
        stages: ['Verifying account', 'Restoring venue context', 'Warming live dashboard'],
        tips: [
          'Warm loads should feel faster after the first restart.',
          'Your venue and voice settings are restored before the command center opens.',
          'If this stalls, reload first before resetting local UI cache.',
        ],
        accentClassName: 'from-teal-500/20 via-emerald-500/15 to-cyan-500/10 border-teal-500/20 text-teal-600',
        icon: ShieldCheck,
      }
    case 'onboarding':
      return {
        eyebrow: 'Setting Up',
        title: 'Preparing your onboarding',
        description: 'Loading the questions and defaults needed to finish setup cleanly.',
        stages: ['Loading profile', 'Preparing defaults', 'Opening setup flow'],
        tips: [
          'This only happens on first setup or when onboarding is incomplete.',
          'Nothing is submitted until you finish the onboarding flow.',
          'If you get sent back here repeatedly, the profile check is the next thing to inspect.',
        ],
        accentClassName: 'from-indigo-500/20 via-sky-500/15 to-cyan-500/10 border-indigo-500/20 text-indigo-600',
        icon: Sparkles,
      }
    case 'kiosk':
      return {
        eyebrow: 'Secure Access',
        title: label ? `Opening ${label}` : 'Opening secure kiosk access',
        description: 'Preparing the PIN pad and secure session controls for this device.',
        stages: ['Checking local lock state', 'Loading PIN pad', 'Securing the session'],
        tips: [
          'Kiosk mode always waits for the secure lock state before showing access controls.',
          'If this device was left in kiosk mode, the last lock state may need one reload.',
          'The PIN pad loads separately so the main dashboard can stay lighter.',
        ],
        accentClassName: 'from-amber-500/20 via-orange-500/15 to-red-500/10 border-amber-500/20 text-amber-600',
        icon: LockKeyhole,
      }
    case 'screen':
      return {
        eyebrow: 'Opening Workspace',
        title: label ? `Opening ${label}` : 'Opening your workspace',
        description: 'Loading the next screen and its tools without blocking the whole app shell.',
        stages: ['Loading screen', 'Warming tools', 'Finalizing view'],
        tips: [
          'Large screens are loaded separately so the command center can open sooner.',
          'Reports, receipts, and exports are intentionally deferred until needed.',
          'If one screen is consistently slow, that route is where the next profiling pass should focus.',
        ],
        accentClassName: 'from-sky-500/20 via-cyan-500/15 to-teal-500/10 border-sky-500/20 text-sky-600',
        icon: Radio,
      }
    case 'dashboard':
    default:
      return {
        eyebrow: 'Command Center',
        title: 'Opening the kitchen floor',
        description: 'Restoring live workflows, alerts, and voice-ready controls for the current venue.',
        stages: ['Loading dashboard shell', 'Syncing workflows', 'Preparing voice and controls'],
        tips: [
          'The dashboard is split into smaller chunks so it can open before secondary screens.',
          'Voice tools and HACCP dialogs load after the command center shell.',
          'If this is still slow after a restart, the remaining bottleneck is in the authenticated startup path.',
        ],
        accentClassName: 'from-emerald-500/20 via-teal-500/15 to-sky-500/10 border-emerald-500/20 text-emerald-600',
        icon: ChefHat,
      }
  }
}

export const LoadingScreen = ({ variant = 'dashboard', label }: LoadingScreenProps) => {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [showEscape, setShowEscape] = useState(false)

  useEffect(() => {
    const start = Date.now()
    const intervalId = window.setInterval(() => {
      setElapsedMs(Date.now() - start)
    }, 250)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setShowEscape(true), ESCAPE_REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const config = useMemo(() => getLoadingConfig(variant, label), [label, variant])
  const activeStageIndex = Math.min(config.stages.length - 1, Math.floor(elapsedMs / STAGE_ADVANCE_MS))
  const currentTip = config.tips[Math.floor(elapsedMs / TIP_ROTATION_MS) % config.tips.length]
  const AccentIcon = config.icon

  return (
    <div className="min-h-screen bg-theme-primary flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-[28px] border border-theme-primary/60 bg-glass-heavy p-6 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl">
        <div className={cn('rounded-2xl border bg-gradient-to-br p-5', config.accentClassName)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-current/80">
                {config.eyebrow}
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-theme-primary">{config.title}</h1>
              <p className="mt-2 max-w-md text-sm text-theme-secondary">{config.description}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 shadow-sm dark:bg-slate-950/25">
              <AccentIcon className="h-5 w-5 text-current" />
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/55 dark:bg-slate-950/20">
            <div className="h-full w-1/3 rounded-full bg-current/80 animate-pulse" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {config.stages.map((stage, index) => {
            const isComplete = index < activeStageIndex
            const isActive = index === activeStageIndex

            return (
              <div
                key={stage}
                className={cn(
                  'rounded-2xl border px-4 py-3 transition-all duration-300',
                  isComplete && 'border-emerald-500/30 bg-emerald-500/10',
                  isActive && 'border-theme-focus/40 bg-theme-secondary shadow-theme-sm',
                  !isComplete && !isActive && 'border-theme-primary/50 bg-theme-bg/65',
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                      isComplete && 'bg-emerald-500 text-white',
                      isActive && 'bg-theme-focus text-white',
                      !isComplete && !isActive && 'bg-theme-ghost text-theme-muted',
                    )}
                  >
                    {isComplete ? '✓' : index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-theme-primary">{stage}</p>
                    <p className="text-[11px] text-theme-muted">
                      {isComplete ? 'Done' : isActive ? 'In progress' : 'Queued'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-theme-primary/50 bg-theme-bg/75 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">Current update</p>
            <p className="mt-1 text-sm text-theme-primary">{currentTip}</p>
          </div>
          <div className="rounded-full border border-theme-primary/60 bg-theme-secondary px-3 py-1 text-xs font-semibold text-theme-secondary">
            {formatElapsedLabel(elapsedMs)}
          </div>
        </div>

        {showEscape && (
          <div className="mt-5 animate-fade-in rounded-2xl border border-theme-primary/50 bg-theme-bg/70 px-4 py-4 text-center">
            <p className="text-sm font-medium text-theme-primary">Still taking longer than it should?</p>
            <p className="mt-1 text-xs text-theme-muted">
              Try a normal reload first. Resetting the local UI cache is the fallback if the shell is stuck.
            </p>

            <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <button
                onClick={() => {
                  window.location.reload()
                }}
                className="min-w-44 rounded-full border border-theme-primary bg-theme-secondary px-4 py-2 text-sm font-medium text-theme-primary transition-colors hover:bg-theme-ghost"
              >
                Reload Application
              </button>

              <button
                onClick={async () => {
                  const { clearKitchenComplianceAppStorage } = await import('@/lib/appStorage')
                  clearKitchenComplianceAppStorage()
                  window.location.reload()
                }}
                className="min-w-44 rounded-full px-4 py-2 text-sm font-medium text-theme-muted underline decoration-theme-secondary underline-offset-4 transition-colors hover:text-theme-primary hover:decoration-theme-primary"
              >
                Reset app UI/cache
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
