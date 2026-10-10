# Plan de trabajo para Claude Code (2026-10-10)

> Para el dueño: abrí Claude Code en el proyecto y escribí:
> **"Leé docs/PLAN-CLAUDE-CODE.md y hacé la tarea 1. Cuando termine, seguí con la siguiente."**
> Hacé una tarea por vez. Así ves el avance y no se gastan créditos de golpe.

## Reglas para Claude Code (leer antes de cada tarea)

1. Leer `CLAUDE.md`, `docs/ARCHITECTURE.md`, `DECISIONS.md` y la parte de `docs/OPORTUNIDADES.md` que nombra la tarea.
2. Una rama por tarea (`feat/<nombre>`), partiendo de `main` actualizado. CI verde antes de hacer merge (`git merge --no-ff`) a `main`.
3. Reglas de base de datos de `CLAUDE.md`:
   - multi-tenant con `business_id` + RLS;
   - funciones `security definer set search_path = ''`;
   - cada migración termina con `revoke execute ... from public, anon` (en loyalty, volver a dar `grant execute on function loyalty.get_card(text) to anon`);
   - toda función nueva que use un usuario va al meta-test `001-security-meta.test.sql`;
   - visitas solo con `core.record_visit()`;
   - mensajes solo por las campañas del núcleo, con consentimiento y baja.
4. **Funciones para usuarios sin cuenta (anon)** (alta por QR, canje desde el celular, encuestas):
   - se construyen y se prueban;
   - **no se aplican en Supabase hasta que las revise el mentor**;
   - avisar al dueño.
5. Migraciones comunes (no destructivas) en desarrollo:
   - se aplican sin preguntar (D-019) si el CI está en verde;
   - se anotan en `PROGRESS.md`.
6. Nada de producción, pagos reales, WhatsApp real ni credenciales inventadas. Eso queda documentado como "Checkpoint del dueño".
7. Al terminar cada tarea, actualizar:
   - `PROGRESS.md`;
   - `DECISIONS.md`, si hubo una decisión;
   - `TASKS.md`.
8. Hablarle al dueño en español simple.

## Estado de partida

- `main` está en `0b2555d` con CI verde.
- Migraciones 22–24 (`core_coupons_hardening`, `loyalty_wallet`, `loyalty_wallet_stamps`): **aplicadas** en desarrollo el 2026-10-10 (archivos renombrados a `20261010141212`, `141302` y `141333`).
- Pendiente de revisión del mentor: migraciones 11–14 (ramas `feat/equipo-y-privacidad` y `feat/proteger-duenos`).

## Tareas (en este orden)

### 1. Recuperación automática (lo más importante del producto)

> **Hecha** (2026-10-10, D-031): en `main` y aplicada en desarrollo (migración `20261010144420_core_automations`). Ver `docs/RECUPERACION-AUTOMATICA.md`.

Hoy el dueño arma las campañas a mano y manda cada wa.me uno por uno. Tiene que pasar solo.

**Configuración por negocio:** dueño o admin, apagada por defecto.

**Tres automatizaciones:**
- **En riesgo:** cliente con 2 visitas o más que lleva sin venir más que su intervalo habitual × 2 (como mínimo 14 días). Con pocos datos, 30 días fijos.
- **Segunda visita:** a los 10 días de la primera, si no volvió.
- **Cumpleaños:** se agregan `birth_day` y `birth_month` (sin año) en `core.customers` y se editan en la ficha del cliente.

**Motor diario:**
- `core.run_automations()`, ejecutado con pg_cron (condicional, como en `20261009014518`).
- Idempotente: correrlo dos veces no duplica nada.
- Reutiliza campañas, grupo de control, cupones y atribución (D-021, D-023, D-026, D-027).
- Solo escribe a clientes con consentimiento y sin baja (`core.whatsapp_marketing_granted`).
- Cooldown de 30 días por automatización; cumpleaños, una vez por año.
- No incluye a quien ya está en otra campaña abierta (`core.in_open_campaign`).

**Cola de envío:**
- Tabla `core.outbox` con el proveedor `manual` por defecto.
- El dueño ve "Hoy hay N mensajes listos" y manda cada uno con un toque de wa.me.
- Documentar en `docs/RECUPERACION-AUTOMATICA.md` cómo se conectaría la API oficial de WhatsApp (costo aproximado: USD 0,06 por mensaje de marketing) y los avisos de la wallet. Las dos son Checkpoint.

