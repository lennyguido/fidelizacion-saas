# Plataforma SaaS de Fidelización

Plataforma SaaS multi-tenant para negocios locales.

El producto permite a los negocios:

* registrar clientes;
* registrar compras;
* otorgar puntos;
* crear recompensas;
* gestionar canjes;
* detectar clientes inactivos;
* ejecutar campañas de recuperación;
* medir clientes recuperados y dinero recuperado.

## Stack

* React
* TypeScript
* Vite
* Tailwind CSS
* Supabase
* PostgreSQL

## Documentación

* `TASKS.md` — backlog operativo principal.
* `CLAUDE.md` — reglas para el agente de desarrollo.
* `PROGRESS.md` — progreso actual.
* `DECISIONS.md` — decisiones importantes de arquitectura y producto.

## Estructura

* `app/` — frontend (React + TypeScript + Vite + Tailwind).
* `supabase/` — configuración local, migraciones y seed (se crea en la sección 5 de `TASKS.md`).

## Desarrollo local

```bash
cd app
npm install
cp .env.example .env.local   # completar con los datos del proyecto Supabase de desarrollo
npm run dev
```

Comandos oficiales (desde `app/`):

* `npm run dev` — servidor de desarrollo.
* `npm run build` — typecheck + build de producción.
* `npm run lint` — ESLint.
