import { registerPushSubscription, removePushSubscription } from '@/services/haccpService'

const WEB_PUSH_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    Boolean(WEB_PUSH_PUBLIC_KEY)
  )
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export async function ensurePushSubscription({
  siteId,
  userId,
}: {
  siteId: string
  userId: string
}) {
  if (!isPushSupported()) return null

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return null

  const registration = await navigator.serviceWorker.register('/sw.js')
  const existingSubscription = await registration.pushManager.getSubscription()
  const subscription =
    existingSubscription ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY),
    }))

  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!subscription.endpoint || !p256dh || !auth) {
    return null
  }

  await registerPushSubscription({
    siteId,
    userId,
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    userAgent: navigator.userAgent,
  })

  return subscription
}

export async function unregisterPushSubscription() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return

  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  await removePushSubscription(subscription.endpoint)
  await subscription.unsubscribe()
}
