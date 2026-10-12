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

## Botón "Poner en mi pantalla de inicio" (tarjeta del cliente)

Está en `apps/client/src/install/` (D-034).

| Teléfono | Qué ve el cliente |
|---|---|
| Android (Chrome, Edge, Samsung) | El botón abre el aviso del navegador para instalar. |
| iPhone / iPad con Safari | Una hoja con 2 pasos: Compartir → Agregar a inicio. |
| iPhone con Chrome, Firefox, etc. | "Abrí la tarjeta en Safari" (Apple solo deja instalar desde Safari). |
| Computadora, o ya instalada | No aparece nada. |

"Ahora no" lo esconde para siempre en ese teléfono (se guarda en el navegador).

**iPhone y el link secreto:** la app instalada en iPhone no ve lo que guardó Safari. Por eso,
mientras se muestran los pasos, el link secreto de la tarjeta vuelve a la barra de
direcciones: el ícono queda guardado con ese link y abre la tarjeta directo.
Para probarlo en un iPhone real:

1. Abrir el link de una tarjeta en Safari.
2. Tocar "Poner en mi pantalla de inicio" y seguir los 2 pasos.
3. Abrir el ícono nuevo: tiene que aparecer la tarjeta (no la pantalla "No encontramos tu tarjeta").

## Probar desde el celular (cámara e instalación)

El celular solo deja usar la cámara e instalar la app en direcciones `https://`. Para probar en el WiFi de la casa:

1. Correr `npm run dev:celular` (prende el panel y la tarjeta con un certificado propio).
2. Abrir en el celular la dirección que muestra (por ejemplo `https://192.168.1.9:5173`).
3. El celular avisa que la conexión "no es privada" (el certificado es casero): tocar **Avanzado → Continuar** (o "Ver detalles → visitar este sitio" en iPhone). Hacerlo una vez en el puerto 5173 y otra en el 5174.
