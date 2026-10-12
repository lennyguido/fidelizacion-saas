import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// App del cliente final (tarjeta digital). Usa el mismo proyecto de Supabase que
// el panel: en desarrollo lee las variables de apps/admin/.env.local para no duplicarlas.
// En el hosting no hay archivos .env (no se suben al repo): Vite toma las VITE_* del
// entorno del build, que además tienen prioridad sobre los archivos. Por eso el proyecto
// de la tarjeta en Cloudflare Pages tiene sus propias variables (docs/DEPLOY.md); el CI
// lo comprueba con scripts/check-deploy-build.sh.
export default defineConfig({
  // DEV_HTTPS=1 (npm run dev:celular): https con un certificado propio, para probar
  // la cámara y la instalación desde el celular en el WiFi de la casa.
  plugins: [react(), tailwindcss(), ...(process.env.DEV_HTTPS === '1' ? [basicSsl()] : [])],
  envDir: '../admin',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5174, allowedHosts: ['.app.github.dev'] },
  preview: { allowedHosts: ['.app.github.dev'] },
})
