# Arquitectura de la plataforma

> Documento de referencia. Si una tarea contradice este documento, se detiene y se pregunta.
> Las decisiones resumidas están en `DECISIONS.md`.

## 1. Idea central

No construimos "un SaaS de fidelización". Construimos **una plataforma para negocios locales** con:

* un **núcleo** (`core`) que resuelve lo que todos los productos necesitan, y
* **módulos** (`loyalty`, `recovery`, `booking`, `reputation`, …) que se venden por separado o juntos.

Fidelización + Recuperación es el primer producto. Los siguientes (turnos, reputación, WhatsApp vendedor, detector de pérdidas, club VIP) se construyen encima del mismo núcleo sin rehacerlo.

```text
                    ┌────────────────────────────────────────────┐
                    │                 CORE (núcleo)              │
                    │ negocios · usuarios · roles · sucursales   │
                    │ clientes · consentimientos                 │
                    │ VISITAS (el dato central) · estadísticas   │
                    │ segmentos · campañas · atribución          │
                    │ mensajería · integraciones · webhooks      │
                    │ suscripciones · módulos habilitados        │
                    │ branding · dominios · archivos · auditoría │
                    │ eventos · jobs                             │
                    └───────────────▲──────────────▲─────────────┘
                                    │              │
        ┌────────────┬──────────────┼──────────┬───┴────────┬─────────────┐
        │ loyalty    │ recovery     │ booking  │ reputation │ seller ...  │
        │ puntos     │ riesgo       │ turnos   │ reseñas    │ WhatsApp    │
        │ sellos     │ campañas de  │ agenda   │ Google     │ catálogo    │
        │ recompensas│ recuperación │ huecos   │            │             │
        │ canjes     │ $ recuperado │ libres   │            │             │
        │ niveles VIP│              │          │            │             │
        └────────────┴──────────────┴──────────┴────────────┴─────────────┘
```

### Regla de oro

**Los módulos dependen del núcleo, nunca entre sí.**
Un módulo lee/escribe sus propias tablas y las del núcleo (mediante funciones del núcleo). Si `booking` necesita que `loyalty` dé puntos por un turno, `booking` registra una **visita** en el núcleo y `loyalty` reacciona a esa visita. Ninguno conoce al otro.

---

## 2. Forma del sistema: monolito modular

* **Un** repositorio, **un** proyecto Supabase por entorno, **una** base de datos.
* Separación lógica por **esquemas de Postgres**: `core`, `loyalty`, `recovery`, `booking`, …
* Sin microservicios. Es lo correcto para el tamaño del equipo y del producto: un solo deploy, transacciones reales entre núcleo y módulos, y separación clara igual.

### Dónde vive cada tipo de lógica

| Tipo de lógica | Dónde | Ejemplo |
|---|---|---|
| Reglas que no se pueden romper (dinero, puntos, canjes, estados) | Funciones de Postgres (RPC) + constraints + triggers | `loyalty.redeem_reward()` |
| Permisos y aislamiento entre negocios | RLS + funciones helper del núcleo | `core.is_member(business_id)` |
| Integraciones con terceros, webhooks, secrets | Supabase Edge Functions | enviar WhatsApp, webhook de Mercado Pago |
| Procesos periódicos | `pg_cron` | recalcular riesgo cada noche |
| Trabajo asíncrono | cola (Supabase Queues / `pgmq`) | envío masivo de una campaña |
| Presentación, formularios, UX | Frontend React | pantallas |

**El frontend nunca calcula nada que importe.** No suma puntos, no decide si un canje es válido, no calcula estados. Solo muestra y llama funciones.

---

## 3. Multi-tenancy (aislamiento entre negocios)

### 3.1 Entidades

```text
auth.users            (Supabase Auth: personas que inician sesión)
core.businesses       (el tenant: "Café Central")
core.locations        (sucursales; todo negocio tiene al menos una)
core.memberships      (usuario ↔ negocio, con rol: owner | admin | staff)
core.platform_admins  (tu empresa; nunca se resuelve desde el frontend)
```

* Un usuario puede pertenecer a varios negocios (un dueño con dos locales, un empleado que trabaja en dos).
* El frontend tiene un "negocio activo"; todas las consultas filtran por él, pero **la seguridad la garantiza RLS, no el filtro**.

