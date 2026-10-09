# Guía para probar el mostrador (paso a paso)

Objetivo: comprobar con tus propios ojos que el panel funciona conectado a tu Supabase de **desarrollo** (el de prueba, no el de clientes reales).

## Antes de empezar (una sola vez)

1. En Supabase, arriba a la izquierda dice **fidelizacion-saas**. Si dice otra cosa, cambiá de proyecto.
2. **Project Settings → Data API → Exposed schemas**: tiene que estar `core`.
3. **Authentication → URL Configuration → Redirect URLs**: tienen que estar `http://localhost:5173/**` y `https://*.app.github.dev/**`.
4. Si el mail de confirmación te lleva a una página que no carga (por ejemplo `localhost:3000`), es porque falta el paso 3: agregá las URLs y pedí otro mail desde "Crear cuenta".

## Levantar el panel

1. En GitHub, abrí tu Codespace (botón verde **Code → Codespaces**).
2. En la terminal: `git checkout main` y `git pull` (si da error por "local changes", primero `git stash`). Después `npm install`.
3. Revisá que exista el archivo `apps/admin/.env.local` (con el punto entre `env` y `local`).
4. En la terminal: `npm run dev`
5. Tocá **Open in Browser** cuando aparezca.

## Probar (anotá ✅ o ❌ en cada paso)

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| 1 | Entrar al panel | Te manda a "Ingresá a tu negocio" |
| 2 | "Crear cuenta" con tu email y una contraseña de 8+ letras | Dice "Revisá tu email" |
| 3 | Abrir el mail y tocar el link | Volvés al panel, en "Creá tu negocio" |
| 4 | Escribir el nombre "Café Prueba" | Abajo dice "Disponible" |
| 5 | Tocar "Crear negocio" | Ves "Café Prueba", "Dueño" y "Tus clientes" en 0 |
| 6 | Tocar "Registrar una visita" → buscar "Juan" → "+ Cliente nuevo" → monto 5.000 → "Guardar y registrar visita" | Aparece "Visita de Juan registrada ($ 5.000)" |
| 7 | Buscar "Juan" de nuevo y tocar "+1" enseguida | Dice "Esta visita ya se registró hace un momento" (protección contra doble carga) |
| 8 | Tocar "+ Visita sin identificar" | Dice "Visita registrada" |
| 9 | Ir a "Clientes" y abrir a Juan | 1 visita, $ 5.000 en total |
| 10 | En la ficha de Juan, "Anular" una visita escribiendo un motivo | La visita aparece tachada y el total vuelve a $ 0 |
| 11 | Tocar "Salir" | Volvés a "Ingresá a tu negocio" |
| 12 | Ingresar con el mismo email y contraseña → "Ingresar" | Entrás directo a "Café Prueba" (login ✅) |
| 13 | Ingresar con una contraseña equivocada | Dice "Email o contraseña incorrectos" |
| 14 | "Clientes" → "Nuevo cliente" → nombre "Ana Prueba" → "Guardar cliente" | Se abre la ficha de Ana |
| 15 | En la ficha de Ana, tocar "Archivar" | Volvés a la lista y Ana **no** aparece |
| 16 | En la lista, tocar el botón "Archivados" | Aparece Ana ("archivado hoy") |
| 17 | Abrir a Ana y tocar "Reactivar" | Dice "Ana Prueba volvió a la lista de clientes" |
| 18 | Tocar "Todos" en la lista | Ana aparece de nuevo |
| 19 | Probar todo desde el celular (abrí el mismo link) | Se ve y se usa bien |

Si algo da ❌, sacale una captura y mandásela a Claude junto con el número del paso.

## Problemas conocidos

* **"Falta configuración":** el archivo se tiene que llamar `.env.local` (con punto entre `env` y `local`) y estar en `apps/admin/`. Después de renombrarlo, cortá `npm run dev` (Ctrl+C) y volvé a correrlo.
* **"Demasiados intentos seguidos":** el plan gratis de Supabase manda pocos mails por hora. Esperá unos minutos.
* **No veo datos / error al cargar:** falta habilitar `core` en Exposed schemas (paso 2 de arriba).
