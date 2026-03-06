import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Service workers are currently disabled for reliability during active voice/auth work.
// Always unregister stale workers to avoid cached no-op fetch handlers and console noise.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister()
    })
  }).catch(() => {
    // Ignore cleanup errors.
  })

  // Optional future toggle to re-enable SW safely.
  if (import.meta.env.PROD && import.meta.env.VITE_ENABLE_SW === 'true') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        console.log('PWA service worker not available')
      })
    })
  }
}

createRoot(document.getElementById('root')!).render(
  <App />
)
