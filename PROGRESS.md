# Progreso del proyecto

> Estado verificado el 2026-10-09 ~08:30 (hora Argentina).

## Current phase

Fase 3 — Clientes y registro de visitas: construida. **No se avanza a la Fase 4** hasta dejar el entorno de desarrollo funcionando y validar el mostrador con datos de prueba.

## Current task

1. Revisión humana de las migraciones nuevas y del cambio de archivado (rama `fix/archive-owner-admin-only`).
2. Configurar el proyecto de desarrollo (esquema `core` expuesto, Redirect URLs).
3. Levantar el panel en Codespaces y validar el mostrador con datos de prueba.

## Migraciones

Proyecto de **desarrollo**: `fidelizacion-saas`, ref `dqpnqcumlyfifewgzyvh` (único proyecto activo de la cuenta; los demás figuran como inactivos).

| # | Versión | Nombre | Estado en desarrollo |
|---|---|---|---|
| 1 | 20261009013750 | core_tenancy | aplicada 2026-10-08 |
| 2 | 20261009013947 | core_modules | aplicada 2026-10-08 |
| 3 | 20261009014229 | core_customers | aplicada 2026-10-08 |
| 4 | 20261009014457 | core_visits | aplicada 2026-10-08 |
| 5 | 20261009014518 | core_audit_storage_jobs | aplicada 2026-10-08 |
| 6 | 20261009014725 | core_fk_indexes | aplicada 2026-10-08 |
| 7 | 20261009110522 | core_onboarding | aplicada 2026-10-09 08:05 (con OK del dueño) |
| 8 | 20261009110534 | core_customer_search | aplicada 2026-10-09 08:05 (con OK del dueño) |
| 9 | 20261009110548 | core_customer_import | aplicada 2026-10-09 08:05 (con OK del dueño) |
| 10 | 20261009120000 | core_archive_owner_admin_only | **pendiente de revisión — NO aplicada** |

Regla vigente desde 2026-10-09: ninguna migración se aplica sin aprobación explícita del dueño después de revisarla.

Las migraciones 7–9 son solo aditivas (funciones e índices nuevos, sin cambios de datos ni de tablas existentes). Si se quisieran revertir: `drop function core.import_customers(uuid, jsonb)`, `drop function core.search_customers(uuid, text, text, integer, integer)`, `drop index core.customers_name_trgm_idx, core.customers_phone_trgm_idx`, `drop function core.create_business(text, text, text)`, `drop function core.is_slug_available(text)`, `drop function core.is_reserved_slug(text)`.

## Cambios pendientes de revisión

Rama `fix/archive-owner-admin-only` (commit `62a7b19`):

* Archivar/reactivar clientes pasa a ser **exclusivo de owner/admin**, también desde la base: se quita a los usuarios el permiso de modificar `customers.status` y se agrega `core.set_customer_status()` (exige owner/admin, queda auditado).
* Los empleados siguen pudiendo editar nombre, teléfono, email y notas.
* 10 tests nuevos (`008-customer-archive.test.sql`).

## Tests

| Nivel | Dónde / comando | Último resultado |
|---|---|---|
| Base de datos (pgTAP) | Postgres 16 local del agente: `scripts/db-test-local.sh` | 132/132 OK (9 archivos) |
| Base de datos (pgTAP) | CI: `supabase db start` + `supabase test db` (Supabase real en Docker) | OK en `main` |
| Unitarios (Vitest) | CI: `npm test` · local del agente: runner mínimo con Node (npm no disponible) | OK |
| Frontend | CI: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` | OK |
| Punta a punta (Playwright) | CI: `supabase start` + build + `vite preview` + `npx playwright test` (celular y escritorio) | OK: registro → onboarding → panel → login; credenciales incorrectas; mostrador; importación CSV |

Limitación: los tests de punta a punta corren contra un Supabase **local** en CI. El panel todavía **no se probó contra el proyecto de desarrollo remoto**. Eso es lo que falta validar ahora.

## Trabajo del viernes 9 a la mañana (sin Supabase, sin Fase 4)

Rama `chore/calidad-pre-piloto` (llevada a `main` con CI en verde; no toca la base de datos):

* **Tipos generados automáticamente** desde las migraciones (workflow `DB types`) y usados en el SDK. Detectaron 6 lugares donde se mandaba "nulo" en vez de omitir un dato (corregido).
* **Arreglo para Codespaces:** Vite bloqueaba la dirección `*.app.github.dev` ("Blocked request"); ahora está permitida.
* **Mensajes de error de login más claros** (límite de mails del plan gratis, email inválido) + tests.
* **Inicio:** visitas de hoy y de los últimos 7 días, con % de clientes identificados (para el piloto).
* **Kit del piloto** en `docs/piloto/`: plan de 2 semanas, manual de 1 página para el cajero, cartel de privacidad (modelo).
* Guía de prueba actualizada con problemas conocidos.

### Hallazgos que necesitan decisión

1. **`core` todavía NO está expuesto** en el proyecto de desarrollo: los tipos generados desde Supabase solo traían `public`. Sin esto el panel no puede leer datos.
2. **Cuentas de empleados:** hoy no hay forma de invitar a un empleado desde el panel. Para el piloto, el cajero usaría la cuenta del dueño en el dispositivo del mostrador. Decidir si se agrega "Invitar empleado" antes del piloto.
3. **Limpieza de registros:** `core.events` y el historial de `pg_cron` crecen sin límite. No urge; agendar un job de limpieza antes de producción.
4. **Pedido de baja de datos** (`core.anonymize_customer`, Ley 25.326): documentado en la arquitectura pero no implementado. Necesario antes de clientes reales en forma comercial.

## Current blockers

HUMAN ACTION REQUIRED:

1. Revisar y aprobar (o pedir cambios) la migración 10 y las migraciones 7–9 ya aplicadas.
2. Exponer el esquema `core` en el proyecto de desarrollo (no se puede verificar desde la base; confirmar en el dashboard).
3. Redirect URLs de desarrollo: `http://localhost:5173/**` y `https://*.app.github.dev/**`.
4. `apps/admin/.env.local` (no `.envlocal`) con la URL y la publishable key de desarrollo.
5. Validar el mostrador en el navegador con datos de prueba.

## Important decisions

* Plataforma núcleo (`core`) + módulos por esquema; los módulos nunca dependen entre sí (D-005).
* La visita (`core.visits`) es el dato central; identidad del cliente separada del programa de puntos (D-006, D-007).
* Lógica crítica en Postgres; el frontend no calcula nada que importe (D-008).
* Teléfonos en E.164 con normalización argentina en el SDK (D-014).
* Tres niveles de tests en CI; nada llega a `main` en rojo (D-015).
* Archivar clientes: solo owner/admin, aplicado en la base (pendiente de aprobar y aplicar).
