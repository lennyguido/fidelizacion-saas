import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// App del cliente final (tarjeta digital). Usa el mismo proyecto de Supabase que
// el panel: lee las variables de apps/admin/.env.local para no duplicarlas.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: '../admin',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5174, allowedHosts: ['.app.github.dev'] },
  preview: { allowedHosts: ['.app.github.dev'] },
})
