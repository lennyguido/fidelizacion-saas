# Cómo trabajar en este proyecto

> Leer antes: `CLAUDE.md` (reglas), `docs/ARCHITECTURE.md` (arquitectura obligatoria), `TASKS.md` (orden de trabajo).

## Orden de trabajo

1. Tomar la siguiente tarea de `TASKS.md` (no saltear fases).
2. Crear una rama: `feat/...`, `fix/...`, `docs/...`, `chore/...`.
3. Cambios chicos, con tests.
4. Actualizar `PROGRESS.md` (y `DECISIONS.md` si se decidió algo importante).
5. Push → esperar el CI en verde → llevar a `main`.

## Comandos oficiales

| Para qué | Comando |
|---|---|
| Instalar | `npm install` |
| Panel en el navegador | `npm run dev` (en `apps/admin`, con `.env.local`) |
| Tipos | `npm run typecheck` |
| Lint | `npm run lint` |
| Formato | `npm run format:check` (arreglar con `npm run format`) |
| Tests unitarios | `npm test` |
| Tests de base de datos | `supabase test db` · sin Supabase: `scripts/db-test-local.sh` |
| Tests punta a punta | `npx playwright test` (con Supabase local levantado) |
| Build | `npm run build` |

## Migraciones

* Un archivo por cambio en `supabase/migrations/`, con comentario arriba explicando qué hace en simple.
* Solo cambios aditivos en lo ya aplicado; nunca editar una migración aplicada.
* Terminar con `revoke execute on all functions in schema <esquema> from public, anon;`.
* Funciones que llama un usuario: `grant execute ... to authenticated` y agregarlas al meta-test.
* **Aplicar en Supabase solo con aprobación del dueño.** Ver `docs/APLICAR-MIGRACIONES.md`.

## Commits

Formato corto en inglés: `feat: ...`, `fix: ...`, `test: ...`, `docs: ...`, `chore: ...`.

## Tipos de la base

`packages/sdk/src/database.types.ts` lo genera el CI (workflow *DB types*). No editarlo a mano. Después de que el bot lo actualiza, hacer un push más para que corran las pruebas (D-016).
