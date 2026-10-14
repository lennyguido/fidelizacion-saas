# Mails de Turnos con Brevo (D-055)

El sistema ya deja los mails en una "bandeja de salida". Solo falta el cartero: una cuenta de **Brevo** (gratis hasta 300 mails por día). Sin la clave, la página del turno avisa que por ahora no se puede mandar por mail y ofrece WhatsApp o calendario.

## Pasos (los hace el dueño: son credenciales)

1. Crear la cuenta en **brevo.com** (sin tarjeta).
2. **Remitente y dominio:** Brevo → *Senders, Domains & Dedicated IPs* → *Domains* → **Add a domain** → `neriva.net`. Brevo muestra 2 o 3 registros (TXT y CNAME). Cargarlos en **GoDaddy → DNS de neriva.net** sin borrar ni cambiar los que ya están. Volver a Brevo y tocar **Verify**.
3. *Senders* → **Add a sender**: nombre `Neriva Turnos`, mail `turnos@neriva.net`.
4. **Clave:** *SMTP & API* → pestaña **API Keys** → **Generate a new API key** → nombre `neriva-turnos`. Copiarla (empieza con `xkeysib-`). Es un secreto: **no** va en el chat, ni en GitHub, ni en Vercel.
5. **Supabase** → proyecto → *Edge Functions* → **Secrets** → *Add new secret*:
   * `BREVO_API_KEY` = la clave.
   * (opcional) `EMAIL_FROM` = `turnos@neriva.net` (es el valor por defecto).
6. Probar: sacar un turno de prueba → "Mandámelo por mail" → tiene que llegar en menos de un minuto (mirar también Spam la primera vez).

## Cómo funciona

* `booking.send_by_email(link secreto, mail)` guarda el mail en la ficha del cliente y encola el mail en `core.email_outbox` (máx. 3 por turno).
* La página llama a `turnos.neriva.net/api/send-email` (Vercel → Edge Function `send-email`), que toma lo pendiente y lo manda con Brevo.
* El contenido (que tiene el link secreto) se borra apenas sale. Lo que no salió en 2 horas vence: nunca llega una confirmación tarde.