**UI en el módulo recovery:**
- pantalla "Automático" con interruptor, días y texto con vista previa;
- bandeja "Mensajes listos";
- tarjeta en Inicio.

**Tests pgTAP:**
- intervalos;
- zona horaria (cumpleaños del 1/1 visto desde UTC-3);
- idempotencia;
- cooldown;
- consentimiento;
- grupo de control;
- aislamiento entre negocios;
- roles;
- automatización apagada.

### 2. Alta por QR + plantillas + cartel (OPORTUNIDADES #2 y #6)

> **Ya empezada:** la rama `feat/alta-por-qr` (commit `37561c8`) tiene la parte de base de datos hecha (migración + tests 042/043 + meta-test). Falta: revisar que el CI esté verde, las pantallas (alta pública, plantillas, cartel, avisos) y el SDK. Continuar sobre esa rama, no empezar de cero.

**Alta por QR:**
- Ruta pública en la app cliente: `/alta/<codigo-publico-del-negocio>`.
- El cliente carga nombre y celular, más dos casillas separadas sin tildar: términos (obligatoria) y WhatsApp (opcional).
- Recibe su tarjeta (D-020).
- Función anon `loyalty.self_signup`, que llama a una función interna de core.
  - Requiere el alta activada (apagada por defecto) y el módulo loyalty activo.
  - Límite de intentos por negocio.
  - **Si el teléfono ya existe:** no revelar nada, no devolver la tarjeta y no cambiar el consentimiento. Responder un mensaje genérico y dejar un aviso para que el local reenvíe la tarjeta.
  - No da puntos por anotarse.
  - **Revisión del mentor antes de aplicar.**

**Plantillas por rubro:**
- `loyalty.apply_template(kind, overwrite)` para cafetería, heladería, panadería, barbería, petshop y otro.
- Solo dueño o admin.
- No pisa un programa con movimientos salvo con `overwrite`.

**Cartel imprimible:**
- Lleva el QR, el logo, los colores y "Sumate al club: tu 9.º café es gratis".
- Formato A4/A5 con `@media print` y botón "Imprimir / Guardar PDF".

**Lista "Avisos del alta"** con el botón para reenviar la tarjeta.

### 3. Conexión con cajas (las visitas entran solas, sin escanear nada)

**Puerta de entrada de ventas:**
- Edge Function `sales-ingest`.
- Clave por negocio, generada por nuestro sistema y guardada con hash.
- Recibe venta, monto, número de comprobante y, opcionalmente, celular, DNI o código de socio.
- Deduplica por comprobante.
- Crea la visita con `core.record_visit`: identificada si coincide un cliente; si no, queda sin identificar y cuenta igual para las estadísticas.

**También:**
- pantalla en Mi negocio para generar y revocar la clave;
- un simulador para probar;
- tests.

**Documentar en `docs/CAPTURA-AUTOMATICA.md`:**
- Mercado Pago: OAuth, webhook, vinculación pagador ↔ cliente y una prueba técnica de 2–3 días.
- Fudo (requiere su plan Pro).
- Las dos son Checkpoint de credenciales.

### 4. Botón "Poner en mi pantalla de inicio" + exportar CSV

**Botón en la tarjeta del cliente:**
- Android: `beforeinstallprompt`.
- iPhone en Safari: hoja con 2 pasos ilustrados (Compartir → Agregar a inicio). En iPhone con otro navegador: "abrilo en Safari".
- Se oculta si ya está instalada y se puede cerrar con "Ahora no".
- Verificar que la app instalada no pierda el link secreto de la tarjeta.

