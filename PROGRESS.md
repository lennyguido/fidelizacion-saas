# Progreso del proyecto

## Current phase

Fase 0 — Base del repositorio (ver PLAN POR FASES en `TASKS.md`)

## Current task

Configurar Supabase CLI y autenticación (requiere acción humana, ver "Current blockers").

## Last completed task

Preparación del repositorio:

* `claude.md` renombrado a `CLAUDE.md`.
* `@supabase/supabase-js` movido de la raíz a `app/package.json`; eliminado el `package.json` de la raíz.
* Creado `app/.env.example`.
* README con estructura y comandos oficiales.
* Marcadas en `TASKS.md` las tareas ya hechas de las secciones 1, 2 y 3.
* Arquitectura de plataforma documentada (`docs/ARCHITECTURE.md`, D-005 a D-013) y plan por fases en `TASKS.md`.

## Next task

Fase 0: convertir a monorepo (`app/` → `apps/admin/`, `packages/*`), Prettier, aliases; luego `supabase init` y `supabase link`.

Antes: arquitectura de plataforma núcleo + módulos definida en `docs/ARCHITECTURE.md` y `DECISIONS.md` (D-005 a D-013).

## Current blockers

HUMAN ACTION REQUIRED:

1. Correr `npm install` dentro de `app/` para actualizar `package-lock.json` con `@supabase/supabase-js`.
2. Instalar Docker Desktop (Supabase local lo necesita).
3. Autenticarse en Supabase CLI: `npx supabase login` (abre el navegador).
4. Proyecto Supabase de desarrollo: ya creado. Falta pasar el Project ref al agente y completar `app/.env.local` a partir de `app/.env.example`.

## Last test result

No verificado en este cambio: npm no tuvo acceso al registro en el entorno del agente. Verificar con `npm run build` y `npm run lint` en `app/` después de `npm install`.

## Last commit

`docs: define platform architecture (core + modules)`

## Important decisions

* Stack inicial: React + TypeScript + Vite + Tailwind.
* Backend: Supabase + PostgreSQL.
* Arquitectura: multi-tenant (`business_id` + RLS).
* Plataforma núcleo (`core`) + módulos por esquema; los módulos nunca dependen entre sí.
* La visita (`core.visits`) es el dato central; identidad del cliente separada del programa de puntos.
* Monorepo: `apps/admin`, `apps/client`, `packages/*`, `supabase/`.
* El backlog operativo principal se encuentra en `TASKS.md`.
