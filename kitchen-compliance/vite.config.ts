import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Dev: keep root base to avoid redirect loops.
  // Build: keep /restaurant for GitHub Pages deployment.
  base: command === 'serve' ? '/' : '/restaurant/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'restaurant-path-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url) {
            next()
            return
          }

          // Keep explicit app entrypoints on same host:
          // /restaurant for product app, /admin for admin app.
          if (req.url === '/') {
            res.statusCode = 302
            res.setHeader('Location', '/restaurant/')
            res.end()
            return
          }

          if (req.url === '/restaurant') {
            res.statusCode = 302
            res.setHeader('Location', '/restaurant/')
            res.end()
            return
          }

          // In dev, strip /restaurant prefix so Vite resolves the SPA at root.
          if (req.url.startsWith('/restaurant/')) {
            req.url = req.url.replace(/^\/restaurant/, '') || '/'
          }

          next()
        })
      },
    },
    // PWA disabled for now - icons need to be created first
    // To enable PWA:
    // 1. Create pwa-192x192.png and pwa-512x512.png in public/ folder
    // 2. Add vite-plugin-pwa back to plugins array
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: true, // Expõe para todos os IPs da rede
    port: 5173,  // Porta padrão (pode mudar se necessário)
    proxy: {
      '/admin': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Enable source maps for debugging in production (optional)
    sourcemap: false,
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Manual chunks for better code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunk - React essentials
          'vendor-react': ['react', 'react-dom'],
          // State management
          'vendor-state': ['zustand'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // UI utilities
          'vendor-ui': ['lucide-react'],
          // Heavy libraries loaded on-demand (PDF generation)
          'vendor-pdf': ['html2canvas', 'jspdf'],
        }
      }
    },
    // Increase chunk warning limit to 600KB
    chunkSizeWarningLimit: 600
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', '@supabase/supabase-js', 'lucide-react']
  }
}))
