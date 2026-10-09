# Restaurar una copia de seguridad

> Usar solo si se perdió o se rompió la base de datos. **Nunca** restaurar encima
> de producción: siempre en un proyecto **nuevo** de Supabase, y recién cuando
> anda, apuntar las apps a ese proyecto. Es un **checkpoint humano** (`CLAUDE.md`).

Las copias se hacen como dice `docs/DEPLOY.md` §D7: tres archivos, `roles.sql`,
`schema.sql` (la estructura) y `data.sql` (los datos).

Este mismo procedimiento se prueba solo cada semana en GitHub con datos de prueba
(workflow **Backup drill**, `scripts/backup-drill.sh`). Si ese simulacro está en
verde, el procedimiento funciona.

## Pasos

1. **Crear un proyecto nuevo** en supabase.com (misma región que el anterior).
   Anotar la contraseña de la base que pide al crearlo.
2. **Copiar la dirección de conexión**: Project Settings → Database → Connection
   string → *URI* (modo "Session"). Reemplazar `[YOUR-PASSWORD]` por la contraseña.
3. **Restaurar** desde Codespaces, en la carpeta donde están los tres archivos:

   ```bash
   psql "PEGAR-ACÁ-LA-DIRECCIÓN" --single-transaction \
     -f schema.sql \
     -c 'set session_replication_role = replica' \
     -f data.sql
   ```

   `--single-transaction` hace que, si algo falla, no quede nada a medias.
   `session_replication_role = replica` evita que los triggers (por ejemplo, los que
   suman puntos) vuelvan a correr mientras se cargan los datos.
   `roles.sql` no se usa: este proyecto no crea roles propios y el proyecto nuevo ya
   trae los de Supabase. Se guarda igual por si algún día se agregan.

4. **Revisar** que estén los datos: en el SQL Editor del proyecto nuevo,

   ```sql
   select count(*) from core.customers;
   select count(*) from core.visits;
   ```

   y comparar con lo que había (el panel muestra el total de clientes).
5. **Configurar el proyecto nuevo** como el anterior: Data API → Exposed schemas
   (`core`, `loyalty`), Authentication → URL Configuration (Site URL y Redirect
   URLs), SMTP propio y bucket de logos (ver `docs/CHECKLIST-PRODUCCION.md`).
6. **Apuntar las apps** al proyecto nuevo: cambiar `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_PUBLISHABLE_KEY` en Cloudflare Pages (panel y tarjeta) y volver a
   publicar (`docs/DEPLOY.md`).
7. **Probar** el recorrido del mostrador y una tarjeta de cliente.

## Lo que la copia no trae

* **Archivos** (logos): están en Storage, no en la base. Volver a subirlos desde
  "Mi negocio" o copiarlos del proyecto viejo si sigue accesible.
* **Contraseñas de las cuentas sí vienen** (están en `auth.users`, cifradas), pero
  los links de tarjeta viejos solo siguen andando si se restauró `loyalty.cards`
  (viene en `data.sql`).
* Las tareas programadas (`pg_cron`) vienen en la estructura; revisar en Database →
  Cron que estén activas.
