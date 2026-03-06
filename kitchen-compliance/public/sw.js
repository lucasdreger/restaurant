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
