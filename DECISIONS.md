# Decisiones del proyecto

> Detalle técnico completo en `docs/ARCHITECTURE.md`.
> Cada decisión nueva se agrega abajo con fecha. No se borra una decisión: se marca como reemplazada.

## D-001 — Multi-tenant (vigente)

Una única aplicación sirve a múltiples negocios. Una única base de datos almacena los datos, aislados mediante `business_id` y Row Level Security.

## D-002 — Stack inicial (vigente)

Frontend: React, TypeScript, Vite, Tailwind CSS.

Backend: Supabase, PostgreSQL, Supabase Auth, Supabase Storage, Supabase Edge Functions cuando sean necesarias.

## D-003 — Cliente web primero (vigente)

La primera versión es web mobile-first y PWA. No se desarrolla app nativa antes de validar el producto web.

## D-004 — Desarrollo incremental (vigente)

El desarrollo es incremental y guiado por `TASKS.md`. Las decisiones que cambien la arquitectura se registran en este archivo.

---

## D-005 — Plataforma con núcleo + módulos (2026-10-08, vigente)

**Contexto:** además de fidelización, se planean otros productos para el mismo tipo de cliente (turnos, reputación, WhatsApp vendedor, detector de pérdidas, club VIP). Todos se apoyan en negocio + clientes + visitas.

**Decisión:** monolito modular. Un núcleo (`core`) con todo lo compartido y un esquema de Postgres por módulo (`loyalty`, `recovery`, `booking`, …). Los módulos dependen del núcleo y nunca entre sí; se comunican mediante visitas y eventos del núcleo.

**Consecuencias:** el primer producto tarda un poco más porque el núcleo se diseña bien desde el inicio; cada producto siguiente reutiliza auth, clientes, visitas, estadísticas, campañas, mensajería, suscripciones y UI.

## D-006 — La visita es el dato central (2026-10-08, vigente)

Toda interacción del cliente con el negocio se registra como `core.visits` (cliente opcional, monto opcional) mediante una única función `core.record_visit()`. Fidelización, recuperación, turnos y reputación se alimentan de ahí.

## D-007 — Identidad del cliente separada del programa de puntos (2026-10-08, vigente)

`core.customers` es la persona conocida por el negocio. Sumarse al programa de puntos (`loyalty.members`) es opcional. Así se miden también los clientes que no quieren puntos ni app, y las visitas anónimas.

## D-008 — Lógica crítica en la base de datos (2026-10-08, vigente)

Puntos, canjes, estados, atribución y dinero se calculan en funciones de Postgres dentro de transacciones. Las tablas sensibles no tienen policies de escritura para el cliente: solo se escriben mediante funciones. El frontend no calcula nada que importe.

## D-009 — Campañas, segmentos y mensajería en el núcleo (2026-10-08, vigente)

Varios módulos envían campañas, así que segmentos, campañas, grupo de control, atribución y mensajería (con consentimiento centralizado) son del núcleo.

## D-010 — Dinero en unidades menores (2026-10-08, vigente)

Montos en `bigint` (centavos) con moneda por negocio. Nunca `float`. Estadísticas en la zona horaria del negocio.

## D-011 — Monorepo con dos apps (2026-10-08, vigente)

npm workspaces: `apps/admin` (panel del negocio), `apps/client` (PWA del cliente final, white-label), `packages/ui`, `packages/sdk`, `packages/config`. La app actual `app/` se mueve a `apps/admin/`.

## D-012 — Librerías de frontend (2026-10-08, vigente)

React Router, TanStack Query, zod, react-hook-form, Vitest + Testing Library, Playwright. Tipos de la base generados con `supabase gen types`.

## D-013 — Suscripciones modeladas desde el inicio, cobro después (2026-10-08, vigente)

`core.modules`, `core.plans`, `core.subscriptions` y `core.business_modules` existen desde el núcleo y controlan acceso (RLS + menú). La integración con un proveedor de pagos se implementa cuando haya demanda real.

## D-014 — Teléfonos en E.164 con normalización argentina en el SDK (2026-10-09, vigente)

La base guarda teléfonos solo en E.164 (`+5491122334455`). El SDK (`normalizePhone`) convierte lo que se escribe en el mostrador ("11 2233-4455", "011 15 …") asumiendo números celulares argentinos (con el 9), que son los que sirven para WhatsApp. Números de otros países se cargan con `+` y código de país.

## D-015 — Tres niveles de tests (2026-10-09, vigente)

* pgTAP (`supabase/tests/database`): seguridad, aislamiento y reglas de negocio en la base.
* Vitest (`*.test.ts`): lógica pura del frontend/SDK (formatos, validaciones).
* Playwright (`e2e/`): recorridos completos contra Supabase local en CI, en celular y escritorio.

Todo corre en GitHub Actions en cada push. Ningún cambio se lleva a `main` con el CI en rojo.

## D-016 — Tipos de la base generados por CI (2026-10-09, vigente)

`packages/sdk/src/database.types.ts` lo genera el workflow `DB types` (`supabase gen types --local --schema core`) cada vez que cambian las migraciones, y lo commitea solo. El SDK usa esos tipos (`Tables<'...'>`, `FunctionReturns<'...'>`) en lugar de interfaces escritas a mano. No se edita a mano.