### 3.2 Reglas obligatorias para toda tabla de negocio

1. Columna `business_id uuid not null references core.businesses(id)`.
2. RLS habilitado.
3. Índice que empiece por `business_id`.
4. **Foreign keys compuestas** cuando una tabla referencia a otra del mismo negocio, para que sea imposible mezclar negocios aunque haya un bug:

```sql
-- core.customers tiene: unique (business_id, id)
create table core.visits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references core.businesses(id),
  customer_id uuid,
  foreign key (business_id, customer_id)
    references core.customers (business_id, id)
  -- una visita del negocio A no puede apuntar a un cliente del negocio B
);
```

### 3.3 Helpers de RLS (se escriben una vez y los usa todo módulo)

Para **policies** se usan funciones que devuelven conjuntos, con el patrón
`business_id in (select core.my_business_ids())`, que Postgres evalúa una sola vez por consulta (no por fila):

```sql
core.my_business_ids()                          -- negocios donde soy miembro activo
core.my_business_ids_with_role(array['owner','admin'])
core.my_business_ids_with_module('loyalty')      -- mis negocios con el módulo activo
core.my_customer_ids()                           -- mis fichas como cliente final
```

Dentro de **funciones** se usan las variantes booleanas: `core.is_member()`, `core.has_role()`, `core.has_module()` y `core.require_member()` (lanza 403).

Todas son `security definer`, `stable`, `set search_path = ''`.

Ejemplo de policy típica de un módulo:

```sql
create policy rewards_select on loyalty.rewards
  for select to authenticated
  using (business_id in (select core.my_business_ids_with_module('loyalty')));
```

**Permisos de funciones:** Postgres permite ejecutar cualquier función nueva a todos (`PUBLIC`). Cada migración termina con `revoke execute on all functions in schema <esquema> from public, anon;` y se habilita explícitamente lo que el usuario puede llamar. El meta-test compara la lista exacta de funciones ejecutables por `authenticated`.

### 3.4 Escrituras críticas solo por función

Para tablas sensibles (movimientos de puntos, canjes, atribuciones) **no hay policy de insert/update para el cliente**. Se escriben exclusivamente mediante funciones que validan todo dentro de una transacción. Así no hay forma de "regalarse puntos" desde la consola del navegador.

### 3.5 Meta-test de seguridad

Un test de base de datos recorre **todas** las tablas de los esquemas de negocio y falla si alguna:

* no tiene RLS habilitado,
* no tiene `business_id`,
* no tiene índice por `business_id`.

Cuando se agrega un módulo nuevo y alguien se olvida de algo, el test lo frena. Además, cada módulo tiene tests de "el negocio A intenta leer/escribir datos del B → rechazado".

---

## 4. Clientes: identidad separada de la participación

Este es el punto que permite medir a **todos** los clientes, incluido el señor que no quiere puntos ni app.

```text
core.customers          → la persona conocida por el negocio (nombre, teléfono, email, cumpleaños, notas, tags)
core.customer_consents  → qué aceptó y cuándo (mensajes por WhatsApp, email, marketing)
loyalty.members         → SI la persona se sumó al programa de puntos (opcional)
```

* Un cliente puede existir **sin** estar en el programa de puntos. Sus visitas se registran igual, por lo que se calculan frecuencia, riesgo y gasto.
* Mismo humano en dos negocios = dos filas distintas en `core.customers` (cada negocio tiene sus datos; privacidad).
* Teléfono normalizado a formato internacional (E.164). Único por negocio cuando existe.
* Un cliente puede registrarse con solo un nombre o un apodo ("Don Carlos, cortado") y completar datos después.

### 4.1 Niveles de identificación (de menor a mayor)

| Nivel | Cómo se registra la visita | Qué se puede medir |
|---|---|---|
| Anónimo | botón "+1 visita" sin cliente | ventas y visitas totales del negocio, tendencias (detector de pérdidas a nivel negocio) |
| Conocido sin app | el empleado lo busca por nombre o teléfono | frecuencia, riesgo, gasto, recuperación de esa persona |
| Miembro del programa | escanea su QR / se identifica | todo lo anterior + puntos, recompensas, campañas |

### 4.2 Privacidad (Ley 25.326 de Protección de Datos Personales)