**Exportar "Tus clientes son tuyos" (#9):**
- `core.export_customers()`, `core.export_visits(desde, hasta)` y, si el módulo está activo, `loyalty.export_ledger`.
- Solo dueño o admin, y queda en la auditoría.
- El CSV se arma con `sdk/csv.ts`, escapando las fórmulas.

### 5. Resumen de los lunes para el dueño (#5, #20)

**`core.weekly_digest()`:**
- visitas contra el promedio de las 4–8 semanas anteriores, con alerta si bajan más de 20 %;
- clientes nuevos;
- clientes recuperados;
- 3 habituales en riesgo;
- alertas raras: muchas visitas del mismo cliente con el mismo empleado, o anulaciones por encima de lo normal;
- una sola acción sugerida.

**Dónde aparece:**
- página "Resumen de la semana" y tarjeta en Inicio;
- botón "Mandármelo por WhatsApp" que arma un wa.me al teléfono del dueño.
- El envío por mail queda documentado como Checkpoint.

### 6. Traé un amigo + reseñas en Google (#7, #8)

**Traé un amigo (en loyalty):**
- Cada socio tiene su código o link de invitación.
- El premio para los dos se da solo con la **primera visita real** del amigo: una sola vez, respetando los topes; las visitas importadas no cuentan.
- Configurable y apagado por defecto.
- Ranking "Quién trae más gente".

**Reseñas (en core):**
- El dueño pega su link de reseñas de Google.
- Después de la visita, la tarjeta pregunta "¿Cómo te atendimos?".
- **A todos** se les ofrece el link de Google, sin premio. Google prohíbe premiar o filtrar reseñas.
- Con 3 o menos, aviso privado al dueño.
- La función anon de la encuesta necesita **revisión del mentor**.

### 7. Canje desde el celular (#10)

- El cliente elige el premio y aparece un código + QR que vence en 5 minutos.
- El cajero lo escanea o lo tipea y confirma; ahí se descuenta con el canje que ya existe.
- Funciones:
  - `loyalty.request_redemption` (anon);
  - `find_redemption_request` y `confirm_redemption_request` (staff), idempotentes.
- **Revisión del mentor.**

### 8. Mostrador inteligente (#15, #19, #14)

- **Al encontrar al cliente:** "Ana · hace 2 años · visita 50 · viene cada ~9 días", más una nota corta. Con `core.customer_snapshot`.
- **Ranking del equipo de la semana:** `core.team_week_stats`.
- **Valor del cliente en pesos:** solo con los montos cargados; si no hay, no inventar.
- **Top 10 clientes.**
- **Resumen del mes como imagen para compartir:** solo con números que calcula Postgres.

### 9. Estilo Apple en todas las vistas (al final)

**Referencia:** el archivo de estilo Apple que pasó el dueño.

**Colores:**
- fondo `#f5f5f7`;
- tarjetas blancas;
- texto `#1d1d1f`, secundario `#707070`;
- líneas `#d6d6d6`;
- **un solo color de acción:** `#0071e3` en los botones llenos y `#0066cc` en los links.

**Tipografía:** `system-ui` / SF Pro. Cuerpo de 17px, títulos de 40–56px con peso 600.

**Formas:**
- botones "pastilla": `border-radius: 980px`, padding `11px 21px`, texto de 14px;
- barra de arriba de 44px, translúcida (`backdrop-filter: saturate(1.8) blur(20px)`);
- ancho máximo de 980px.

**Prohibido:**
- sombras;
- secciones separadas por bordes: se separan por el tono del fondo;
- más de un color de acción.

**Cómo:**
- poner los tokens en el `@theme` de Tailwind 4 de `packages/ui`;
- aplicarlos en el admin y en el cliente;
- sacar fotos (capturas) con Playwright para revisar.

## Al terminar todo

Dejar al dueño una lista corta y en español simple:
- qué quedó hecho;
- qué migraciones esperan al mentor;
- qué cuentas tiene que abrir él: Google Wallet, Apple Developer, Cloudflare, WhatsApp Business y Mercado Pago.

---

## Anexo A — Lo que ya se investigó del código (para no volver a leerlo todo)

**Campañas y recuperación (core):**
- Las funciones existentes viven en `20261009184605_core_campaigns.sql`, `20261009222648_core_campaigns_hardening.sql` y `20261009225015_core_campaign_coupons.sql`:
  - `core.validate_segment`, `core.segment_members`, `core.preview_segment`;
  - `core.create_campaign`, `core.launch_campaign` (sortea el grupo de control y genera los cupones), `core.cancel_campaign`;
  - `core.mark_recipient_contacted` (lo que hoy marca el wa.me como mandado), `core.list_campaign_recipients`;
  - `core.campaign_results` (atribución vs. control), `core.dashboard_summary`;
  - `core.whatsapp_marketing_granted(business, customer)` (consentimiento vigente) y `core.in_open_campaign(business, customer)`;
  - cupones: `core.new_coupon_code`, `core.normalize_coupon_code`, `core.coupon_info`, `core.find_campaign_coupon`.
- `core.redeem_campaign_coupon` **se borra** en `20261010141212_core_coupons_hardening`. La reemplaza `core.record_visit_with_coupon(uuid,text,uuid,bigint)`: usar esa.
- Frontend de recuperación: `apps/admin/src/modules/recovery/`. Ahí están `RecoveryPage`, `NewCampaignPage`, `CampaignPage`, `RecipientsList`, `CampaignResultsCard`, `CouponCounterPanel`, `previewText.ts` (vista previa del mensaje con variables) y `queries.ts`.
- pg_cron condicional: copiar el patrón de `20261009014518_core_audit_storage_jobs.sql` (líneas ~150–165). Si no existe pg_cron, solo avisa y sigue, así los tests locales no fallan.

**Piezas reutilizables:**
- Escáner de QR del mostrador: `apps/admin/src/features/counter/QrScanner.tsx`, `qrSupport.ts` y `apps/admin/src/modules/useCustomerCodeMatch.ts`.
- Paneles enchufables: `apps/admin/src/modules/CounterModulePanels.tsx` (mostrador) y `CustomerModulePanels.tsx` (ficha del cliente); se registran en `modules/registry.ts`.
- Tarjeta del cliente: `apps/client/src/card/` (`CardPage`, `StampCard`, `Rewards`, `Movements`, `MemberQr`, `WalletButtons`, `useDocumentBranding`).
- Link guardado en el celular: `apps/client/src/savedToken.ts`.
- Archivos de la app instalable: `apps/client/public/manifest.webmanifest`, `sw.js` y `_headers`. El service worker **nunca** cachea respuestas de Supabase (D-024).
- Helpers del SDK: `packages/sdk/src/csv.ts` (CSV), `phone.ts` (normalizar celulares), `money.ts` (centavos), `dates.ts` (zona horaria), `errors.ts` (mensajes de error amigables) y `branding.ts` (logo y colores).
- `loyalty.get_card(text)` es hoy la **única** función anon y el meta-test lo controla. Para mostrar algo nuevo en la tarjeta, mantener su firma.
- Puntos: el trigger `loyalty.handle_core_event` sobre `core.events` es el que acredita (D-018). Visitas antedatadas más de 30 minutos o importadas no dan puntos, y hay topes `max_points_per_visit` y `max_visits_per_day` (D-022). Un premio "por primera visita" (referidos) va en ese mismo handler.

## Anexo B — Cómo probar sin gastar de más

- **Tests de base local:**
  - Arrancar Postgres con `service postgresql start`.
  - Correr `su postgres -c "PGUSER=postgres bash scripts/db-test-local.sh"`. Con `TEST_DB=<nombre>` usa otra base, útil si corren dos cosas a la vez.
  - En Codespaces: `supabase test db`.
- **Formato:** `npx prettier --write <archivos>` antes de commitear, porque el CI corre `format:check`.
- **ESLint (react-refresh):**
  - un `.tsx` solo exporta componentes; los helpers van a un `.ts` aparte;
  - TypeScript usa `noUncheckedIndexedAccess`, así que hay que chequear `undefined` al leer `array[i]`.
- **Bots del CI:**
  - "DB types" regenera `packages/sdk/src/database.types.ts` cuando cambian migraciones; "Lockfile" actualiza `package-lock.json`.
  - Sus commits **no disparan el CI**: después hacer `git pull --rebase`, luego `git commit --allow-empty -m "chore: trigger ci"`, y push.
  - Si el código usa funciones nuevas, el typecheck falla hasta que el bot regenera los tipos. Es normal.
- **Ver errores del CI sin bajar logs:**
  - `gh run list --branch <rama>`;
  - `gh run view <id> --json jobs`;
  - `gh api repos/lennyguido/fidelizacion-saas/check-runs/<job_id>/annotations`.
- **e2e:**
  - Playwright levanta el admin en el puerto 4173 y el cliente en el 4174.
  - Login y alta comparten etiquetas de campos: esperar la URL `/signup` antes de llenar.
- **Supabase por MCP:** `apply_migration` puede volver "cancelled" si la migración tiene DROP, DELETE o REVOKE ALL, porque pide una confirmación. En ese caso aplicarla con `supabase db push` o pegarla en el SQL Editor.
- **Datos de PostgREST:** `business_id` no tiene permiso de UPDATE por columna, así que usar update-o-insert y no `upsert`.
- **Usar un solo agente por vez.** Lanzar muchos en paralelo agota los créditos en minutos.

## Anexo C — Números reservados (para que las ramas no choquen)

| Tarea | Rama | Migración | Tests DB |
|---|---|---|---|
| 1 Recuperación automática | `feat/recuperacion-automatica` | `20261011020000` | `044-`, `045-` |
| 2 Alta por QR | `feat/alta-por-qr` | `20261011010000` (+`010100`) | `042-`, `043-` |
| 3 Conexión con cajas | `feat/conexion-cajas` | `20261011000000` | `040-`, `041-` |
| 4 Instalar + CSV | `feat/instalar-y-exportar` | `20261011030000` | `048-` |
| 5 Resumen de los lunes | `feat/resumen-semanal` | `20261011035000` | `050-` |
| 6 Referidos + reseñas | `feat/referidos-y-resenas` | `20261011040000` (+`040100`) | `046-`, `047-` |
| 7 Canje desde el celular | `feat/canje-desde-celular` | `20261011050000` | `026-` |
| 8 Mostrador inteligente | `feat/mostrador-inteligente` | `20261011060000` | `049-` |

> Si se hacen en orden y de a una, se puede usar la hora real como timestamp. Lo único que importa es que cada migración nueva tenga un número **mayor** que la última aplicada.

## Anexo D — Detalles por tarea que ya se pensaron

**1. Recuperación automática**
- Si el motor arma "una campaña automática por automatización y por día", el grupo de control, los cupones y la atribución funcionan sin código nuevo.
- Plantilla del mensaje con `{nombre}`, `{negocio}` y `{cupon}`, reutilizando `previewText.ts`.
- Estados de `core.outbox`: `queued`, `sent`, `failed` y `manual`. Proveedores: `manual`; más adelante `whatsapp_cloud` y `wallet_push`.
- No hacer todavía el "aviso de puntos por vencer": el dueño tiene que decidir la regla de vencimiento.

**2. Alta por QR**
- Límite sugerido: 30 altas por hora por negocio.
- El consentimiento se guarda con fecha y fuente `self_signup` (Ley 25.326).
- Si se pide el cumpleaños en el formulario, usar las columnas que crea la tarea 1. Por eso conviene hacer la 1 antes.
- Textos por rubro, por ejemplo:
  - cafetería: "8 cafés y el 9.º va de regalo";
  - barbería: "5 cortes y el 6.º gratis";
  - heladería: "cada 6 cuartos, uno de regalo".

**3. Conexión con cajas**
- Muchos locales chicos solo tienen controladora fiscal o QR de Mercado Pago, sin API. Por eso **Mercado Pago es la integración clave en Argentina**.
- Antes de prometerla, hacer la prueba técnica: ¿llegan avisos de los cobros con el QR de siempre o solo de las órdenes creadas por la API?
- Fudo: API solo en el plan Pro, tokens que vencen cada 24 h y sin webhooks (hay que consultar cada pocos minutos).
- Las ventas sin cliente identificado cuentan igual para el detector de semanas flojas.
- **Se descartó** que el cliente o el cajero escaneen el QR del ticket fiscal: el dueño prefiere integrarse con la caja.

**4. Instalar en inicio**
- En iPhone no existe `beforeinstallprompt`.
- Detectar Safari: con CriOS o FxiOS en el user agent, decir "abrilo en Safari".
- Para saber si ya está instalada: `matchMedia('(display-mode: standalone)')` o `navigator.standalone`.
- Recordar el "Ahora no" en localStorage, siempre dentro de try/catch.

**6. Referidos y reseñas**
- Referidos:
  - el código de invitación es distinto del link secreto y del código de socio;
  - se bloquean el auto-referido y los ciclos;
  - el amigo tiene que ser un cliente sin visitas.
- Reseñas:
  - links válidos de Google: `g.page`, `google.com`, `maps.app.goo.gl` y `search.google.com`;
  - la encuesta solo aparece si hubo una visita en las últimas 48 h, una vez por visita, con límite de intentos.

**7. Canje desde el celular**
- Código de 6 caracteres sin letras ambiguas, único entre los pedidos vivos del negocio.
- Un solo pedido vivo por tarjeta: uno nuevo reemplaza al anterior.
- Mientras hay un pedido vivo, la tarjeta consulta cada pocos segundos (TanStack Query) para mostrar "¡Canjeado!".

**8. Mostrador inteligente**
- Si no existe el concepto de "visita sin identificar", el ranking del equipo muestra visitas registradas y clientes dados de alta por persona.
- Staff ve el ranking sin números de los demás.
