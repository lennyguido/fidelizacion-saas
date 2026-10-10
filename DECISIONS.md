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

`packages/sdk/src/database.types.ts` lo genera el workflow `DB types` (`supabase gen types --local --schema core`) cada vez que cambian las migraciones, y lo commitea solo. El SDK usa esos tipos (`Tables<'...'>`, `FunctionReturns<'...'>`) en lugar de interfaces escritas a mano. No se edita a mano. Ojo: los commits del bot no disparan el CI (regla de GitHub); después de que el bot actualiza los tipos, hacer un push más para que corran las pruebas.

## D-017 — Fase 4 en paralelo con el piloto (2026-10-09, vigente)

El dueño validó en el proyecto de desarrollo registro, login, negocio, clientes, visitas, archivado y reactivación, y decidió empezar la Fase 4 mientras corre el piloto de 2 semanas (checkpoint de producto de la Fase 3). Si el piloto muestra que el personal no registra visitas, se rediseña la carga antes de lanzar puntos a clientes reales.

## D-018 — Cómo funciona el módulo de puntos (2026-10-09, vigente)

* **Reacciona a eventos del núcleo** con un trigger propio sobre `core.events` (`visit.recorded`, `visit.voided`, `customer.anonymized`). El núcleo no sabe que `loyalty` existe; la acreditación es inmediata (en la misma transacción que la visita). El trigger nunca lanza errores: si falla, la visita se registra igual y queda un warning en el log.
* **Fórmula:** `puntos = puntos_por_visita + floor(monto / paso) × puntos_por_paso` si el monto llega al mínimo. Siempre redondeo hacia abajo, tope de 100.000 por visita. "Sellos" es la misma mecánica mostrada como tarjeta.
* **Libro de puntos append-only** (`loyalty.ledger`); el saldo en `loyalty.members` se actualiza en la misma transacción y siempre es igual a la suma del libro. Una visita o un canje no se acreditan ni revierten dos veces (índices únicos).
* **Sin puntos:** visitas importadas (historial), socios que se fueron, módulo apagado, clientes no socios. Sumarse al programa es opcional (D-007).
* **Canje en el mostrador:** se confirma en el momento, descuenta los puntos y genera un código de 6 caracteres como comprobante. Un `request_id` evita el doble toque. Cancelar (con motivo, solo dueño/admin) devuelve los puntos. El canje iniciado por el cliente desde su app (código con vencimiento) llega con `apps/client`.
## D-019 — Migraciones en desarrollo sin pedir permiso cada vez (2026-10-09, vigente)

El dueño pidió no tener que aprobar cada migración. En el proyecto de **desarrollo** (`dqpnqcumlyfifewgzyvh`) se aplican las migraciones no destructivas con CI en verde, registrándolas en `PROGRESS.md`. Siguen necesitando aprobación: producción, migraciones destructivas, borrar datos y lo que el mentor haya pedido revisar (migraciones 11–14 de equipo y dueños). Cada migración aplicada se integra a `main` en el mismo momento (rama con merge `--no-ff`, reversible).

## D-020 — Tarjeta digital del cliente por link, sin cuenta (2026-10-09, vigente)

**Contexto:** `TASKS.md` §15 pedía elegir cómo se identifica el cliente final. Mails de Supabase gratis: muy pocos por hora; SMS: cuesta plata. El cliente de barrio no quiere crear cuentas.

**Decisión:** la tarjeta se abre con un **link secreto** que el negocio le manda (por WhatsApp, desde la ficha del cliente). El código va después de `#` (no viaja a ningún servidor) y se guarda en el teléfono para volver a abrirla desde el ícono.

* En la base se guarda solo el hash (`loyalty.cards`, sin permisos para nadie). Generar un link nuevo invalida el anterior.
* `loyalty.get_card(token)` es la **única función ejecutable sin sesión** (lo verifica el meta-test). Es solo lectura y muestra lo mínimo: nombre de pila, saldo, código de socio, recompensas y últimos movimientos. Nunca teléfono, email ni apellido.
* El **código de socio** (8 caracteres, va en el QR) no es secreto: sirve para encontrar al cliente en el mostrador escribiéndolo o escaneándolo.
* Más adelante, si hace falta (por ejemplo, para que el cliente canjee desde su teléfono), se agrega inicio de sesión con email/OTP usando `core.customer_accounts`.

