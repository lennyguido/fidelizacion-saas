# Checklist antes del primer cliente real

> Se completa **antes** de cargar datos de un comercio real. Cada ítem dice quién lo hace:
> **Dueño** (vos), **Mentor** (revisión técnica) o **Claude** (el agente; en producción solo con tu autorización escrita).
> Cómo hacer cada paso: `docs/DEPLOY.md` (la letra entre paréntesis es la sección).
> Si un ítem no se puede cumplir, no se lanza: se anota por qué y se decide con el mentor.

## 1. Proyecto de producción separado

- [ ] **Dueño** — Crear el proyecto de Supabase de producción `fidelizacion-prod`, región São Paulo (D2).
- [ ] **Dueño** — Guardar la contraseña de la base en un gestor de contraseñas. Nunca en el repositorio, el chat, Cloudflare ni un mail.
- [ ] **Dueño** — Verificación en dos pasos activada en GitHub, Cloudflare, Supabase y Brevo.
- [ ] **Claude** — Confirmar que `main` tiene el CI en verde (frontend, base de datos y punta a punta) antes de aplicar migraciones.
- [ ] **Mentor** — Decidir qué migraciones pendientes (11 a 14: equipo, borrado de datos, limpieza, dueños) entran **antes** del lanzamiento. Solo viaja a producción lo que está en `main`.
- [ ] **Dueño** (o **Claude** con autorización escrita) — `supabase db push --dry-run`, revisar la lista, después `supabase db push` y `supabase unlink` (D3). Sin `--include-seed`.
- [ ] **Dueño** — Exponer `core` y `loyalty` en Data API → Exposed schemas (D3).
- [ ] **Claude** (lectura, con autorización) — Leer el Security Advisor de producción: sin alertas, salvo `rls_auto_enable` (D8).
- [ ] **Mentor** — Decidir qué hacer con `rls_auto_enable` (`docs/supabase/RLS_AUTO_ENABLE.md`). Sin decisión, se deja como está.

## 2. Seguridad

