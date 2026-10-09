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
| 11 | 20261009130000 | core_team | **pendiente de revisión — NO aplicada** |
| 12 | 20261009130100 | core_customer_anonymize | **pendiente de revisión — NO aplicada** |
| 13 | 20261009130200 | core_housekeeping | **pendiente de revisión — NO aplicada** |
| 14 | 20261009130300 | core_team_owner_protection | **pendiente de revisión — NO aplicada** (rama `feat/proteger-duenos`) |

Regla vigente desde 2026-10-09: ninguna migración se aplica sin aprobación explícita del dueño después de revisarla.

Las migraciones 7–9 son solo aditivas (funciones e índices nuevos, sin cambios de datos ni de tablas existentes). Si se quisieran revertir: `drop function core.import_customers(uuid, jsonb)`, `drop function core.search_customers(uuid, text, text, integer, integer)`, `drop index core.customers_name_trgm_idx, core.customers_phone_trgm_idx`, `drop function core.create_business(text, text, text)`, `drop function core.is_slug_available(text)`, `drop function core.is_reserved_slug(text)`.

## Cambios pendientes de revisión

Resumen en simple para revisar: `docs/REVISION-PENDIENTE.md`.

* `fix/archive-owner-admin-only` — archivar solo owner/admin.
* `feat/equipo-y-privacidad` (encima de la anterior) — invitar empleados, administrar el equipo, borrar datos personales de un cliente, limpieza semanal. Migraciones `20261009130000`, `20261009130100`, `20261009130200`, **no aplicadas**.

Detalle de la primera rama:


Rama `fix/archive-owner-admin-only` (commit `62a7b19`):

* Archivar/reactivar clientes pasa a ser **exclusivo de owner/admin**, también desde la base: se quita a los usuarios el permiso de modificar `customers.status` y se agrega `core.set_customer_status()` (exige owner/admin, queda auditado).
* Los empleados siguen pudiendo editar nombre, teléfono, email y notas.
* 10 tests nuevos (`008-customer-archive.test.sql`).

## Tests

| Nivel | Dónde / comando | Último resultado |
|---|---|---|
| Base de datos (pgTAP) | Postgres 16 local del agente: `scripts/db-test-local.sh` | main: 132/132 OK (9 archivos) · rama `feat/equipo-y-privacidad`: 154/154 OK (11 archivos) |
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
2. **Cuentas de empleados:** resuelto en la rama `feat/equipo-y-privacidad` (pendiente de revisión).
3. **Limpieza de registros:** resuelto en la rama `feat/equipo-y-privacidad` (pendiente de revisión).
4. **Pedido de baja de datos** (Ley 25.326): resuelto en la rama `feat/equipo-y-privacidad` (pendiente de revisión).

## Viernes 9, mediodía (sin tocar Supabase)

* **Revisión de seguridad independiente** de `feat/equipo-y-privacidad`: sin fugas entre negocios; 5 problemas corregidos en `10f360a` (detalle en `docs/REVISION-PENDIENTE.md`). Tests de base locales: **154/154 OK** (11 archivos).
* **Alertas de Supabase** del proyecto de desarrollo leídas (solo lectura). Una función agregada por Supabase (`public.rls_auto_enable`) queda abierta: quitarle el permiso **necesita aprobación**.
* `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md` y `docs/APLICAR-MIGRACIONES.md` (paso a paso para cuando se aprueben).

## Viernes 9, tarde — respuesta al mentor (sin aplicar nada)

* Mentor: aprueba la migración de archivado; pide confirmar permisos antes de la de equipo; dos dueños protegidos entre sí; email confirmado antes de invitaciones en producción; no ejecutar el REVOKE de `rls_auto_enable` sin explicación; **no aplicar migraciones ni avanzar a puntos** hasta validar el panel contra desarrollo.
* Hecho: `fix/reactivar-cliente` (error del dueño: no se podía recuperar un archivado), `feat/proteger-duenos` (migración 14 + `docs/PERMISOS.md`), revisión de solo lectura del proyecto de desarrollo (`chore/dev-smoke`), explicación de `rls_auto_enable`, arreglo de un test e2e inestable. Tests de base: **161/161 OK**. Ver `docs/REVISION-PENDIENTE.md`.
* Panel: el dueño lo levantó en Codespaces y "anda"; falta la validación completa del mostrador.

## Marketing (solo documentos)

`docs/marketing/`: nombre recomendado **Vueltita** (falta verificar INPI y nic.ar), marca y colores, análisis de mercado con fuentes, precios propuestos, guion de ventas y textos de la web. No cambia el backlog ni el código.

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