## D-021 — Campañas de recuperación con grupo de control y atribución por ventana (2026-10-09, vigente)

* **Quién recibe:** clientes del segmento (filtros fijos validados: estados, visitas mínimas, gasto mínimo, días sin venir) que estén activos, tengan teléfono y **consentimiento de WhatsApp vigente** (último registro en `core.customer_consents`). Sin consentimiento no entran.
* **Envío MVP:** sin API de WhatsApp. Al lanzar, la base congela la lista, elige al azar el **grupo de control** (por defecto 10–20%) y arma el mensaje de cada uno. El dueño lo manda desde su WhatsApp con un link `wa.me`; se registra que lo abrió.
* **"Volvió":** tiene al menos una visita válida entre el lanzamiento y N días después (por defecto 14). Se calcula al consultar desde `core.visits`, así una visita anulada deja de contar sola.
* **Resultados:** total de los que volvieron y gastaron, y lo **incremental** comparando con el grupo de control: `(tasa contactados − tasa control) × contactados` y `(gasto promedio contactados − gasto promedio control) × contactados`. Sin grupo de control no se muestra incremental. Nunca se promete un resultado: se muestra estimado y con la explicación.
* **Tablero del mes** (`core.dashboard_summary`): visitas, ventas registradas, ticket promedio, nuevos, recuperados y "en juego" (lo que gastaron los que dejaron de venir), comparado con los mismos días del mes anterior, en la zona horaria del negocio. Solo dueño/admin.

## D-022 — Topes contra puntos fabricados (2026-10-09, vigente)

Una visita suma puntos solo si se cargó en el momento (su hora es como mucho 30 minutos antes de la carga); las atrasadas se registran en el núcleo pero no dan puntos (si hace falta, ajuste manual con motivo). Cada programa tiene topes configurables: `max_points_per_visit` (por defecto 1.000) y `max_visits_per_day` por socio (por defecto 3, en la zona horaria del negocio; las anuladas no cuentan). El trigger lee la visita desde `core.visits` en vez de confiar en el evento. Si falla, la visita se registra igual y la falla queda en `loyalty.event_failures` (solo service role). La tarjeta no se muestra para clientes archivados o anonimizados, y salir del programa (o anonimizar) borra el link.

## D-023 — Endurecimiento de campañas (2026-10-09, vigente)

El consentimiento se vuelve a mirar al escribir: si el cliente se da de baja o se archiva después del lanzamiento, el panel oculta su teléfono y mensaje (`blocked_reason`) y no se lo puede marcar como contactado (`consent_revoked`); sigue contando en los resultados de su grupo. Un cliente no puede estar en dos campañas con ventana abierta (se excluye al lanzar; la vista previa lo informa como `busy`). Entre consentimientos del mismo instante gana el último (`seq`). Números de segmento enteros y acotados. "Nuevos" del tablero = primera visita en el mes. Corte del mes anterior en hora local. Fórmulas explicadas en `docs/RESULTADOS.md`.

## D-024 — Marca del negocio: logos públicos (2026-10-09, vigente)

Los logos van al bucket `logos` (ya existente, lectura pública, escritura solo owner/admin en la carpeta de su negocio): un logo no es dato sensible y la tarjeta anónima lo necesita. Cada subida usa nombre nuevo (`logo-<timestamp>`), sin sobrescribir; los viejos no se borran. La tarjeta usa el color y el logo del negocio. Panel y tarjeta son PWA con un service worker propio que nunca guarda respuestas de Supabase (`docs/PWA.md`).

## D-025 — Hosting gratuito: Cloudflare Pages (2026-10-09, propuesta; la cuenta la crea el dueño)

Vercel Hobby prohíbe uso comercial y Netlify gratis pausa los sitios al quedarse sin créditos; Cloudflare Pages gratis da 500 publicaciones/mes sin límite de tráfico estático. Dos proyectos (panel y tarjeta), encabezados de seguridad en `apps/*/public/_headers`, chequeo en CI (`scripts/check-deploy-build.sh`). Pasos: `docs/DEPLOY.md`; antes del primer cliente real: `docs/CHECKLIST-PRODUCCION.md` (proyecto Supabase de producción separado, SMTP propio, backups).

