import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD && import.meta.env.VITE_ENABLE_SW === 'true') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        console.log('PWA service worker not available')
      })
    })
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister()
        })
      })
      .catch(() => {
        // Ignore cleanup errors.
      })
  }
}

createRoot(document.getElementById('root')!).render(
  <App />
)
