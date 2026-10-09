# Seguridad

## Cómo avisar un problema de seguridad

No abras un issue público. Usá **GitHub → pestaña Security → Report a vulnerability** (aviso privado). Respondemos en hasta 7 días.

## Qué protegemos

* **Aislamiento entre negocios:** cada fila de negocio tiene `business_id` y Row Level Security (RLS). Un negocio nunca ve datos de otro. Lo prueban `002-tenant-isolation` y el meta-test `001-security-meta`.
* **Lógica sensible en la base:** visitas, estados, archivado, equipo y borrado de datos se hacen solo con funciones de Postgres que verifican el rol (`core.require_member`). Las tablas sensibles no aceptan escrituras directas.
* **Funciones:** toda función `security definer` fija `search_path = ''`. Cada migración termina con `revoke execute ... from public, anon`. El meta-test lista exactamente qué funciones puede llamar un usuario.
* **Secretos:** el frontend usa solo la *publishable key*. La *service-role key* nunca va al frontend ni al repositorio. Los archivos `.env*` están en `.gitignore`.
* **Invitaciones:** se guarda solo el hash SHA-256 del código; vencen a los 7 días y sirven una vez. La auditoría no guarda el hash.
* **Datos personales (Ley 25.326):** consentimiento y baja centralizados; `core.anonymize_customer` borra los datos personales de un cliente, incluidos textos libres y auditoría.

## Reglas para quien programa

1. Nunca subir claves, tokens ni datos reales de clientes.
2. Toda tabla nueva de negocio: `business_id not null`, RLS, índice por `business_id`, FKs compuestas. El meta-test falla si falta algo.
3. Ninguna migración se aplica en Supabase sin aprobación explícita del dueño.
4. Nada de migraciones destructivas en producción.

## Pendiente antes de producción

* Activar confirmación de email y protección de contraseñas filtradas en Supabase Auth.
* Quitar permisos a `public.rls_auto_enable()` (función agregada por Supabase).
* Revisar las alertas de seguridad de Supabase (Advisors) después de cada migración.
