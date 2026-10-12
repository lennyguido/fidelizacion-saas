# Página de venta de Neriva (neriva.net)

App: `apps/landing` (React + Vite + Three.js). Es estática: no habla con Supabase.

* Tarjeta de sellos en 3D (se inclina con el mouse; tocarla suma sellos).
* Recorrido interactivo por el panel: mostrador, tarjeta, automático, mensajes listos,
  estadísticas.
* Calculadora "¿cuánta plata se te va?" (estimación, marcada como tal).
* Planes Barrio / Local / Cadena (`src/lib/plans.ts`, igual a `docs/marketing/PRECIOS.md`).
* **Comprar** abre WhatsApp con el plan elegido. No hay registro: el acceso lo da el
  dueño desde el panel (`docs/ACCESOS.md`).

## Probar en tu compu

```bash
npm run dev -w @plataforma/landing
```

y abrir http://localhost:5175.

## Variables

| Variable | Valor |
|---|---|
| `VITE_SALES_WHATSAPP` | número de ventas, ej. `5491128330853` (si no está, usa ese mismo) |

## Publicarla en neriva.net (decidido el 2026-10-12: la tienda pasa a tienda.neriva.net)

El dominio está en GoDaddy y hoy `neriva.net` apunta a **Vercel** (la tienda). GoDaddy no
deja apuntar el dominio "pelado" (sin `www`) a Cloudflare Pages, así que la página va en
**Vercel**, donde ya está el dominio:

1. **Vercel → Add New → Project →** importar `lennyguido/fidelizacion-saas`.
   * Framework: **Vite** · Root Directory: dejar la raíz del repositorio.
   * Build Command: `npm run build -w @plataforma/landing`
   * Output Directory: `apps/landing/dist`
   * Deploy.
2. **Mudar la tienda:** en el proyecto de la tienda → Settings → Domains → **Add**
   `tienda.neriva.net`. Vercel pide un registro: en **GoDaddy → DNS → Agregar** tipo
   **CNAME**, nombre `tienda`, valor `cname.vercel-dns.com`.
3. **Pasar neriva.net a la página:** en el proyecto de la tienda, quitar `neriva.net`
   (y `www.neriva.net` si está). En el proyecto nuevo, **Add** `neriva.net` y
   `www.neriva.net`. Como el DNS ya apunta a Vercel, no hay que tocar GoDaddy.
4. Revisar en el celular: neriva.net, el botón Comprar y el link "Entrar" (panel.neriva.net).