## D-026 — Atribución por cupón (2026-10-09, vigente)

Al lanzar una campaña, cada cliente del grupo contactado recibe un cupón de 6 caracteres (sin I, O, 0 ni 1; único en el negocio) que el mensaje incluye con `{cupon}`. El grupo de control no tiene cupón. En el mostrador cualquier miembro del equipo lo valida (`core.find_campaign_coupon`) y lo usa (`core.redeem_campaign_coupon`): se registra la visita con el monto y el cupón queda atado a esa visita, una sola vez, dentro de la ventana de la campaña y solo si el cliente sigue activo. Los resultados muestran los cupones usados (si la visita se anula, deja de contar). El cupón es una prueba más fuerte de que el cliente volvió por el mensaje, pero **no reemplaza** la comparación con el grupo de control: "volvió" e "incremental" se siguen calculando igual (D-021). El mostrador recibe tarjetas de los módulos con `counterPanel` en el manifest (la del cupón la aporta `recovery`).

## D-027 — Endurecimiento de cupones (2026-10-10, vigente)

Un cupón usado queda siempre atado a una visita real (mismo negocio y cliente, no anulada, dentro de la ventana de la campaña). Los resultados cuentan solo cupones con esa visita vigente. En el mostrador se usa una sola función, `core.record_visit_with_coupon`, que en la misma transacción registra la visita (o reusa la recién cargada, sin cambiar su monto) y marca el cupón; `core.redeem_campaign_coupon` queda interna. Los cupones respetan el módulo de la campaña, nadie del equipo puede usar un cupón de su propia ficha de cliente (`self_redemption`) y los códigos usan bytes aleatorios de pgcrypto.

## D-028 — Tarjeta en Google Wallet / Apple Wallet (2026-10-10, propuesta: faltan las cuentas del dueño)

El cliente guarda su tarjeta en la billetera del teléfono desde la tarjeta por link (D-020). Todo pasa por la Edge Function `wallet` (service role); `loyalty.wallet_passes`, `wallet_devices` y `wallet_updates` no tienen permisos para el panel ni para anon. Al pase viajan solo nombre de pila, puntos, código de socio y marca del negocio. Un trigger sobre `loyalty.members` encola avisos; un cron llama a `/wallet/google/sync`, que actualiza el pase con aviso gratis en el teléfono (Google: hasta 3 por día), por tandas, idempotente y con reintentos. Google primero (gratis); Apple listo detrás de sus secrets (cuenta de USD 99/año) y su aviso por APNs queda pendiente. Sin secrets, la función responde 501 y los botones no aparecen. Guía: `docs/WALLET.md`.

## D-029 — Prioridades de producto (2026-10-10, propuesta)

Análisis en `docs/OPORTUNIDADES.md`. Mínimo para competir en 2026: Wallet con avisos gratis (canal por defecto; WhatsApp API cuesta por mensaje y va con cupo por plan). Hoja de ruta de 90 días atada al piloto: Wallet → alta del cliente por QR con consentimiento + plantillas por rubro + cartel imprimible → resumen semanal al dueño (detector de pérdidas) → cumpleaños y segunda visita automáticos → "traé un amigo" → pedido de reseña en Google (a todos, sin premio) → prueba técnica de Mercado Pago.

## D-030 — Tarjeta de sellos (2026-10-10, vigente)

La tarjeta se dibuja como cartón de sellos en los programas "Tarjeta de sellos" y en los de puntos cuya recompensa cuesta ≤ 20: casilleros = costo de la próxima recompensa (tope 20, llenado proporcional si cuesta más); el sello lleno muestra el logo del negocio. La regla vive igual en `card.stampSlots()` (SDK) y `wallet/lib/stamps.ts`. En el Wallet, la fila de sellos es una imagen pública `GET /wallet/stamps.png` (solo color y logo, ya públicos por D-024), con caché inmutable; Google la usa como `heroImage` y Apple como `strip.png`. Se dibuja en TypeScript puro: en el Wallet solo se usan logos PNG (con otros formatos, un tilde). Migración `20261010141333_loyalty_wallet_stamps.sql`.
