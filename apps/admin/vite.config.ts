import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // DEV_HTTPS=1 (npm run dev:celular): https con un certificado propio, para probar
  // la cámara y la instalación desde el celular en el WiFi de la casa.
  plugins: [react(), tailwindcss(), ...(process.env.DEV_HTTPS === '1' ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Vite bloquea por seguridad los dominios que no conoce. Codespaces sirve el
  // panel en https://<nombre>-5173.app.github.dev: hay que permitirlo.
  server: { allowedHosts: ['.app.github.dev'] },
  preview: { allowedHosts: ['.app.github.dev'] },
})