- [ ] **Dueño** — En Cloudflare solo hay valores públicos: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_CLIENT_APP_URL`, `SKIP_DEPENDENCY_INSTALL`. Ninguna `sb_secret_…` ni `service_role`.
- [ ] **Claude** — Buscar secretos en el repositorio (claves, contraseñas, `.env` subidos por error) y confirmar que no hay.
- [ ] **Dueño** — Auth de producción: Site URL y Redirect URLs solo con la dirección del panel; **Confirm email activado**; contraseña mínima de 10 (D4).
- [ ] **Dueño** — Anotar que la protección de contraseñas filtradas no está en el plan gratis; activarla al pasar a Pro (D4).
- [ ] **Dueño** + **Mentor** — Decidir si el registro de negocios queda abierto o se apaga después de crear la cuenta del comercio piloto (D4).
- [ ] **Dueño** — Verificar los encabezados de seguridad del panel y la tarjeta (`docs/DEPLOY.md`, Paso 7, puntos 9 y 10).
- [ ] **Mentor** — Revisión de aislamiento entre negocios y permisos (`TASKS.md` §52): un negocio nunca ve datos de otro; un empleado no hace lo que es de dueño/admin.
- [ ] **Claude** — Tests de base (pgTAP, incluido el meta-test de seguridad) verdes en `main`.

## 3. Mails de la cuenta (SMTP propio)

- [ ] **Dueño** — Cuenta gratis de Brevo, remitente verificado y SMTP key cargada **solo** en Supabase de producción (D6).
- [ ] **Dueño** — Probar el registro con un email que no sea del equipo de Supabase: tiene que llegar el mail de confirmación.
- [ ] **Dueño** — Probar "Olvidé mi contraseña": el link tiene que abrir el panel publicado.
- [ ] **Dueño** + **Mentor** — Decidir cuándo comprar un dominio para los mails (sin dominio, pueden ir a spam). Es un checkpoint: cuesta plata y toca DNS.

## 4. Privacidad (Ley 25.326)

- [ ] **Dueño** — Completar el cartel `docs/piloto/AVISO-PRIVACIDAD.md` con el nombre y el contacto del comercio, imprimirlo y pegarlo en la caja.
- [ ] **Dueño** — Que el texto lo revise alguien que sepa de la Ley 25.326 antes del uso comercial. Preguntarle también: si el comercio tiene que inscribir la base de datos ante la AAIP, qué acuerdo escrito conviene entre la plataforma y el comercio, y que los datos se guardan en servidores fuera de Argentina (Supabase, región São Paulo).
- [ ] **Dueño** — Explicarle al comercio que sin el "sí" del cliente no se le manda nada por WhatsApp (se anota en la ficha; el sistema lo exige).
- [ ] **Mentor** + **Claude** — Tener resuelto cómo atender un pedido de borrado de datos. La función `core.anonymize_customer()` está en la migración 12 (pendiente de revisión). Si no entra, anotar el procedimiento manual que se va a seguir.
- [ ] **Todos** — Los datos reales solo viven en producción: nunca en desarrollo, capturas de pantalla, issues, chats ni planillas compartidas.

## 5. Datos y copias de seguridad

- [ ] **Claude** — Confirmar que en producción no quedaron datos de demostración (Café Central, Panadería Sur).
- [ ] **Dueño** — Primera copia de seguridad hecha y bajada a tu compu, guardada con contraseña (D7).
- [ ] **Dueño** — Recordatorio semanal en el calendario para la copia (y una antes de cada migración en producción).
- [ ] **Claude** + **Mentor** — Probar una vez que la copia se puede restaurar, en un lugar seguro (nunca sobre producción) (`TASKS.md` §65).
- [ ] **Dueño** — Si se importan clientes del comercio por CSV: revisar la vista previa antes de confirmar y guardar el archivo original en un lugar privado (no en el repositorio).

## 6. Monitoreo (saber cuando algo anda mal)

- [ ] **Dueño** — Cloudflare: revisar en **Deployments** que la última publicación de cada app diga *Success*. Si en tu cuenta aparece la opción de avisos por mail de builds fallidos (*Notifications*), activarla.
- [ ] **Dueño** — Supabase de producción, una vez por semana: **Reports** (uso), **Logs** (errores) y el tamaño de la base (el plan gratis da 500 MB).
- [ ] **Claude** — Una vez por semana, con autorización: leer los Advisors (seguridad y rendimiento) de producción y avisar si aparece algo nuevo.
- [ ] **Dueño** — Acordar con el comercio un canal para avisar problemas (tu WhatsApp) y anotar cada incidente: qué pasó, cuándo y qué se hizo (`TASKS.md` §68).
- [ ] **Dueño** — Saber que el proyecto gratis se pausa después de 1 semana sin uso (vacaciones del comercio): se reactiva desde el dashboard.

## 7. Volver atrás (rollback) y plan B

- [ ] **Dueño** — Saber volver a la versión anterior de cada app: Cloudflare → Deployments → versión anterior → *Rollback to this deployment* (`docs/DEPLOY.md`, Parte B). Probarlo una vez antes del lanzamiento.
- [ ] **Claude** — Para la base no hay "deshacer": un cambio se revierte con una migración nueva, revisada y aprobada como las demás. Tenerla preparada si una migración de lanzamiento sale mal.
- [ ] **Dueño** + **Mentor** — Si se pierde o rompe la base: restaurar la última copia (D7) siguiendo el procedimiento probado en la sección 5.
- [ ] **Dueño** — Plan B para el mostrador si el sistema no anda: anotar en papel (fecha, nombre o teléfono, monto) y cargarlo después.

## 8. El día del lanzamiento

- [ ] **Dueño** — Apps apuntando a producción y verificadas (D5 + Paso 7 de `docs/DEPLOY.md`), con la cuenta real del comercio.
- [ ] **Dueño** — Probar en el celular del cajero (cámara y lector de QR en Chrome Android) y en un iPhone (abrir e instalar la tarjeta).
- [ ] **Dueño** — Con el comercio: crear el negocio, el programa de puntos y la primera recompensa; capacitar al personal con `docs/piloto/MANUAL-CAJERO.md`.
- [ ] **Dueño** — Registrar la primera visita real y abrir la primera tarjeta real; confirmar que los puntos aparecen.
- [ ] **Claude** — Al terminar, actualizar `PROGRESS.md` y `TASKS.md` (§64, §66, §67) con lo que se hizo y lo que quedó pendiente.
