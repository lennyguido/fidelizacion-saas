# Recuperación automática

> Decisión: `DECISIONS.md` D-031. Código: migración `*_core_automations.sql`,
> pantallas en `apps/admin/src/modules/recovery/` (Automático, Mensajes listos y
> la tarjeta de Inicio).

## Qué hace, en simple

Antes, el dueño tenía que acordarse de armar una campaña y mandar cada WhatsApp.
Ahora, **todos los días a las 10 de la mañana** (hora de Argentina) el sistema
revisa quién necesita un mensaje y lo deja **listo**. El dueño entra a
**Recuperación → Mensajes listos** (o toca la tarjeta de Inicio) y manda cada uno
con un toque.

Hay tres automatizaciones. Vienen **apagadas**; las prende el dueño o un admin en
**Recuperación → Automático**:

| Automatización | A quién le escribe | Cada cuánto |
|---|---|---|
| **Clientes en riesgo** | Quien vino 2 veces o más y tarda el **doble** de lo que suele tardar (mínimo 14 días, se puede cambiar). Si vino solo 2 veces, a los 30 días. | Una sola vez por ausencia: si no vuelve, no se le insiste. Si vuelve y se vuelve a ir, sí. |
| **Segunda visita** | Quien vino **una sola vez**, a los 10 días (se puede cambiar). | Una vez. Al prenderla no les escribe a los que vinieron hace meses. |
| **Cumpleaños** | El día del cumpleaños (o unos días antes). El cumpleaños se carga en la ficha del cliente (día y mes, sin año). | Una vez por año. Se mira la fecha en la hora del negocio. |

Siempre:

* Solo a clientes **activos, con teléfono y que aceptaron WhatsApp** (y no se
  dieron de baja). Si alguien se da de baja después de preparado el mensaje, la
  bandeja ya no muestra su teléfono y no deja mandarlo.
* Nadie recibe dos mensajes a la vez: si ya está en otra campaña con la ventana
  abierta, se lo saltea.
* Cada mensaje trae su **cupón** (`{cupon}`), así en el mostrador se sabe que
  volvió por el mensaje.
* Hay **grupo de control**: a una parte (por defecto 10%) no se le escribe, para
  comparar. Con pocos clientes por día se sortea cliente por cliente.
* Cada día queda como una **campaña automática** con sus resultados (Automático →
  "Últimos envíos automáticos"), igual que las campañas a mano.
* "Revisar ahora" prepara los mensajes en el momento. Si ya se prepararon hoy, no
  hace nada (no duplica).

## Cómo funciona por dentro (para el mentor)

* `core.run_automations(p_now)`: lo llama `pg_cron` todos los días a las 13:00 UTC.
  Por cada automatización encendida de un negocio con el módulo `recovery` arma
  una campaña (`core.campaigns` con `automation_kind` y `automation_date`; índice
  único por negocio, automatización y día local) ya enviada, con destinatarios,
  control y cupones. Si un negocio falla, avisa y sigue con los demás.
* `core.automation_candidates`: las reglas de arriba. Recibe `p_now` para poder
  probar fechas (cumpleaños desde UTC-3, cooldown).
* `core.outbox`: un mensaje por destinatario contactado. Estados `queued`,
  `manual`, `sent`, `failed`; proveedor `manual` por ahora. No guarda teléfonos:
  se leen del cliente al mandar.
* El dueño marca "mandado" con `core.mark_outbox_sent`, que usa la misma regla que
  las campañas a mano (`core.mark_recipient_contacted`: consentimiento y cliente
  activo). `core.discard_outbox` lo descarta (sigue contando en los resultados del
  grupo contactado: medición conservadora, D-021).
* Tests: `044-automations` (motor) y `045-automation-outbox` (configuración,
  roles, bandeja).

## Checkpoint del dueño: mandar solos, sin tocar nada

Hoy el último paso (tocar "WhatsApp") lo hace el dueño. Para que salgan solos hay
dos caminos. Los dos necesitan cuentas y plata del dueño, así que **no se hacen sin
su decisión**.

### A. WhatsApp Cloud API (la oficial de Meta)

1. **Qué hace falta:** cuenta de Meta Business verificada, un número de teléfono
   que no esté usando la app común de WhatsApp, y **plantillas aprobadas** por
   Meta (cada mensaje de marketing tiene que usar una plantilla).
2. **Costo aproximado:** unos **USD 0,06 por mensaje de marketing** en Argentina
   (Meta cobra por mensaje entregado; el precio cambia, revisar la tabla oficial
   antes de decidir). 100 mensajes por mes ≈ USD 6.
3. **Cómo se conectaría:**
   * Una Edge Function `send-message` que toma de `core.outbox` los mensajes con
     `provider = 'whatsapp_cloud'` y `status = 'queued'`, los manda con la
     plantilla y guarda el resultado (`sent` o `failed` con el error y reintentos).
   * Un webhook para enterarse de entregas y respuestas; si alguien responde
     "BAJA", se registra la baja en `core.customer_consents`.
   * En Automático, una opción por negocio "Mandar solo por WhatsApp" que hace que
     el motor deje los mensajes en `queued` con ese proveedor en vez de `manual`.
   * Un cupo de mensajes por plan, para que el costo no se dispare.
4. **Secrets** (nunca en el repositorio): token de acceso de Meta, id del número y
   el secreto del webhook, cargados en Supabase → Edge Functions → Secrets.

### B. Avisos de la wallet (gratis)

Si el cliente guardó su tarjeta en Google Wallet (D-028), el sistema puede
**actualizar el pase con un mensaje** y el teléfono muestra un aviso, sin costo
(Google permite hasta 3 avisos por día por pase).

* Proveedor `wallet_push` en `core.outbox`: la Edge Function `wallet` ya actualiza
  pases; habría que sumarle un campo de "mensaje" al pase y procesar estos
  mensajes como los de saldo.
* Necesita la cuenta de Google Wallet del dueño (`docs/WALLET.md`). Apple Wallet
  necesita además la cuenta de desarrollador de Apple (USD 99 por año).
* Ventaja: gratis. Desventaja: solo llega a quien guardó la tarjeta.

## Lo que todavía no hace (a propósito)

* **Aviso de puntos por vencer:** primero el dueño tiene que decidir si los puntos
  vencen y cuándo.
* **Mail:** no hay envío por mail (necesita un proveedor y un dominio).