* Sin consentimiento registrado en `core.customer_consents` **no se envían mensajes**. Lo controla la mensajería del núcleo, no cada módulo.
* Opt-out en todos los mensajes.
* Función `core.anonymize_customer()` para pedidos de baja: borra datos personales, conserva visitas anónimas para que las métricas del negocio no se rompan.

### 4.3 Clientes finales que inician sesión

* Usan Supabase Auth (OTP por teléfono/email o magic link; se decide en la sección 15 de `TASKS.md`).
* `core.customer_accounts` vincula un `auth.users` con sus filas en `core.customers` (una por negocio).
* Un usuario de Auth puede ser empleado de un negocio y cliente de otro; los permisos salen de `memberships` vs `customer_accounts`, nunca de un campo "tipo de usuario".

---

## 5. Visitas: el dato central

Todos los productos de la lista se alimentan de lo mismo: **"este cliente vino a este negocio en este momento (y opcionalmente gastó X)"**.

```text
core.visits
  id
  business_id
  location_id
  customer_id        (nullable → visita anónima)
  occurred_at
  amount_minor       (nullable, en centavos, bigint)
  currency           (por defecto la del negocio, ARS)
  source             manual | qr_customer | qr_business | booking | import | mercadopago | pos
  source_ref         id externo (ticket, pago, turno)
  created_by         empleado que la registró
  unique (business_id, source, source_ref)   ← idempotencia: el mismo pago no entra dos veces
```

Quién crea visitas:

* **Mostrador** (fidelización): el empleado escanea el QR del cliente o lo busca; monto opcional.
* **Turnos** (booking): un turno marcado como "asistió" crea la visita sola → cero carga manual.
* **Pagos** (integración futura con Mercado Pago u otros): un webhook crea la visita.
* **Importación** CSV: historial inicial.

Siempre a través de una sola función: `core.record_visit(...)`. Esa función:

1. valida negocio, sucursal, cliente y permisos;
2. inserta la visita (idempotente);
3. actualiza `core.customer_stats`;
4. emite el evento `visit.recorded`.

Los módulos reaccionan al evento (por ejemplo, `loyalty` acredita puntos si el cliente es miembro y el módulo está activo).

### 5.1 Dinero

* Siempre en **unidades menores** (`bigint`, centavos), nunca `float`.
* Moneda por negocio.
* Contexto argentino: con inflación, "1 punto cada $1.000" queda viejo rápido. Las reglas de puntos deben poder ser por **visita** o por **monto ajustable**, y las métricas de dinero muestran el mes en curso y la comparación con el mismo período, no solo totales históricos.

### 5.2 Zona horaria

Cada negocio tiene `timezone` (por defecto `America/Argentina/Buenos_Aires`). Toda estadística "por día / por mes" se calcula en la hora local del negocio, no en UTC.

---

## 6. Estadísticas y estados del cliente

```text
core.customer_stats            (1 fila por cliente; se actualiza en cada visita y cada noche)
  first_visit_at, last_visit_at, visit_count, total_spend_minor, avg_ticket_minor,
  median_interval_days, expected_next_visit_at, status, risk_score, updated_at

core.customer_status_history   (cada cambio de estado, con fecha)
```

Estados: `NEW → ACTIVE → AT_RISK → INACTIVE → RECOVERED → ACTIVE`.

* El riesgo se calcula según el ritmo propio de cada cliente (mediana de días entre visitas), con valores por defecto configurables por negocio cuando hay pocas visitas.
* Un job nocturno (`pg_cron`) recalcula a todos porque "no venir" no genera ningún evento.
* El historial de estados es lo que después permite demostrar "estaba en riesgo cuando le escribimos".

Esto vive en el **núcleo** porque lo usan: recuperación, detector de pérdidas, club VIP, campañas, reputación ("pedir reseña solo a clientes frecuentes").

---

## 7. Segmentos, campañas y atribución (núcleo)

Varios módulos mandan campañas (recuperación, VIP, cumpleaños, reseñas, vendedor). Por eso esto es del núcleo.

```text
core.segments              definición (JSON validado) → se compila a una consulta segura en SQL
core.campaigns             objetivo, segmento, mensaje, beneficio, canal, estado, módulo dueño
core.campaign_recipients   cliente, estado del cliente al enviar, is_control, enviado_en, mensaje
core.attributions          campaña ↔ visita, tipo (cupón | ventana de tiempo), ventana en días
```

