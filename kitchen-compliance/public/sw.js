// Minimal service worker.
// Keep install/activate only; do not add a no-op fetch handler because Chromium
// treats it as overhead during navigation.

self.addEventListener('install', (event) => {
  // Activate immediately.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'ChefVoice Reminder', body: event.data.text() }
  }

  const {
    title = 'ChefVoice Reminder',
    body = 'A HACCP reminder is due.',
    url = '/',
  } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: title,
      data: { url },
      badge: '/favicon.ico',
      icon: '/favicon.ico',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => 'focus' in client)
      if (matchingClient) {
        matchingClient.navigate?.(targetUrl)
        return matchingClient.focus()
      }

      return self.clients.openWindow(targetUrl)
    }),
  )
})
