// Qué tipo de "Poner en mi pantalla de inicio" se le puede ofrecer a este teléfono.
// Lógica pura (solo mira el user agent) para poder probarla sin navegador.

/**
 * - `prompt`: el navegador avisa con `beforeinstallprompt` (Chrome/Edge/Samsung en Android).
 * - `ios-safari`: iPhone/iPad en Safari; no hay aviso, se explica Compartir → Agregar a inicio.
 * - `ios-other`: iPhone/iPad en Chrome, Firefox u otro; hay que abrir la tarjeta en Safari.
 * - `none`: nada que ofrecer (computadora, navegador sin soporte).
 */
export type InstallPlatform = 'prompt' | 'ios-safari' | 'ios-other' | 'none'

export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true
  // iPadOS se presenta como Mac; se distingue porque tiene pantalla táctil.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1
}

export function installPlatform(
  userAgent: string,
  { maxTouchPoints = 0, hasPrompt = false }: { maxTouchPoints?: number; hasPrompt?: boolean } = {},
): InstallPlatform {
  if (isIos(userAgent, maxTouchPoints)) {
    // CriOS = Chrome, FxiOS = Firefox, EdgiOS = Edge, OPiOS = Opera; GSA = app de Google.
    return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent) ? 'ios-other' : 'ios-safari'
  }
  return hasPrompt ? 'prompt' : 'none'
}
