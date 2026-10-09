# Qué puede hacer cada rol (y qué prueba lo demuestra)

> Estado con las ramas `fix/archive-owner-admin-only` + `feat/equipo-y-privacidad` + `feat/proteger-duenos` aplicadas. **Nada de esto está aplicado todavía en Supabase.**
> Todas las reglas se aplican **en la base de datos**: aunque alguien se saltee el panel y le hable directo a la base, la respuesta es la misma.
> Columna "Prueba": archivo en `supabase/tests/database/` y nombre del test. Última corrida: **161/161 OK** (12 archivos, Postgres 16 local) + CI con Supabase real en Docker.

Roles: **Dueño** (owner) · **Admin** · **Empleado** (staff) · **Otro negocio** (usuario de otro negocio, cualquier rol) · **Sin sesión** (anon).

## Clientes y visitas

| Acción | Dueño | Admin | Empleado | Otro negocio | Sin sesión | Prueba |
|---|---|---|---|---|---|---|
| Ver clientes, visitas y estadísticas | ✅ | ✅ | ✅ | ❌ | ❌ | 002 "owner A sees only customers of A", "anon has no access to core tables" |
| Buscar clientes | ✅ | ✅ | ✅ | ❌ | ❌ | 006 "cannot search customers of another business", "anon cannot search" |
| Crear / editar datos de un cliente | ✅ | ✅ | ✅ | ❌ | ❌ | 002 "owner A cannot create customers in B"; 008 "staff can still edit customer data" |
| Registrar visita | ✅ | ✅ | ✅ | ❌ | ❌ | 002 "owner A cannot record visits in B"; 003 "visits cannot be inserted directly" |
| Anular visita (con motivo) | ✅ | ✅ | ❌ | ❌ | ❌ | 003 "staff cannot void visits", "owner can void a visit" |
| Importar clientes (CSV) | ✅ | ✅ | ❌ | ❌ | ❌ | 007 "staff cannot import", "cannot import into another business" |
| Archivar / reactivar cliente | ✅ | ✅ | ❌ | ❌ | ❌ | 008 "staff cannot archive with a direct UPDATE", "…through the function", "admin can archive", "owner can reactivate" |
| Cambiar el estado con un UPDATE directo | ❌ | ❌ | ❌ | ❌ | ❌ | 008 "not even the owner can change status with a direct UPDATE" |
| Borrar datos personales (Ley 25.326) | ✅ | ✅ | ❌ | ❌ | ❌ | 010 "staff cannot erase customer data", "the owner can erase customer data" |
| Modificar estadísticas a mano | ❌ | ❌ | ❌ | ❌ | ❌ | 003 "stats cannot be modified directly" |

## Equipo

| Acción | Dueño | Admin | Empleado | Otro negocio | Sin sesión | Prueba |
|---|---|---|---|---|---|---|
| Ver el equipo con emails | ✅ | ✅ | ❌ | ❌ | ❌ | 009 "the owner sees the team…", "staff cannot list the team with emails" |
| Invitar empleado | ✅ | ✅ | ❌ | ❌ | ❌ | 009 |
| Invitar administrador | ✅ | ❌ | ❌ | ❌ | ❌ | 009 "an admin cannot invite another admin" |
| Cancelar / reemplazar invitación de admin | ✅ | ❌ | ❌ | ❌ | ❌ | 009 "an admin cannot cancel an admin invitation", "…replace…" |
| Reinvitar a alguien desactivado | ❌ (se reactiva desde Equipo) | ❌ | ❌ | ❌ | ❌ | 009 "a disabled member cannot be re-invited" |
| Aceptar una invitación | Solo la persona con **el mismo email** invitado | | | | ❌ | 009 "only the invited email can accept", "anon cannot read invitations" |
| Cambiar rol / desactivar empleado o admin | ✅ | ❌ | ❌ | ❌ | ❌ | 009 "only the owner manages roles", "the owner can disable a member" |
| Cambiar rol / desactivar a **otro dueño** | ❌ | ❌ | ❌ | ❌ | ❌ | 011 "an owner cannot demote another owner", "…disable another owner" |
| Dejar de ser dueño uno mismo | ✅ si queda otro dueño activo | | | | | 011 "an owner can step down by themselves…"; 009 "the business cannot be left without an active owner" |
| Agregar miembros con un INSERT directo | ❌ | ❌ | ❌ | ❌ | ❌ | 002 "memberships cannot be inserted directly" |

## Negocio

| Acción | Dueño | Admin | Empleado | Otro negocio | Sin sesión | Prueba |
|---|---|---|---|---|---|---|
| Crear un negocio (hasta 3 por persona) | ✅ cualquier usuario con sesión | | | | ❌ | 005 "anon cannot create businesses", "a user cannot own more than 3 businesses" |
| Editar datos del negocio | ✅ | ✅ | ❌ | ❌ | ❌ | 002 "staff cannot update the business", "owner A cannot update business B" |
| Cambiar estado del negocio / activar módulos | ❌ (lo hace la plataforma) | ❌ | ❌ | ❌ | ❌ | 002 "owner cannot change business status", "modules cannot be enabled directly" |
| Leer el registro de cambios (auditoría) | ✅ | ✅ | ❌ | ❌ | ❌ | 002 "staff cannot read the audit log" |

## Controles generales (se verifican solos para toda tabla y función)

`001-security-meta`: toda tabla con RLS; toda tabla de negocio con `business_id` e índice; ninguna función ejecutable por `anon` ni por `PUBLIC`; la lista exacta de funciones que puede llamar un usuario; toda función `security definer` con `search_path` fijo.

## Comportamiento que se ve en el panel

* **Empleado:** no ve "Equipo", "Importar", "Archivar", "Anular" ni "Borrar datos personales".
* **Admin:** ve todo menos invitar administradores y cambiar roles.
* **Dueño:** ve todo; en la lista de Equipo, los otros dueños no tienen botones para cambiarlos.
* Si alguien fuerza la acción igual (por ejemplo, con la consola del navegador), la base responde "No tenés permiso" y no cambia nada.
