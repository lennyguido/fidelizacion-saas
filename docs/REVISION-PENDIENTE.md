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

Pruebas: `009-team.test.sql` (19), `010-customer-anonymize.test.sql` (9) y la prueba completa en navegador `e2e/team.spec.ts` (el dueño invita, el empleado entra por el link).

Pantallas nuevas: **Equipo** (solo dueño/administrador), **aceptar invitación** (`/invitacion/...`) y **Borrar datos personales** en la ficha del cliente.

## Cómo revisar

1. En GitHub: **Branches** → elegir la rama → **Compare** (muestra cada archivo cambiado).
2. Las migraciones están en `supabase/migrations/`; cada una explica arriba qué hace.
3. Responder a Claude: "apruebo la 1", "apruebo la 2", o qué cambiar.
