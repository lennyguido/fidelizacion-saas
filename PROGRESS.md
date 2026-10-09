# Progreso del proyecto

## Current phase

Fase 3 — Clientes y registro de visitas: **construida**. Falta el **checkpoint de producto** (probar con un negocio real) antes de la Fase 4.

## Current task

Aplicar al proyecto Supabase de desarrollo las migraciones nuevas y probar el panel con datos reales de prueba.

## Last completed task

Noche del 8 al 9 de octubre (sin intervención humana):

* **Fase 2:** onboarding en la base (`core.create_business`, `core.is_slug_available`), login/registro/recuperar contraseña, negocio activo (`/b/:slug`), menú armado con los manifests de módulos, componentes en `packages/ui`, acceso a datos en `packages/sdk`.
* **Fase 3:** búsqueda de clientes (`core.search_customers`), mostrador (+1 visita con monto opcional, alta rápida, visita anónima, aviso de doble carga), listado con filtros por estado, ficha con estadísticas, edición, archivo e historial con anulación, importación CSV (`core.import_customers`).
* **Calidad:** 122 tests de base (pgTAP), tests unitarios (Vitest) de teléfonos/montos/CSV, tests de punta a punta (Playwright) en celular y escritorio contra Supabase local: registro → onboarding → panel → login, mostrador, importación.

## Next task

1. (Humano) Pasos de "Current blockers".
3. Checkpoint de producto (TASKS.md Fase 3): probar el mostrador con un negocio real.
4. Fase 4 — módulo Fidelización.

## Current blockers

HUMAN ACTION REQUIRED:

1. **Exponer el esquema `core`**: Supabase → Project Settings → Data API → Exposed schemas → agregar `core`. Sin esto el panel no puede leer datos.
2. **URLs de Auth**: Supabase → Authentication → URL Configuration → agregar `http://localhost:5173/**` en Redirect URLs (para los links de confirmación y de recuperar contraseña mientras se desarrolla).
4. **`package-lock.json`**: `npm install` en la raíz (Codespaces o una compu con Node) y commitearlo.
5. **Probar el panel**: copiar `apps/admin/.env.example` a `apps/admin/.env.local` con la URL y la publishable key del proyecto, y `npm run dev`.

## Pending migrations (dev project)

Ninguna: las 9 migraciones están aplicadas en `dqpnqcumlyfifewgzyvh` (2026-10-09).

## Last test result

* Local (Postgres 16 + pgTAP): 122/122 OK.
* CI en `main`: Frontend OK · Database OK · End-to-end OK.

## Last commit

Ver `git log`.

## Important decisions

* Plataforma núcleo (`core`) + módulos por esquema; los módulos nunca dependen entre sí (D-005).
* La visita (`core.visits`) es el dato central; identidad del cliente separada del programa de puntos (D-006, D-007).
* Lógica crítica en Postgres; el frontend no calcula nada que importe (D-008).
* Teléfonos en E.164 con normalización argentina en el SDK (D-014).
* Tres niveles de tests en CI; nada llega a `main` en rojo (D-015).
* Pendiente de decidir: los empleados (`staff`) hoy pueden editar y archivar clientes por RLS (la UI oculta "Archivar"). Evaluar si archivar debe ser solo de owner/admin.
