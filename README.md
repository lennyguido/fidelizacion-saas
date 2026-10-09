# Plataforma SaaS de Fidelización

Plataforma SaaS multi-tenant para negocios locales, construida como un núcleo compartido + módulos. El primer producto es Fidelización + Recuperación de clientes; la misma base sirve para turnos, reputación, WhatsApp vendedor y otros (ver `docs/ARCHITECTURE.md`).

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
* `docs/ARCHITECTURE.md` — arquitectura de la plataforma (núcleo + módulos).

## Estructura

```text
apps/admin/        panel del negocio (React + TypeScript + Vite + Tailwind)
apps/client/       app del cliente final (PWA) — Fase 4
packages/config/   configuración compartida de TypeScript
packages/ui/       componentes reutilizables
packages/sdk/      acceso a datos (único lugar que habla con Supabase)
supabase/          migraciones, tests de base de datos y seed
docs/              arquitectura
```

## Desarrollo local

```bash
npm install                                       # en la raíz: instala todos los workspaces
cp apps/admin/.env.example apps/admin/.env.local  # completar con el proyecto Supabase de DESARROLLO
npm run dev                                       # levanta el panel del negocio
```

Comandos oficiales (desde la raíz):

* `npm run dev` — servidor de desarrollo del panel.
* `npm run build` — typecheck + build de todas las apps.
* `npm run typecheck` — TypeScript en todos los workspaces.
* `npm run lint` — ESLint.
* `npm run format` / `npm run format:check` — Prettier.
* `npm run test:e2e` — tests de punta a punta (Playwright; requiere Supabase local y `vite preview`).

## Base de datos

* Migraciones en `supabase/migrations/` (núcleo `core_*` primero, después cada módulo).
* Tests pgTAP en `supabase/tests/database/`.
* Datos demo en `supabase/seed.sql` (Café Central y Panadería Sur).

```bash
npx supabase db start   # Postgres local con migraciones + seed (requiere Docker)
npx supabase test db    # corre los tests
```

Sin Docker: `scripts/db-test-local.sh` contra cualquier Postgres 16+ con pgTAP.

