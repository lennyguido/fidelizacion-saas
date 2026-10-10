# Progreso del proyecto

> Estado verificado el 2026-10-09 ~19:30 (hora Argentina).

## Current phase

Fases 0–5 construidas y completas (2026-10-09, incluida la atribución por cupón). Integradas en `main` y aplicadas en desarrollo. **Siguiente:** Fase 6 (mensajería real) requiere checkpoint humano (WhatsApp real); mientras tanto, pendientes chicos de las fases 4–5 y Fase 7 (PWA/deploy).

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
| 10 | 20261009182015 | core_archive_owner_admin_only | aplicada 2026-10-09 15:20 (aprobada por el mentor; merge a `main`) |
| 11 | 20261009130000 | core_team | **pendiente de revisión — NO aplicada** |
| 12 | 20261009130100 | core_customer_anonymize | **pendiente de revisión — NO aplicada** |
| 13 | 20261009130200 | core_housekeeping | **pendiente de revisión — NO aplicada** |
| 14 | 20261009130300 | core_team_owner_protection | **pendiente de revisión — NO aplicada** (rama `feat/proteger-duenos`) |
| 15 | 20261009182137 | loyalty_core | aplicada 2026-10-09 15:21 (OK del dueño, D-019; merge a `main`) |
| 16 | 20261009183337 | loyalty_cards | aplicada 2026-10-09 15:33 (D-019; merge a `main`) |
| 17 | 20261009184605 | core_campaigns | aplicada 2026-10-09 15:46 (D-019; merge a `main`) |
| 18 | 20261009220309 | core_timezone_check_grant | aplicada 2026-10-09 19:03 (archivo renombrado de `20261009191200` a la versión que figura en Supabase) |
| 19 | 20261009222552 | loyalty_hardening | aplicada 2026-10-09 ~19:30 (CI de `main` en verde, no destructiva; archivo renombrado de `20261009191000` a la versión de Supabase) |
| 20 | 20261009222648 | core_campaigns_hardening | aplicada 2026-10-09 ~19:30 (los `drop` solo reemplazan funciones internas y un índice; no borra datos; archivo renombrado de `20261009191100` a la versión de Supabase) |
| 21 | 20261009225015 | core_campaign_coupons | aplicada 2026-10-09 ~20:30 (D-026; CI verde, no destructiva: agrega columnas y reemplaza funciones; archivo renombrado de `20261009224000` a la versión de Supabase) |
| 22 | 20261010141212 | core_coupons_hardening | aplicada 2026-10-10 ~11:10 (CI verde; el `drop` reemplaza una función, no borra datos; archivo renombrado de `20261010031000`) |
| 23 | 20261010141302 | loyalty_wallet | aplicada 2026-10-10 ~11:10 (tablas nuevas, solo service role; archivo renombrado de `20261010120000`) |
| 24 | 20261010141333 | loyalty_wallet_stamps | aplicada 2026-10-10 ~11:10 (archivo renombrado de `20261010160000`) |

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
| Base de datos (pgTAP) | Postgres 16 local del agente: `scripts/db-test-local.sh` | main: 112/112 OK (9 archivos) · `fix/archive-owner-admin-only`: 122/122 · `feat/equipo-y-privacidad`: 160/160 · `feat/proteger-duenos`: 167/167 |
| Base de datos (pgTAP) | CI: `supabase db start` + `supabase test db` (Supabase real en Docker) | OK en `main` |
| Unitarios (Vitest) | CI: `npm test` · local del agente: runner mínimo con Node (npm no disponible) | OK |
| Frontend | CI: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` | OK |
| Punta a punta (Playwright) | CI: `supabase start` + build + `vite preview` + `npx playwright test` (celular y escritorio) | OK: registro → onboarding → panel → login; credenciales incorrectas; mostrador; importación CSV |

Limitación: los tests de punta a punta corren contra un Supabase **local** en CI. El panel todavía **no se probó contra el proyecto de desarrollo remoto**. Eso es lo que falta validar ahora.

## Viernes 9, ~20:30 — cupones de campaña (Fase 5 completa)

* **Cupones (D-026):** cada cliente contactado recibe un código propio de 6 caracteres (`{cupon}` en el mensaje). En el **Mostrador**, "¿Trae un cupón de una campaña?" lo valida, registra la visita con el monto y lo marca usado (una vez, dentro de la ventana). Resultados y lista de destinatarios muestran los cupones. Explicado en `docs/RESULTADOS.md` §7.
* Los módulos pueden sumar una tarjeta al mostrador (`counterPanel` en el manifest).
* Tests: `032-campaign-coupons` (17) + unitarios. CI verde. Migración 21 aplicada en desarrollo.
* Tarjeta del cliente: el logo del negocio aparece como ícono de la pestaña.
* Rama del mentor `feat/proteger-duenos` actualizada con `main` (sin aplicar nada).
* **Simulacro de copia de seguridad** (`TASKS.md` §65): workflow `Backup drill` (semanal y al cambiar migraciones). En un Supabase local con datos de prueba hace la copia como `docs/DEPLOY.md` §D7, la restaura en una base vacía y compara las filas: **OK**. Pasos para una restauración real: `docs/RESTAURAR.md` (sin `roles.sql`: el proyecto no tiene roles propios).

## Viernes 9, ~19:30 — CI en verde y migraciones 18–20 aplicadas

* El CI de `main` estaba rojo por una prueba de registro inestable: escribía el email antes de que cargara la pantalla de registro. Arreglado en `e2e/onboarding.spec.ts` (PR #1, merge `7b06b77`). CI de `main`: verde.
* Migraciones 18 y 19 aplicadas en desarrollo; la 20 ya estaba aplicada. Alertas de Supabase después de aplicar: nada nuevo (`loyalty.event_failures` sin policies es a propósito: solo service role).
* La PC del dueño todavía no tiene Node ni `gh`: los tests se corren en el CI de GitHub.

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

## Viernes 9, 17–18 h — revisión de seguridad, arreglos, marca, PWA y deploy preparado

* Revisión independiente de puntos, tarjeta y campañas: sin fugas entre negocios. Arreglado: un empleado podía fabricar puntos con visitas atrasadas (D-022); bajas de WhatsApp después de lanzar, campañas superpuestas, "nuevos" del tablero, desempate de consentimientos, números de segmento, horario de verano (D-023); tarjeta de clientes archivados, cámara que quedaba prendida, botón de WhatsApp sin teléfono.
* **Mi negocio** (nombre, color, zona horaria, logo) y tarjeta con la marca del negocio; panel y tarjeta instalables (PWA) (D-024).
* **Deploy preparado** en Cloudflare Pages (gratis), sin crear cuentas: `docs/DEPLOY.md`, `docs/CHECKLIST-PRODUCCION.md` (D-025).
* Ramas del mentor (`feat/equipo-y-privacidad`, `feat/proteger-duenos`) puestas al día con `main`; sus migraciones renombradas a `20261009190100`–`190400` (11–14). Además el borrado de datos ahora limpia los mensajes de campañas. CI verde.
* Tests de base en `main`: **246** (17 archivos). CI verde en `main`.
* **Pendiente:** aplicar en desarrollo las migraciones 18–20 (requiere que el dueño confirme el aviso de Supabase).

## Viernes 9, 15:50 — Fase 5 (Tablero + Recuperación) hecha

* Integrado en `main` y aplicado en desarrollo (migración 17, D-021).
* **Inicio** (dueño/admin): resumen del mes — visitas, ventas, ticket promedio, nuevos, recuperados y "en juego" — comparado con los mismos días del mes pasado.
* **Ficha del cliente:** "Mensajes por WhatsApp" para anotar si acepta o no (consentimiento, Ley 25.326).
* **Recuperación:** listas de en riesgo e inactivos ordenadas por lo que gastaron; campañas con vista previa en vivo, grupo de control al azar, mensaje personalizado, envío por `wa.me` y resultados (volvieron, gastaron, incremental vs. control).
* Tests: `030-campaigns` (21) + unitarios + e2e. CI verde.
* Atribución por cupón: hecha el 9 a la noche (D-026).

## Viernes 9, 15:40 — Fase 4 (Fidelización) terminada

* Integrado en `main` y aplicado en desarrollo: puntos, recompensas, canjes (migración 15) y **tarjeta digital** (migración 16, D-020).
* `apps/client`: el cliente abre su tarjeta con un link secreto (sin cuenta): saldo, QR con su código de socio, progreso a la próxima recompensa, movimientos. Se instala como app (PWA).
* Panel: botón "Crear tarjeta digital" en la ficha (mandar por WhatsApp o copiar); el mostrador encuentra al socio escribiendo su código.
* Tests de base: **185** aserciones en `main` (13 archivos) · e2e de punta a punta con las dos apps.
* Mostrador: botón "Escanear QR de la tarjeta" con la cámara (Chrome Android); en otros navegadores se escribe el código de 8 letras.
* **Acción del dueño (dashboard):** Data API → Exposed schemas → agregar `loyalty`.

## Viernes 9, 16 h — Fase 4 (Fidelización) empezada

El dueño validó el panel contra desarrollo (registro, login, negocio, clientes, visitas, archivado, reactivación: "anda todo") y pidió avanzar. Fase 4 en paralelo con el piloto (D-017).

Rama **`feat/loyalty-db`** (CI verde; nada aplicado en Supabase):

* Migración **15** `20261009150000_loyalty_core`: esquema `loyalty` con programa, socios, libro de puntos (solo se agrega), recompensas y canjes. Los puntos se acreditan y revierten solos con cada visita (D-018).
* Panel: página **Fidelización** (regla del programa y recompensas) y tarjeta **Puntos** en la ficha del cliente (sumarse, saldo, canjear, movimientos, cancelar canje, ajuste manual).
* Tests: `020-loyalty-points` (25), `021-loyalty-redemptions` (22), unitarios de `loyalty.ts`, e2e `loyalty.spec.ts`.
* Falta de la Fase 4: QR personal y app del cliente (`apps/client`).

Migraciones 10 y 15 **aplicadas en desarrollo** e integradas a `main` (15:20). Falta que el dueño agregue `loyalty` en **Data API → Exposed schemas** (no se puede hacer desde la base). Alertas de seguridad de Supabase después de aplicar: sin alertas nuevas.

## Viernes 9, 15 h — plan del mentor en 6 pasos

| # | Paso | Estado |
|---|---|---|
| 1 | Integrar `fix/reactivar-cliente` en `main` con prueba de regresión | ✅ merge `8e8f3c6` (CI verde). Regresión: `008-archived-customers.test.sql` (6) + `e2e/archive.spec.ts` |
| 2 | Preparar `fix/archive-owner-admin-only` con `set_customer_status` para archivar y reactivar | ✅ preparado (CI verde). Migración 10 **sin aplicar** |
| 3 | Equipo y dueños sin aplicar hasta revisar pruebas y permisos | ✅ ramas actualizadas con lo anterior (CI verde); `docs/PERMISOS.md`. Migraciones 11–14 **sin aplicar** |
| 4 | Documentar `rls_auto_enable` antes de tocarla | ✅ `docs/supabase/RLS_AUTO_ENABLE.md` + `scripts/verify-rls-auto-enable-local.sql`. **Ningún REVOKE ejecutado** |
| 5 | Probar el panel contra desarrollo, paso a paso | ⏳ guía actualizada: `docs/GUIA-PRUEBA-MOSTRADOR.md` (19 pasos). Falta que el dueño la haga |
| 6 | No avanzar a puntos hasta confirmar registro, login, negocio, clientes, visitas, archivado y reactivación | ⏳ bloqueado por el paso 5 |

Cómo volver atrás: cada cosa está en su rama; lo único integrado en `main` es el merge `8e8f3c6` (`git revert -m 1 8e8f3c6`).

## Viernes 9, tarde — respuesta al mentor (sin aplicar nada)

* Mentor: aprueba la migración de archivado; pide confirmar permisos antes de la de equipo; dos dueños protegidos entre sí; email confirmado antes de invitaciones en producción; no ejecutar el REVOKE de `rls_auto_enable` sin explicación; **no aplicar migraciones ni avanzar a puntos** hasta validar el panel contra desarrollo.
* Hecho: `fix/reactivar-cliente` (error del dueño: no se podía recuperar un archivado), `feat/proteger-duenos` (migración 14 + `docs/PERMISOS.md`), revisión de solo lectura del proyecto de desarrollo (`chore/dev-smoke`), explicación de `rls_auto_enable`, arreglo de un test e2e inestable. Tests de base: **161/161 OK**. Ver `docs/REVISION-PENDIENTE.md`.
* Panel: el dueño lo levantó en Codespaces y "anda"; falta la validación completa del mostrador.

## Marketing (solo documentos)

`docs/marketing/`: nombre recomendado **Vueltita** (falta verificar INPI y nic.ar), marca y colores, análisis de mercado con fuentes, precios propuestos, guion de ventas y textos de la web. No cambia el backlog ni el código.

## Sábado 10, madrugada — cupones reforzados, Wallet y análisis de oportunidades

* Revisión de los 19 commits hechos con Claude Code (cupones, simulacro de backup): sin fugas entre negocios; arreglado que un cupón contara sin visita, el doble paso del mostrador, módulo apagado, códigos con azar seguro, auto-canje, script de backup seguro (D-027). Archivos de migraciones 18–21 renombrados a las versiones de desarrollo.
* **Google Wallet / Apple Wallet** (D-028): Edge Function `wallet`, tablas y cola de avisos, botones en la tarjeta; sin credenciales todavía (pasos en `docs/WALLET.md`).
* **Tarjeta de sellos** (D-030): la tarjeta web y el Wallet muestran casilleros que se llenan con el logo del negocio.
* **`docs/OPORTUNIDADES.md`**: 30 oportunidades con evidencia y hoja de ruta de 90 días (D-029).

## Current blockers

**Para probar lo nuevo:** (1) Data API → Exposed schemas → agregar `loyalty` (verificado 17:10: todavía no está). Las migraciones 18–20 ya están aplicadas. Guía: `docs/GUIA-PRUEBA-COMPLETA.md`.

**Fase 6 (mensajería real con WhatsApp API) es checkpoint humano:** cuenta de Meta Business, número verificado, plantillas aprobadas y costos por mensaje. No se avanza sin decisión del dueño.


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
