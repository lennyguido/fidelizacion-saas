// Service worker mínimo: guarda la "cáscara" de la app (index.html, JS, CSS, ícono)
// para que se pueda abrir sin internet. NUNCA guarda datos: todo lo que va a
// Supabase (otro dominio) o a /rest, /auth, /storage, /functions, /realtime pasa
// directo a la red sin tocarlo.
//
// Mismo archivo en apps/admin/public y apps/client/public: si se cambia uno,
// cambiar el otro y subir VERSION (borra las copias viejas en los teléfonos).
// Para desinstalarlo, ver docs/PWA.md.
const VERSION = 'v1'
const CACHE = `app-shell-${VERSION}`
const NETWORK_ONLY = ['/rest/', '/auth/', '/storage/', '/functions/', '/realtime/']

async function precacheShell() {
  const cache = await caches.open(CACHE)
  const response = await fetch('/index.html', { cache: 'no-cache' })
  if (!response.ok) return
  const html = await response.clone().text()
  await cache.put('/index.html', response)
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
  await cache.addAll([...new Set([...assets, '/favicon.svg', '/manifest.webmanifest'])])
}

self.addEventListener('install', (event) => {
  // Si falla (sin red), se instala igual: la próxima visita vuelve a intentar.
  event.waitUntil(precacheShell().catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('app-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// Páginas: primero la red (siempre la versión nueva); sin red, la copia guardada.
async function networkFirstPage(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put('/index.html', response.clone())
    return response
  } catch {
    return (await cache.match('/index.html')) ?? Response.error()
  }
}

// Archivos de /assets: tienen un hash en el nombre y nunca cambian.
async function cacheFirstAsset(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

// Resto (ícono, manifest): red y, sin red, la copia guardada.
async function networkWithFallback(request) {
  try {
    return await fetch(request)
  } catch {
    return (await caches.match(request)) ?? Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // Supabase y cualquier otro dominio
  if (NETWORK_ONLY.some((prefix) => url.pathname.startsWith(prefix))) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstAsset(request))
  } else {
    event.respondWith(networkWithFallback(request))
  }
})
