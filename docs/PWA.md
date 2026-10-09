# PWA: app instalable y apertura sin internet

Las dos apps (`apps/admin`, el panel, y `apps/client`, la tarjeta) se pueden "instalar"
en el teléfono como si fueran una app, y abren aunque no haya internet.

## Qué hay

* `public/manifest.webmanifest`: nombre, ícono y colores de la app instalada.
* `public/sw.js`: el *service worker*, un pequeño programa que el navegador guarda y que
  se pone en el medio de las descargas. Es el mismo archivo en las dos apps.
* `registerServiceWorker()` (`packages/ui`): lo registra **solo en producción**
  (`npm run build` + `npm run preview` o el hosting). En `npm run dev` no hay service worker.

## Qué guarda y qué no

| Pedido | Qué hace |
|---|---|
| Páginas (abrir la app) | Pide a la red; si no hay internet, usa la última copia de `index.html`. |
| `/assets/*` (JS y CSS con hash en el nombre) | Usa la copia guardada; si no está, la descarga y la guarda. |
| Ícono y manifest | Red; sin internet, la copia guardada. |
| Supabase (otro dominio), `/rest`, `/auth`, `/storage`, `/functions`, `/realtime` | **Nunca se guarda.** Pasa directo a la red. |

Los datos (clientes, puntos, visitas) siempre vienen de Supabase en el momento. Sin
internet la app abre, pero muestra el error de conexión en vez de datos viejos.

## Cambiar el service worker

1. Editar `apps/admin/public/sw.js` y copiar el mismo contenido a `apps/client/public/sw.js`.
2. Subir `VERSION` (por ejemplo de `v1` a `v2`): así los teléfonos borran la copia vieja.

## Desinstalarlo (si algo queda "pegado" en una versión vieja)

En un navegador:

1. Abrir la app, después las herramientas de desarrollo (F12).
2. Pestaña **Application** (Aplicación) → **Service workers** → **Unregister**.
3. En **Storage** → **Clear site data**, y recargar.

En un teléfono Android con Chrome: Configuración del sitio → Borrar datos y restablecer.

Para todos los usuarios a la vez (último recurso): reemplazar `public/sw.js` por esta
versión que se borra sola y publicar:

```js
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister()),
  )
})
```
