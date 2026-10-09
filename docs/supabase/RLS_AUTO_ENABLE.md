# `public.rls_auto_enable()` — qué es y si conviene quitarle permisos

> **No se ejecutó ningún cambio en Supabase.** Todo lo de abajo es lectura (proyecto de desarrollo `dqpnqcumlyfifewgzyvh`, 2026-10-09) y una prueba en un Postgres local de prueba.

## Por qué aparece

El *Security Advisor* de Supabase avisa: "`public.rls_auto_enable()` es `SECURITY DEFINER` y la pueden ejecutar `anon` y `authenticated` vía `/rest/v1/rpc/rls_auto_enable`".

## Qué es (leído de la base)

| Dato | Valor |
|---|---|
| Esquema | `public` (no es nuestro; nuestras tablas están en `core`) |
| Dueño | `postgres` |
| Devuelve | `event_trigger` |
| `SECURITY DEFINER` | sí, con `search_path = pg_catalog` |
| Permisos (`proacl`) | `null` = los de fábrica de Postgres: **EXECUTE para PUBLIC** |
| `has_function_privilege(..., 'execute')` | `anon` ✅ · `authenticated` ✅ · `authenticator` ✅ · `service_role` ✅ · `postgres` ✅ |
| La usa | el *event trigger* **`ensure_rls`** (dueño `postgres`, activo), que se dispara en `ddl_command_end` con `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO` |

Definición (copiada de `pg_get_functiondef`):

```sql
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
```

**En simple:** cada vez que alguien crea una tabla en `public`, le activa RLS sola. Es una red de seguridad que agrega Supabase (opción de RLS automático) para que ninguna tabla nueva quede abierta por olvido.

## ¿Es peligrosa?

Casi no:

1. Una función que devuelve `event_trigger` **no se puede llamar directamente**: Postgres responde `trigger functions can only be called as triggers`. Por la API nadie la puede ejecutar aunque tenga el permiso.
2. Aunque se pudiera, lo único que hace es **activar** RLS (más seguridad, no menos) en tablas de `public`.

Quitarle el permiso sirve para que desaparezca el aviso y por prolijidad (mínimo privilegio).

## Verificación hecha en un entorno de prueba (Postgres 16 local, no Supabase)

Script: `scripts/verify-rls-auto-enable-local.sql` (recrea la función y el event trigger, quita el permiso y prueba). Resultado del 2026-10-09:

```
1) Llamarla directo — ERROR: trigger functions can only be called as triggers
2) Después del REVOKE: app_user_puede_ejecutar = f
3) Un usuario común crea public.prueba → rls_activado = t
```

Conclusión: **sin el permiso EXECUTE, el event trigger sigue funcionando**, porque Postgres no revisa ese permiso cuando dispara un trigger (solo al crearlo).

## Propuesta (NO ejecutada — requiere aprobación del mentor/dueño)

Correrlo primero en desarrollo, en una transacción, y verificar antes de confirmar:

```sql
begin;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
-- verificar: el permiso ya no está
select r.rolname, has_function_privilege(r.rolname, 'public.rls_auto_enable()', 'execute')
  from pg_roles r where r.rolname in ('anon', 'authenticated');
-- verificar: el event trigger sigue activando RLS
create table public.zz_prueba_rls (id int);
select relrowsecurity from pg_class where oid = 'public.zz_prueba_rls'::regclass;  -- tiene que dar true
drop table public.zz_prueba_rls;
commit;  -- o rollback; si algo no dio lo esperado
```

**Cómo volver atrás:** `grant execute on function public.rls_auto_enable() to public;`

Riesgo a tener en cuenta: si Supabase vuelve a crear o actualizar la función (por ejemplo, al tocar la opción en el dashboard), el permiso puede volver y el aviso reaparecer. No rompe nada.
