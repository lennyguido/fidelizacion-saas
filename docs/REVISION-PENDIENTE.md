# Cambios esperando revisión

> Nada de esto está aplicado en Supabase. Cuando se aprueben, Claude los lleva a `main` y aplica las migraciones en el proyecto de desarrollo (`dqpnqcumlyfifewgzyvh`), en este orden.

## 1. Rama `fix/archive-owner-admin-only`

| Migración | Qué cambia (en simple) |
|---|---|
| `20261009120000_core_archive_owner_admin_only` | Archivar o reactivar un cliente pasa a ser solo del dueño o un administrador. Antes un empleado podía hacerlo con una consulta directa. Se agrega la función `set_customer_status` y se quita el permiso de modificar la columna `status`. |

Pruebas: `008-customer-archive.test.sql` (10).

## 2. Rama `feat/equipo-y-privacidad` (va encima de la 1)

| Migración | Qué cambia (en simple) |
|---|---|
| `20261009130000_core_team` | **Equipo.** Tabla nueva `invitations` y funciones para invitar por email, cancelar, ver y aceptar una invitación, listar miembros y cambiar rol/desactivar. Solo se guarda el *hash* del código del link (como una contraseña). Para aceptar hay que iniciar sesión con el mismo email invitado. Un administrador solo puede invitar empleados; cambiar roles es solo del dueño; el negocio nunca queda sin dueño. |
| `20261009130100_core_customer_anonymize` | **Borrar datos personales** de un cliente cuando lo pide (Ley 25.326). Reemplaza nombre, teléfono, email y notas, lo archiva y limpia esos datos del registro de cambios. Las visitas quedan como anónimas para no romper las estadísticas. Solo dueño o administrador. Es irreversible. |
| `20261009130200_core_housekeeping` | **Limpieza semanal** de registros internos viejos (eventos procesados y el historial del reloj de tareas), para que no crezcan sin límite. |

Pruebas: `009-team.test.sql` (26), `010-customer-anonymize.test.sql` (12) y la prueba completa en navegador `e2e/team.spec.ts` (el dueño invita, el empleado entra por el link).

Pantallas nuevas: **Equipo** (solo dueño/administrador), **aceptar invitación** (`/invitacion/...`) y **Borrar datos personales** en la ficha del cliente.

### Revisión de seguridad hecha antes que la del mentor (2026-10-09)

Un revisor independiente (otro agente, que no escribió el código) probó la rama con ataques concretos. No encontró fugas entre negocios ni forma de volverse dueño. Encontró esto, **ya corregido** en el commit `10f360a`:

1. Un administrador podía "reactivar" a un empleado que el dueño había desactivado, volviéndolo a invitar. Ahora una invitación **nunca** cambia a alguien que ya está en el equipo; reactivar es solo del dueño.
2. Al borrar los datos de un cliente quedaban textos libres de sus visitas (notas, motivo de anulación) y una copia en el registro de cambios. Ahora se borran también.
3. Un administrador podía cancelar o reemplazar una invitación de administrador hecha por el dueño. Ahora solo el dueño.
4. El registro de cambios guardaba el *hash* del código de invitación. Ya no.
5. En el panel, un cliente archivado no se podía reactivar ni borrar. Ahora sí.

**Preguntas para el mentor/dueño (no se cambiaron):**

* Si un negocio tiene **dos dueños**, cualquiera puede quitarle el rol al otro (la base solo impide quedarse sin ningún dueño). ¿Está bien así?
* Las invitaciones confían en el email con el que la persona inició sesión. En producción hay que tener **activada la confirmación de email** en Supabase Auth.

## Alertas de Supabase en el proyecto de desarrollo (solo lectura, 2026-10-09)

| Alerta | Qué significa | Qué hacer |
|---|---|---|
| `public.rls_auto_enable()` la puede ejecutar cualquiera (incluso sin iniciar sesión) | Es una función que **no creamos nosotros**: la agrega Supabase (opción de activar RLS automático). Vive en `public`, fuera de nuestro esquema. | Probablemente inofensiva, pero conviene quitarle el permiso: `revoke execute on function public.rls_auto_enable() from public, anon, authenticated;`. **Necesita tu aprobación.** |
| Protección de contraseñas filtradas desactivada | Supabase puede rechazar contraseñas que aparecieron en filtraciones. | Dashboard → Authentication → Providers/Passwords → activar "Leaked password protection" (puede requerir plan pago). |
| 14 funciones `security definer` que puede llamar un usuario | Son exactamente las previstas y probadas en `001-security-meta`. | Nada. |
| `events` y `platform_admins` con RLS y sin políticas | A propósito: nadie las lee desde la app. | Nada. |
| 18 índices sin uso | Normal: todavía no hay datos ni uso. | Nada por ahora. |

## Cómo revisar

1. En GitHub: **Branches** → elegir la rama → **Compare** (muestra cada archivo cambiado).
2. Las migraciones están en `supabase/migrations/`; cada una explica arriba qué hace.
3. Responder a Claude: "apruebo la 1", "apruebo la 2", o qué cambiar.
