/**
 * Registra /sw.js (app instalable y que abre sin internet). Llamar solo en builds de
 * producción: en desarrollo un service worker guardaría archivos viejos y confundiría.
 * Si falla, la app sigue funcionando igual.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
  })
}
