# Acceso solo por invitación (D-043)

Nadie puede registrarse solo y usar Vueltita. El dueño de la plataforma cobra
(por WhatsApp, transferencia o Mercado Pago) y después da el acceso.

## Dar un acceso (dueño de Vueltita)

1. Panel → **Accesos (Vueltita)** (abajo a la izquierda; solo lo ve el administrador)
   o directo en `/admin/accesos`.
2. Mail del cliente + plan (Barrio, Local o Cadena) + nota opcional → **Dar acceso**.
3. Al cliente le llega un mail para **elegir su contraseña**; entra y crea su negocio.
   El negocio queda con el plan comprado. El acceso sirve una sola vez.
4. Si ya tenía cuenta, no hace falta el mail: entra con su contraseña y crea el negocio.

## Configuración única (dueño)

1. **Hacerse administrador de la plataforma** (Supabase → SQL Editor):

   ```sql
   insert into core.platform_admins (user_id)
   select id from auth.users where email = 'TU-MAIL@ejemplo.com';
   ```

2. **Apagar el registro libre:** Supabase → Authentication → Sign In / Providers →
   desactivar **Allow new users to sign up**. Las invitaciones siguen funcionando.
3. (Opcional) Secret `PANEL_URL` = `https://panel.neriva.net` en Edge Functions → Secrets,
   para que el link del mail abra el panel publicado.
4. Los mails de invitación salen del correo de Supabase (pocos por hora en el plan
   gratis). Antes de vender en serio: SMTP propio (docs/DEPLOY.md §D6).

## Por dentro

* `core.access_grants` (pendiente / usado / revocado; solo lo ve el administrador).
* `core.create_business` exige un acceso pendiente para el mail de la cuenta, salvo
  administradores o `core.platform_settings.signup_mode = 'open'` (solo en el entorno
  local de pruebas, lo pone `supabase/seed.sql`).
* Edge Function `grant-access`: crea el acceso con la sesión del administrador y manda
  la invitación con la service role. Tests: `052-access-grants` y Deno.
