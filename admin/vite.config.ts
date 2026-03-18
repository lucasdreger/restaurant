import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'admin-path-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/admin') {
            res.statusCode = 302
            res.setHeader('Location', '/admin/')
            res.end()
            return
          }

          next()
        })
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: command === 'serve' ? '/admin/' : '/restaurant/admin/',
  server: {
    host: true,
    port: 5174,
    strictPort: true,
  },
}))