* **Grupo de control:** un porcentaje configurable de destinatarios (10–20%) elegidos al azar no recibe el mensaje. Permite calcular lo **incremental**.
* **Atribución:**
  * directa: el cliente usó el código/cupón de la campaña;
  * por ventana: volvió dentro de N días después de recibirla.
* **Dinero recuperado** se muestra en dos números: total gastado por los que volvieron, y estimación incremental (comparando con el grupo de control). Fórmulas documentadas y testeadas.

---

## 8. Mensajería (núcleo)

Un solo lugar para enviar cualquier mensaje, con un solo lugar donde se controla el consentimiento.

```text
core.message_templates     plantillas por negocio y canal (las de WhatsApp requieren aprobación de Meta)
core.messages              cada envío: canal, destinatario, estado, id del proveedor, costo, error
core.conversations         (futuro: WhatsApp vendedor, respuestas entrantes)
```

* Edge Function `send-message` con **adaptadores por proveedor** (WhatsApp Cloud API, email, …). Cambiar de proveedor no toca los módulos.
* Antes de enviar: consentimiento, opt-out, horario permitido, límite por cliente (no saturar), límite por negocio (costos).
* Envíos masivos pasan por la cola; cada mensaje es un trabajo con reintentos.
* Webhooks de estado (entregado, leído, falló, respuesta) actualizan `core.messages`.

---

## 9. Integraciones y webhooks (núcleo)

```text
core.integrations     negocio, proveedor (mercadopago, whatsapp, google_business, ...), estado, config
core.webhook_events   registro de cada webhook recibido (id externo único → idempotencia, reintento seguro)
```

* Secrets de terceros en **Supabase Vault**, nunca en tablas legibles ni en el frontend.
* Cada webhook verifica la firma del proveedor antes de procesar nada.

---

## 10. Suscripciones y módulos habilitados (núcleo)

```text
core.modules               catálogo: loyalty, recovery, booking, reputation, seller, ...
core.plans                 planes comerciales y qué módulos/límites incluyen
core.subscriptions         negocio, plan, estado (trial | active | past_due | cancelled), fechas
core.business_modules      negocio, módulo, habilitado, límites (jsonb), desde
```

* `core.has_module()` se usa en RLS **y** en el frontend (el menú solo muestra lo contratado).
* El cobro real (Mercado Pago suscripciones u otro) se conecta después; el modelo ya está listo y no bloquea el MVP.
* Límites (ej. mensajes por mes) se controlan en el núcleo.

---

## 11. Branding, dominios y archivos (núcleo)

```text
core.businesses     name, slug (único), logo_path, colores, timezone, currency, settings
core.domains        negocio, host (club.negocio.com), verificado, fecha
```

* La app del cliente resuelve el negocio por `host` o por `slug` y carga su branding (white-label).
* Storage: buckets con ruta `{business_id}/...`; las policies verifican `core.is_member()` usando la primera carpeta de la ruta. Validación de tipo y tamaño.

---

## 12. Eventos, auditoría y jobs (núcleo)

```text
core.events      (outbox) tipo, business_id, payload, creado, procesado
core.audit_log   quién, qué tabla, qué fila, antes, después, cuándo
```

* `core.events` desacopla módulos: el núcleo emite `visit.recorded`, `customer.status_changed`, `campaign.sent`; los módulos se suscriben (trigger o procesador de la cola).
* Auditoría con **un trigger genérico** reutilizable: cualquier tabla de cualquier módulo se audita con una línea en su migración.
* Jobs nocturnos con `pg_cron`: estadísticas de clientes, vencimiento de canjes, limpieza.

---

## 13. Cómo es un módulo

Cada módulo cumple el mismo contrato. Agregar un SaaS nuevo = seguir esta lista.

### 13.1 Base de datos

* Esquema propio (`booking`), migraciones propias con prefijo de módulo en el nombre.
* Tablas con `business_id`, FKs compuestas, RLS usando helpers del núcleo + `has_module`.
* Escrituras críticas como funciones RPC del esquema del módulo.
* Reacciona a eventos del núcleo; nunca lee ni escribe tablas de otro módulo.
* Registrado en `core.modules`.
* Seed de demo propio.
* Tests de base de datos: RLS (cross-tenant), reglas de negocio, abuso.

### 13.2 Frontend

