// Prende el panel (5173) y la tarjeta (5174) con https en la red de la casa, para
// probar desde el celular la cámara (escanear QR) y "Poner en mi pantalla de inicio".
// Uso: npm run dev:celular — el celular tiene que estar en el mismo WiFi.
import { spawn } from 'node:child_process'
import { networkInterfaces } from 'node:os'

const env = { ...process.env, DEV_HTTPS: '1' }
const apps = [
  ['apps/admin', '5173'],
  ['apps/client', '5174'],
]
for (const [cwd, port] of apps) {
  spawn('npx', ['vite', '--host', '--port', port, '--strictPort'], {
    cwd,
    env,
    stdio: 'inherit',
    shell: true,
  })
}

const ips = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal && i.address.startsWith('192.168.'))
  .map((i) => i.address)
for (const ip of ips) {
  console.log(`\nPanel:   https://${ip}:5173\nTarjeta: https://${ip}:5174\n`)
}
