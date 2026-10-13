import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Página pública de turnos (turnos.neriva.net, D-049). Mismo proyecto de Supabase que
// el panel: en desarrollo lee apps/admin/.env.local; en el hosting, las VITE_* del entorno.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: '../admin',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5176, allowedHosts: ['.app.github.dev'] },
  preview: { allowedHosts: ['.app.github.dev'] },
})