```text
src/modules/<modulo>/
  manifest.ts      id, rutas, ítems de menú, permisos requeridos, panel de configuración
  pages/
  components/
  api/             funciones de acceso a datos tipadas (solo acá se habla con Supabase)
  hooks/
  schemas.ts       validaciones (zod), compartibles con Edge Functions
```

El shell de la app lee qué módulos tiene el negocio activo y monta sus `manifest`. Agregar un módulo no toca el resto de la app.

### 13.3 Mapa de los productos planificados

| Producto | Qué usa del núcleo | Qué agrega |
|---|---|---|
| **Fidelización** (`loyalty`) | clientes, visitas, mensajería | programa, puntos (ledger), sellos, recompensas, canjes, QR, niveles |
| **Recuperación** (`recovery`) | stats, estados, segmentos, campañas, atribución | reglas de riesgo, flujos de recuperación, dashboard de $ recuperado |
| **Club VIP** | segmentos | niveles/beneficios dentro de `loyalty` (no es un módulo aparte) |
| **Detector de pérdidas** | visitas (incluidas anónimas), stats | alertas de caída a nivel negocio y por cliente valioso; puede venderse como parte de `recovery` |
| **Turnos** (`booking`) | clientes, visitas, mensajería | servicios, profesionales, disponibilidad, turnos, huecos libres, recordatorios |
| **Reputación** (`reputation`) | visitas, segmentos, mensajería, integraciones | pedidos de reseña después de la visita, conexión con Google Business Profile |
| **WhatsApp vendedor** (`seller`) | mensajería, conversaciones, clientes | catálogo, respuestas, pedidos |
| **Presencia digital** | branding, archivos | contenido; es el más independiente, se evalúa aparte |

---

## 14. Estructura del repositorio

```text
/
├─ apps/
│  ├─ admin/        app del negocio (dueño/empleados): dashboard + todos los módulos
│  └─ client/       app del cliente final: PWA mobile-first, white-label
├─ packages/
│  ├─ ui/           componentes reutilizables (botón, input, card, tabla, modal…)
│  ├─ sdk/          cliente Supabase tipado, auth, negocio activo, tipos generados, zod
│  └─ config/       configuración compartida de TypeScript / ESLint / Tailwind
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/   core_* primero, después loyalty_*, recovery_*, …
│  ├─ functions/    Edge Functions (send-message, webhooks, …)
│  ├─ tests/        pgTAP: RLS, meta-test, reglas de negocio
│  └─ seed.sql      datos DEMO (Café Central)
├─ docs/
│  └─ ARCHITECTURE.md
└─ CLAUDE.md, TASKS.md, PROGRESS.md, DECISIONS.md, README.md
```

* npm workspaces (sin herramientas extra).
* La app actual en `app/` pasa a `apps/admin/`.
* Dos apps porque el cliente final necesita una app chica, rápida, instalable y con branding del negocio; el panel del negocio es otra cosa.

---

## 15. Librerías del frontend

Sobre el stack ya decidido (React, TypeScript, Vite, Tailwind, Supabase):

* **React Router**: rutas.
* **TanStack Query**: caché y estado del servidor.
* **zod**: validación (frontend y Edge Functions).
* **react-hook-form**: formularios.
* **Vitest** + **Testing Library**: tests de frontend.
* **Playwright**: tests de punta a punta.

Los tipos de la base se generan con `supabase gen types` para todos los esquemas. Nunca se escriben a mano.

---

## 16. Calidad y entornos

* Entornos: **local** (Supabase en Docker), **dev** (proyecto Supabase de desarrollo), **prod** (proyecto separado, solo cuando haya algo probado).
* Toda la base se reconstruye desde cero con `supabase db reset` (migraciones + seed). Si no se puede, está roto.
* CI (GitHub Actions): typecheck, lint, tests de frontend, build, y `supabase start` + `supabase test db`.
* Ninguna migración destructiva en producción sin autorización humana.

---

## 17. Qué NO hacer

* No crear una base de datos, un proyecto o una copia de código por negocio.
* No crear tablas "genéricas" con todo en JSON para evitar diseñar. JSON solo para configuración flexible y metadata.
* No meter lógica de negocio en el frontend.
* No hacer que un módulo lea tablas de otro.
* No construir módulos futuros antes de validar el actual con negocios reales.
