/**
 * Dirección de la app del cliente (tarjeta digital).
 * 1. VITE_CLIENT_APP_URL si está configurada (producción).
 * 2. En desarrollo, el mismo host con el puerto 5174 (local y Codespaces).
 */
export function clientAppUrl(env: Record<string, unknown>, location: Location): string {
  const configured = env.VITE_CLIENT_APP_URL
  if (typeof configured === 'string' && configured !== '') return configured.replace(/\/$/, '')
  const codespace = location.host.match(/^(.*)-\d+(\.app\.github\.dev)$/)
  if (codespace) return `${location.protocol}//${codespace[1]}-5174${codespace[2]}`
  return `${location.protocol}//${location.hostname}:5174`
}

/** Link de WhatsApp con un mensaje armado (lo envía la persona desde su WhatsApp). */
export function whatsappLink(phoneE164: string | null, text: string): string {
  const digits = phoneE164?.replace(/\D/g, '') ?? ''
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
