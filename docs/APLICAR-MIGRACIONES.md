# Cómo aplicar las migraciones pendientes (cuando estén aprobadas)

> Una **migración** es un archivo con instrucciones que cambian la estructura de la base (como una receta: "agregá esta tabla", "cambiá este permiso"). Aplicarla = ejecutar la receta en Supabase.
> **Solo en el proyecto de desarrollo** `dqpnqcumlyfifewgzyvh`. Nunca en producción sin un plan aparte.

## Antes

1. El mentor/dueño aprobó por escrito qué ramas entran ("apruebo la 1 y la 2").
2. El CI de la rama está en verde.
3. Confirmar en el dashboard de Supabase que el proyecto abierto es **fidelizacion-saas (dqpnqcumlyfifewgzyvh)**.
4. Backup: en desarrollo no hay datos reales, pero igual conviene un respaldo (Database → Backups; o exportar con `supabase db dump`).

## Orden (no cambiarlo)

| # | Migración | Rama |
|---|---|---|
| 10 | `20261009120000_core_archive_owner_admin_only` | `fix/archive-owner-admin-only` |
| 11 | `20261009130000_core_team` | `feat/equipo-y-privacidad` |
| 12 | `20261009130100_core_customer_anonymize` | `feat/equipo-y-privacidad` |
| 13 | `20261009130200_core_housekeeping` | `feat/equipo-y-privacidad` |

Las cuatro son **aditivas o de permisos**: no borran tablas ni datos. La 10 quita un permiso a los usuarios (modificar `customers.status` directo) y la 11 reemplaza la función de auditoría para que no guarde secretos.

## Pasos (los hace Claude con tu OK)

1. Llevar la rama aprobada a `main` (merge) y esperar CI verde.
2. Aplicar cada migración en orden con la herramienta de Supabase (`apply_migration`).
3. Supabase guarda la migración con la **hora de aplicación**, distinta al nombre del archivo. Renombrar el archivo local a esa versión (como se hizo con las 7–9) para que `supabase db push` no la quiera repetir.
4. Verificar: `list_migrations` muestra las 13; correr las alertas de seguridad (Advisors); probar en el panel (invitar a un empleado, archivar con un empleado → debe fallar).
5. Actualizar `PROGRESS.md` (tabla de migraciones con fecha y "con OK del dueño").

## Si algo sale mal

* Una migración falla a la mitad: Supabase la deshace sola (corre en una transacción). No se aplicó nada de esa; avisar y no seguir con las siguientes.
* Revertir una ya aplicada: no editar el archivo; se escribe una migración nueva que deshaga el cambio (y se aprueba igual que las demás).
