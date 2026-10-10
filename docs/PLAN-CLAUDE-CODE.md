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
- Migraciones **sin aplicar** en desarrollo: `20261010031000_core_coupons_hardening`, `20261010120000_loyalty_wallet` y `20261010160000_loyalty_wallet_stamps`.
  - Aplicarlas primero, en ese orden: con `supabase db push` o pegándolas en el SQL Editor.
  - El cupón en el mostrador falla hasta que estén aplicadas.
- Pendiente de revisión del mentor: migraciones 11–14 (ramas `feat/equipo-y-privacidad` y `feat/proteger-duenos`).

## Tareas (en este orden)

### 1. Recuperación automática (lo más importante del producto)

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
