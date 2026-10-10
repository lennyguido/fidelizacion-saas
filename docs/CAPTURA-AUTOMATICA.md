# Ventas que entran solas (conexión con cajas)

> Decisión: `DECISIONS.md` D-033. Código: migración `*_core_sales_ingest.sql`, Edge
> Function `supabase/functions/sales-ingest`, tarjeta "Conexión con la caja" en
> **Mi negocio**.

## Qué hace, en simple

Hoy cada visita la carga el cajero (o escanea el QR). Si la caja o el sistema de
gestión del local puede **avisar cada venta**, la visita entra sola: con el monto, y
con el cliente si la caja manda su celular o su código de socio. Si no lo manda,
la venta cuenta igual para las estadísticas del negocio (visitas, ventas, semanas
flojas), pero sin cliente.

1. En **Mi negocio → Conexión con la caja**, tocá **Generar clave**. La clave se ve
   **una sola vez**: copiala y pasásela a quien instala tu sistema, junto con la
   dirección que aparece arriba.
2. Para probar sin caja: **Mandar venta de prueba** (con o sin celular). Queda como
   una visita con comprobante `PRUEBA-…`.
3. Si una clave se filtra, **Revocar** y generar otra.

## Para quien integra la caja

```
POST https://<proyecto>.supabase.co/functions/v1/sales-ingest
Authorization: Bearer lk_xxxxxxxx...          (o X-Api-Key: lk_...)
Content-Type: application/json

{
  "receipt": "FAC-B-0001-00001234",   // obligatorio: número de comprobante
  "amount": 8500.50,                  // en pesos (o "amount_minor": 850050 en centavos)
  "occurred_at": "2026-10-10T13:05:00-03:00",  // opcional; hasta 7 días atrás
  "phone": "11 2233-4455",            // opcional
  "member_code": "ABCD2345"           // opcional: código de socio de la tarjeta
}
```

Respuestas: `201 created` (venta nueva), `200 duplicate` (ese comprobante ya había
entrado: no se duplica), `400` (datos mal), `401` (clave inválida o revocada).
Mandar la misma venta dos veces es seguro.

* Solo se guarda el **hash** de la clave (como una contraseña).
* No se guarda **DNI**: si la caja solo tiene el DNI, la venta entra sin identificar.
* Los puntos se suman igual que en el mostrador (D-018/D-022): solo si la venta se
  manda en el momento (hasta 30 minutos después).

## Checkpoint del dueño: integraciones reales

Las dos necesitan credenciales del dueño, así que **no se activan sin su decisión**.

### Mercado Pago (la clave en Argentina)

Muchos locales chicos cobran con el **QR de Mercado Pago** o con una controladora
fiscal sin API. Por eso Mercado Pago es la integración más útil.

1. **Prueba técnica de 2–3 días antes de prometerla:** ¿Mercado Pago avisa (webhook)
   de los cobros hechos con el QR de siempre del local, o solo de los cobros creados
   por API ("órdenes")? Si solo avisa de las órdenes, el local tendría que cobrar con
   un QR generado por nosotros.
2. **Conexión (OAuth):** el dueño entra a Mercado Pago desde el panel y autoriza a
   nuestra app; guardamos su token cifrado (Supabase secrets / Vault), nunca en el
   repositorio.
3. **Webhook:** una Edge Function recibe los avisos de pago, consulta el pago y llama
   a `core.ingest_sale` con `receipt = id del pago` (la deduplicación ya está hecha).
4. **Pagador ↔ cliente:** Mercado Pago da el email o el id del pagador; la primera vez
   hay que vincularlo con el cliente (por ejemplo, el cajero lo confirma una vez) y
   después se reconoce solo.

### Fudo (sistema de gestión para gastronomía)

* La API está solo en el **plan Pro** de Fudo.
* Los tokens vencen cada 24 h y **no tiene webhooks**: hay que consultar las ventas
  nuevas cada pocos minutos (un cron que llame a la API de Fudo y mande cada venta a
  `core.ingest_sale`).
* Necesita las credenciales de la cuenta Fudo del local.

## Para el mentor

* `core.integration_keys` (hash sha256, prefijo visible, revocación; el panel no
  puede leer el hash por permisos de columna). `core.create_integration_key`,
  `core.revoke_integration_key` y `core.simulate_sale` (dueño/admin).
* `core.ingest_sale` y `loyalty.integration_member_customer`: solo `service_role`
  (los llama la Edge Function). Ninguna función nueva para anon.
* Visitas con `source = 'pos'` y `source_ref = comprobante`: la idempotencia ya existe
  en `core.record_visit_internal`.
* Tests: `040-sales-ingest` (pgTAP) y `supabase/functions/sales-ingest/tests` (Deno).
