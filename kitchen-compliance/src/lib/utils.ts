import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function formatTimeFromDate(date: Date): string {
  return date.toLocaleTimeString('en-IE', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  })
}

export function getTimeDifferenceMinutes(start: Date, end: Date = new Date()): number {
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
}

export function getTimeDifferenceSeconds(start: Date, end: Date = new Date()): number {
  return Math.floor((end.getTime() - start.getTime()) / 1000)
}

// Generate a unique ID for offline-first operations
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Cooling policy constants (in minutes)
export const COOLING_POLICY = {
  SOFT_LIMIT_MINUTES: 90,  // Warning at 90 minutes
  HARD_LIMIT_MINUTES: 120, // Critical at 120 minutes (2 hours)
} as const

export type CoolingStatus = 'active' | 'warning' | 'overdue' | 'closed' | 'discarded'

export function getCoolingStatus(startedAt: Date, closedAt?: Date): CoolingStatus {
  if (closedAt) return 'closed'
  
  const minutesElapsed = getTimeDifferenceMinutes(startedAt)
  
  if (minutesElapsed >= COOLING_POLICY.HARD_LIMIT_MINUTES) {
    return 'overdue'
  }
  if (minutesElapsed >= COOLING_POLICY.SOFT_LIMIT_MINUTES) {
    return 'warning'
  }
  return 'active'
}

export function getStatusColor(status: CoolingStatus): string {
  switch (status) {
    case 'active':
      return 'text-sky-400'
    case 'warning':
      return 'text-amber-400'
    case 'overdue':
      return 'text-red-400'
    case 'closed':
      return 'text-green-400'
    case 'discarded':
      return 'text-slate-400'
    default:
      return 'text-slate-400'
  }
}

export function getStatusBgColor(status: CoolingStatus): string {
  switch (status) {
    case 'active':
      return 'bg-sky-500/20'
    case 'warning':
      return 'bg-amber-500/20'
    case 'overdue':
      return 'bg-red-500/20'
    case 'closed':
      return 'bg-green-500/20'
    case 'discarded':
      return 'bg-slate-500/20'
    default:
      return 'bg-slate-500/20'
  }
}
