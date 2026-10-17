# Home de la marca (neriva.net)

`apps/home` es la página de entrada de Neriva: presenta todos los productos y lleva a cada
uno (D-058). Es estática, no habla con Supabase. La página de venta de Fidelización
(`apps/landing`) se muda a **fidelizacion.neriva.net** sin cambios.

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
