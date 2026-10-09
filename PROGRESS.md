# Progreso del proyecto

## Current phase

3 — Frontend base

## Current task

Configurar Supabase CLI y autenticación (requiere acción humana, ver "Current blockers").

## Last completed task

Preparación del repositorio:

* `claude.md` renombrado a `CLAUDE.md`.
* `@supabase/supabase-js` movido de la raíz a `app/package.json`; eliminado el `package.json` de la raíz.
* Creado `app/.env.example`.
* README con estructura y comandos oficiales.
* Marcadas en `TASKS.md` las tareas ya hechas de las secciones 1, 2 y 3.

## Next task

Sección 3 pendiente: Prettier, aliases de imports, estructura de carpetas (sección 4), router, layout base y componentes reutilizables.

En paralelo, en cuanto se resuelva el bloqueo: sección 5 (Supabase local).

## Current blockers

HUMAN ACTION REQUIRED:

1. Correr `npm install` dentro de `app/` para actualizar `package-lock.json` con `@supabase/supabase-js`.
2. Instalar Docker Desktop (Supabase local lo necesita).
3. Autenticarse en Supabase CLI: `npx supabase login` (abre el navegador).
4. Crear el proyecto Supabase de desarrollo y completar `app/.env.local` a partir de `app/.env.example`.

## Last test result

No verificado en este cambio: npm no tuvo acceso al registro en el entorno del agente. Verificar con `npm run build` y `npm run lint` en `app/` después de `npm install`.

## Last commit

`chore: prepare repo for development`

## Important decisions

* Stack inicial: React + TypeScript + Vite + Tailwind.
* Backend: Supabase + PostgreSQL.
* Arquitectura: multi-tenant (`business_id` + RLS).
* El frontend vive en `app/`; Supabase vivirá en `supabase/` en la raíz.
* El backlog operativo principal se encuentra en `TASKS.md`.
