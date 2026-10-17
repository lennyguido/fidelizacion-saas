# Home de la marca (neriva.net)

`apps/home` es la página de entrada de Neriva: presenta todos los productos y lleva a cada
uno (D-058). Es estática, no habla con Supabase. La página de venta de Fidelización
(`apps/landing`) se muda a **fidelizacion.neriva.net** sin cambios.

## Cómo quedó publicado (2026-10-16)

| Dirección                 | Qué es                    | Proyecto de Vercel                      |
| ------------------------- | ------------------------- | --------------------------------------- |
| `neriva.net` (y `www`)    | Esta home                 | el proyecto nuevo de la home            |
| `fidelizacion.neriva.net` | Página de Fidelización    | `neriva-landing`                        |
| `turnos.neriva.net`       | Neriva Turnos             | `neriva-turnos`                         |
| `tienda.neriva.net`       | Tienda (otro público)     | `neriva` (no es de este repositorio)    |

Cada vez que algo entra a `main`, Vercel vuelve a publicar la home sola.

## Cambiar cosas

- **Textos de las secciones:** `apps/home/src/Sections.tsx` (y el título de arriba).
- **Productos (estaciones):** `apps/home/src/products.ts`.
- **Precios y WhatsApp:** `apps/home/src/site.ts`.
- **Colores, tipografía y dibujo de la línea:** `apps/home/src/index.css`.
- **Menú:** `apps/home/src/Header.tsx`.

Lo más fácil: pedírselo a Claude Code en el proyecto ("cambiá el precio del paquete a …").

## Agregar un producto

1. Abrí `apps/home/src/products.ts`.
2. Copiá un bloque `{ id: ... }` y pegalo al final de la lista.
3. Cambiale `id`, `name`, `station`, `tagline`, `description`, `href` y `linkLabel`.
   Aparece solo en el mapa de la línea, en "Cada estación, una herramienta" y en el footer.

Los precios y el WhatsApp están en `apps/home/src/site.ts`.

## Publicar (lo hace el dueño: son dominios)

El dominio está en GoDaddy y apunta a Vercel. Hoy el proyecto de Vercel que tiene
`neriva.net` arma la página de Fidelización.

1. **Mudar Fidelización:** Vercel → el proyecto que hoy tiene `neriva.net` → Settings →
   Domains → **Add** `fidelizacion.neriva.net`. En **GoDaddy → DNS → Agregar registro**:
   tipo **CNAME**, nombre `fidelizacion`, valor `cname.vercel-dns.com`. Esperar a que
   Vercel lo marque como válido y abrir https://fidelizacion.neriva.net.
2. **Crear la home:** Vercel → **Add New → Project** → importar `lennyguido/fidelizacion-saas`.
   * Framework: **Vite** · Root Directory: dejar la raíz del repositorio.
   * Build Command: `npm run build -w @plataforma/home`
   * Output Directory: `apps/home/dist`
   * Deploy.
3. **Pasar neriva.net a la home:** en el proyecto de Fidelización, quitar `neriva.net` y
   `www.neriva.net`. En el proyecto de la home, **Add** `neriva.net` y `www.neriva.net`.
   Como el DNS ya apunta a Vercel, no hay que tocar GoDaddy.

Después, revisar en el celular: neriva.net, los links a cada producto, y que un link
corto de reseñas (`neriva.net/r/...`) siga andando: lo resuelve el `vercel.json` de la raíz,
que usan todos los proyectos de Vercel del repositorio.
