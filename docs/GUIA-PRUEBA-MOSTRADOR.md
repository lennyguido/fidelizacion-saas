# Guía para probar el mostrador (paso a paso)

Objetivo: comprobar con tus propios ojos que el panel funciona conectado a tu Supabase de **desarrollo** (el de prueba, no el de clientes reales).

## Antes de empezar (una sola vez)

1. En Supabase, arriba a la izquierda dice **fidelizacion-saas**. Si dice otra cosa, cambiá de proyecto.
2. **Project Settings → Data API → Exposed schemas**: tiene que estar `core`.
3. **Authentication → URL Configuration → Redirect URLs**: tienen que estar `http://localhost:5173/**` y `https://*.app.github.dev/**`.

## Levantar el panel

1. En GitHub, abrí tu Codespace (botón verde **Code → Codespaces**).
2. Revisá que exista el archivo `apps/admin/.env.local` (con el punto entre `env` y `local`).
3. En la terminal: `npm run dev`
4. Tocá **Open in Browser** cuando aparezca.

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
| 11 | Probar todo desde el celular (abrí el mismo link) | Se ve y se usa bien |

Si algo da ❌, sacale una captura y mandásela a Claude junto con el número del paso.
