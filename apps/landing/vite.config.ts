import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Página de venta de Neriva (neriva.net). Estática: no habla con Supabase.
// VITE_SALES_WHATSAPP = número al que llegan los pedidos de compra (docs/LANDING.md).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: { chunkSizeWarningLimit: 1200 },
  server: { port: 5175, allowedHosts: ['.app.github.dev'] },
  preview: { allowedHosts: ['.app.github.dev'] },
})
