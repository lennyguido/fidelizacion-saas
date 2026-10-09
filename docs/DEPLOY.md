# Publicar las apps en internet (gratis) y pasar a producción

> Guía para el dueño. **Nada de esto lo hace Claude solo:** crear cuentas, conectar GitHub, cargar claves y tocar el proyecto de producción de Supabase son pasos tuyos (checkpoint humano).
> Lo que ya quedó listo en el repositorio: la configuración de Cloudflare Pages para las dos apps (`apps/admin/public/_headers`, `apps/client/public/_headers`) y una prueba en el CI que arma las dos apps igual que Cloudflare (`scripts/check-deploy-build.sh`).
> Lista para el día del lanzamiento: `docs/CHECKLIST-PRODUCCION.md`.

## Palabras que vas a ver

* **Hosting:** la "casa" en internet donde quedan guardadas las páginas, para que cualquiera las abra con una dirección (por ejemplo `https://fidelizacion-panel.pages.dev`).
* **Build:** convertir el código en los archivos finales que entiende el navegador. Cloudflare lo hace solo cada vez que cambia `main`.
* **Deploy (publicar):** subir una versión nueva a internet.
* **Variable de entorno:** un dato de configuración que se carga en el hosting y no en el código, como la dirección de Supabase. Es como el teléfono del plomero anotado en la heladera: se cambia sin romper la pared.
* **Desarrollo y producción:** desarrollo es la cocina de prueba (datos inventados); producción es el local abierto al público (datos de clientes reales). Son **dos proyectos de Supabase distintos**.

## Qué se publica

| App | Carpeta | La usa | Dirección de ejemplo |
|---|---|---|---|
| Panel del negocio | `apps/admin` | dueño y empleados del comercio | `https://fidelizacion-panel.pages.dev` |
| Tarjeta del cliente | `apps/client` | clientes finales (link por WhatsApp) | `https://fidelizacion-tarjeta.pages.dev` |

Las dos son páginas que hablan directo con Supabase desde el navegador. El hosting solo guarda archivos: no hay un servidor nuestro que mantener.

## Por qué Cloudflare Pages

Planes gratis, revisados el 2026-10-09 (fuentes al final):

| | Cloudflare Pages (Free) | Netlify (Free) | Vercel (Hobby) |
|---|---|---|---|
| ¿Sirve para un negocio que cobra? | En su página de límites no aparece una restricción de "solo uso personal" | — | **No.** "Restricted to non-commercial personal use only" |
| Publicaciones | 500 builds por mes | 300 créditos por mes; cada publicación a producción cuesta 15 → unas 20 por mes **entre todos los sitios** | — |
| Tráfico | Sin límite publicado para archivos estáticos | Cuesta créditos (20 por GB) | 100 GB por mes |
| Si se acaba el plan gratis | — | **Se apagan todos los sitios** ("Site not available") hasta el mes siguiente | — |
| Dominios propios | hasta 100 por proyecto | — | — |

**Elegido: Cloudflare Pages.**

1. Vercel Hobby queda descartado: este producto es comercial y su plan gratis lo prohíbe.
2. Netlify cuenta publicaciones: con dos apps y varios cambios por día, los créditos se acaban en pocos días y los dos sitios quedan apagados.
3. Cloudflare no cobra el tráfico, deja 500 publicaciones por mes, entiende el archivo `_headers` (encabezados de seguridad) y sirve apps de una sola página sin configuración extra.

---

# Parte A — Publicar las dos apps (apuntando a DESARROLLO)

Primero se publican conectadas al proyecto de **desarrollo** de Supabase, para probar desde el celular con una dirección real. **Con datos de prueba solamente.** Antes del primer cliente real se pasan a producción (Parte D).

## Paso 1 — Juntar los datos de Supabase (desarrollo)

1. Entrá a supabase.com y abrí el proyecto **fidelizacion-saas** (`dqpnqcumlyfifewgzyvh`).
2. Copiá en un papel o en tu gestor de contraseñas:
   * **Project URL**: `https://dqpnqcumlyfifewgzyvh.supabase.co`.
   * **Publishable key** (empieza con `sb_publishable_`). Está en Project Settings → API Keys.
3. **Nunca** copies la *secret key* (`sb_secret_…`) ni la `service_role`. Esas no van en ninguna página: si alguien las ve, puede leer y borrar todo.

La publishable key **no es secreta**: igual termina dentro de la página que abre cualquier persona. La protección real está en la base (RLS).

## Paso 2 — Crear la cuenta gratis de Cloudflare

1. Entrá a `https://dash.cloudflare.com/sign-up` y creá la cuenta con tu email. No pide tarjeta.
2. Confirmá el email que te mandan.
3. Recomendado: activá la verificación en dos pasos (My Profile → Authentication). Lo mismo en GitHub y en Supabase.

## Paso 3 — Crear el proyecto de la TARJETA (primero esta)

Va primero porque el panel necesita saber la dirección de la tarjeta.

1. En Cloudflare: menú **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
   * Si solo te ofrece "Workers", buscá el enlace que dice *Pages* en esa misma pantalla.
2. Elegí **GitHub** y autorizá a Cloudflare. Cuando pregunte a qué repositorios, elegí **Only select repositories** → `fidelizacion-saas`.
3. Elegí el repositorio y tocá **Begin setup**.
4. Completá así (copiá y pegá):

   | Campo | Valor |
   |---|---|
   | Project name | `fidelizacion-tarjeta` |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `npm ci && npm run build -w @plataforma/client` |
   | Build output directory | `apps/client/dist` |
   | Root directory (advanced) | dejarlo **vacío** (la raíz del repositorio) |

5. En **Environment variables** agregá estas tres (tipo *Text*):

   | Nombre | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | la Project URL del Paso 1 |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | la publishable key del Paso 1 |
   | `SKIP_DEPENDENCY_INSTALL` | `1` |

   `SKIP_DEPENDENCY_INSTALL` evita que Cloudflare instale todo dos veces (el `npm ci` del build ya lo hace). Si te lo olvidás, igual funciona, solo tarda más.

6. Tocá **Save and Deploy** y esperá (2 a 4 minutos). Al terminar te muestra la dirección, por ejemplo `https://fidelizacion-tarjeta.pages.dev`.
   * Si ese nombre ya existía, Cloudflare le agrega letras al final. **Anotá la dirección exacta que te muestre.**

¿Por qué la tarjeta necesita sus propias variables? En tu compu, la tarjeta lee el archivo `apps/admin/.env.local`. Ese archivo no se sube a GitHub (tiene tus datos), así que en Cloudflare no existe: cada proyecto tiene sus propias variables. Vite (la herramienta que arma la app) las toma del entorno del build sin cambiar nada del código. El CI lo prueba en cada cambio.

## Paso 4 — Crear el proyecto del PANEL

Igual que el Paso 3, con estos valores:

| Campo | Valor |
|---|---|
| Project name | `fidelizacion-panel` |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `npm ci && npm run build -w @plataforma/admin` |
| Build output directory | `apps/admin/dist` |
| Root directory (advanced) | **vacío** |

Variables (tipo *Text*):

| Nombre | Valor |
|---|---|
| `VITE_SUPABASE_URL` | la Project URL del Paso 1 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | la publishable key del Paso 1 |
| `VITE_CLIENT_APP_URL` | la dirección de la tarjeta del Paso 3, **sin barra al final** (ej. `https://fidelizacion-tarjeta.pages.dev`) |
| `SKIP_DEPENDENCY_INSTALL` | `1` |

`VITE_CLIENT_APP_URL` hace que el botón "Crear tarjeta digital" arme links a la tarjeta publicada. Sin ella, los links apuntarían a `:5174` (lo que se usa en tu compu).

Anotá la dirección del panel (ej. `https://fidelizacion-panel.pages.dev`).

La versión de Node la toma sola del archivo `.nvmrc` del repositorio (22).

## Paso 5 — Ajustes para no gastar publicaciones

El plan gratis da 500 builds por mes. Cada cambio en el repositorio dispararía **dos** (uno por app), aunque solo cambie un documento. En **cada** proyecto:

1. **Settings → Build → Build watch paths** (rutas que disparan un build):

   | Proyecto | Include paths | Exclude paths |
   |---|---|---|
   | `fidelizacion-tarjeta` | `apps/client/*, packages/*, package.json, package-lock.json, .nvmrc` | `*.md` |
   | `fidelizacion-panel` | `apps/admin/*, packages/*, package.json, package-lock.json, .nvmrc` | `*.md` |

2. **Settings → Build → Branch control** → *Preview branch*: **None**.
   * Así solo se publica `main`. Las otras ramas (las que arma Claude para revisar) no generan versiones públicas ni gastan builds. Si más adelante querés versiones de prueba por rama, se activa y se agregan esas direcciones en Supabase.

## Paso 6 — Avisarle a Supabase (desarrollo) las direcciones nuevas

Sin esto, los mails de "confirmá tu cuenta" y "cambiá tu contraseña" te mandan a `localhost` o fallan.

1. Supabase (proyecto de desarrollo) → **Authentication → URL Configuration**.
2. **Site URL:** la dirección del panel (`https://fidelizacion-panel.pages.dev`).
3. **Redirect URLs:** agregá `https://fidelizacion-panel.pages.dev/**` (con los dos asteriscos). Dejá las que ya estaban (`http://localhost:5173/**`, `https://*.app.github.dev/**`).
4. Guardá.

La tarjeta no necesita estar en esta lista: no usa inicio de sesión (se abre con su link secreto).

## Paso 7 — Verificar (10 minutos)

1. Abrí el panel en la compu. Tiene que aparecer el inicio de sesión (no "Falta configuración").
2. Iniciá sesión con tu usuario de prueba y entrá a **Clientes**.
3. Recargá la página (F5) estando en Clientes: tiene que volver a mostrar Clientes, no un error 404.
4. Registrá una visita anónima en el mostrador.
5. Abrí la ficha de un cliente de prueba → **Crear tarjeta digital** → el link tiene que empezar con la dirección de la tarjeta publicada.
6. Abrí ese link en tu celular: tiene que mostrar el saldo y el QR.
7. Instalala: Android (Chrome) → menú ⋮ → *Agregar a la pantalla principal* / *Instalar app*; iPhone (Safari) → Compartir → *Agregar a inicio*. Tiene que abrir sola, sin barra del navegador.
8. En un Android con Chrome: panel → Mostrador → **Escanear QR**. La cámara tiene que abrir y leer el QR de la tarjeta.
9. Encabezados de seguridad: en la compu, abrí el panel, tocá F12 → pestaña **Network** → recargá → tocá la primera fila → **Response Headers**. Tienen que estar `content-security-policy`, `x-frame-options: DENY` y `x-content-type-options: nosniff`. En la tarjeta: `referrer-policy: no-referrer`. (Opcional: la prueba gratuita *HTTP Observatory* de Mozilla, en developer.mozilla.org.)
10. F12 → pestaña **Console**: no tiene que haber errores rojos que digan `Content-Security-Policy`.
11. "Olvidé mi contraseña" con tu email: el mail tiene que llevarte al panel publicado. (En desarrollo, Supabase solo manda 2 mails por hora y solo a los miembros del equipo del proyecto.)

Si todo da bien, avisale a Claude para marcar las tareas de deploy en `TASKS.md` y `PROGRESS.md`.

---

# Parte B — El día a día

* **Publicar cambios:** no hay que hacer nada. Cada vez que algo entra a `main`, Cloudflare arma y publica las dos apps solo (si cambió algo de esa app). Tarda unos minutos.
* **Volver a la versión anterior** (si una publicación salió mal): Cloudflare → el proyecto → **Deployments** → la versión anterior que andaba → menú `…` → **Rollback to this deployment**. Es inmediato y no toca la base de datos.
* **Cambiar una variable:** Settings → **Variables and Secrets** → editar → guardar. Las variables se "hornean" dentro de la app en el build: **después de cambiarlas hay que volver a publicar** (Deployments → la última → `…` → **Retry deployment**).
* **Ver por qué falló un build:** Deployments → el que dice *Failed* → **View details** → el log. Copiale las últimas 30 líneas a Claude.

# Parte C — Problemas comunes

| Qué ves | Qué pasa | Qué hacer |
|---|---|---|
| "Falta configuración: Falta VITE_SUPABASE_URL" | La variable no está o se cargó después del build | Revisar el nombre exacto en Variables and Secrets y hacer **Retry deployment** |
| El build falla en `npm ci` | `package-lock.json` no coincide con los `package.json` | Avisarle a Claude (el workflow *Lockfile* lo arregla) |
| El build falla por la versión de Node | Cloudflare no entendió `.nvmrc` | Agregar la variable `NODE_VERSION` = `22.16.0` y reintentar |
| Página en blanco y en la consola "Refused to … because it violates the following Content Security Policy" | Los encabezados de seguridad bloquean algo nuevo | Copiar el mensaje completo a Claude (se ajusta `_headers`); mientras tanto, **Rollback** a la versión anterior |
| El link de la tarjeta apunta a `:5174` | Falta `VITE_CLIENT_APP_URL` en el panel | Cargarla y **Retry deployment** del panel |
| El mail de confirmación o de contraseña lleva a `localhost` | Falta la dirección en Supabase | Paso 6 (Site URL y Redirect URLs) |
| "Email rate limit exceeded" o el mail no llega | Supabase gratis: 2 mails por hora y solo al equipo del proyecto | En producción: SMTP propio (Parte D, paso D6) |
| Error 404 al recargar una página del panel | Alguien agregó un `404.html` | El CI lo detecta; avisarle a Claude |
| La tarjeta dice que no se pudo cargar | El esquema `loyalty` no está expuesto en Supabase | Project Settings → Data API → Exposed schemas → agregar `loyalty` |

---

# Parte D — Producción vs desarrollo

## D1. Por qué dos proyectos

* En **desarrollo** Claude aplica migraciones nuevas sin preguntar (D-019), se prueban cosas a medio hacer y hay datos inventados (Café Central). Si algo se rompe, no pasa nada.
* En **producción** van los datos de comercios y clientes reales (nombres, teléfonos: Ley 25.326). Ahí solo entra lo que ya se probó, con tu autorización, y nunca se borra nada.
* Mezclarlos es el error más caro: una prueba podría tocar datos reales, o los datos reales quedarían en un lugar sin cuidados.

**Regla:** el primer cliente real se carga en producción, nunca en desarrollo.

## D2. Crear el proyecto de producción (CHECKPOINT: lo hacés vos)

1. supabase.com → **New project**, en la misma organización.
2. **Name:** `fidelizacion-prod` (bien distinto, para no confundirlos nunca).
3. **Database password:** tocá *Generate*, y guardala en un gestor de contraseñas (por ejemplo Bitwarden, gratis). **Nunca** en el repositorio, en el chat, en Cloudflare ni en un mail.
4. **Region:** *South America (São Paulo)*, la más cercana a Argentina.
5. **Plan:** Free. Ojo: el plan gratis permite **2 proyectos activos**; desarrollo + producción ya son 2.
6. Si aparece la opción de RLS automático (*automatic RLS*), cualquiera de las dos está bien: ver D8.
7. Cuando termine, pasale a Claude solo el **project ref** (las letras de la dirección `https://<ref>.supabase.co`). No es secreto.

## D3. Aplicar las migraciones (siempre con la CLI, nunca a mano)

Las **migraciones** son las recetas que arman la base (tablas, permisos, funciones). En producción se aplican **solo** con la herramienta de línea de comandos de Supabase (*CLI*), desde `main`, así la base de producción queda exactamente igual a lo probado.

**Nunca** crear ni cambiar tablas, columnas, policies o funciones de producción desde el dashboard (*Table Editor* o *SQL Editor*). Si se hace, la base deja de coincidir con las migraciones y el próximo `db push` puede fallar o, peor, dejar un permiso abierto sin que nadie lo sepa.

En Codespaces (o con Claude, con tu autorización escrita para producción):

```bash
git checkout main && git pull                       # solo lo que está en main, con CI verde
npx supabase login                                  # autoriza la CLI (abre el navegador)
npx supabase link --project-ref <REF-DE-PRODUCCION> # pide la contraseña de la base (D2)
npx supabase db push --dry-run                      # MUESTRA qué se aplicaría, sin aplicar nada
npx supabase db push                                # aplica las migraciones que faltan
npx supabase migration list                         # las columnas Local y Remote tienen que coincidir
npx supabase unlink                                 # para que ningún comando siguiente apunte a producción
```

Cuidados:

* `db push --dry-run` primero, siempre. Si muestra algo que no esperabas, parar y preguntar.
* **Nunca** `--include-seed` en producción: el seed son los datos de demostración.
* **Nunca** `supabase db reset` contra producción: borra todo.
* Solo se aplica lo que está en `main`. Las migraciones de equipo y dueños (11 a 14) siguen en sus ramas, esperando la revisión del mentor; no viajan hasta que se integren.

Después de aplicar:

1. **Project Settings → Data API → Exposed schemas:** agregar `core` y `loyalty` (igual que en desarrollo). Sin esto el panel no puede leer datos.
2. **Advisors → Security Advisor:** no tiene que haber alertas, salvo la de `rls_auto_enable` (D8). Si hay otra, avisar a Claude antes de cargar datos.

## D4. Inicio de sesión (Auth) en producción

En el proyecto de producción:

1. **Authentication → URL Configuration:**
   * **Site URL:** la dirección del panel.
   * **Redirect URLs:** solo `https://<tu-panel>.pages.dev/**`. **Sin** `localhost` ni `app.github.dev`: en producción no se prueba desde tu compu.
2. **Authentication → Sign In / Providers → Email:**
   * **Confirm email: activado.** Así nadie entra con un mail ajeno, y el mentor lo pidió antes de habilitar invitaciones de empleados.
   * **Minimum password length:** 10 o más; si aparece *Password requirements*, pedir letras y números.
3. **Protección de contraseñas filtradas** (*leaked password protection*): revisa que la contraseña no esté en listas de contraseñas robadas. **En el plan gratis no está disponible** (es del plan Pro). Por eso el mínimo de 10 caracteres. Activarla el día que producción pase a Pro (Authentication → contraseñas → *Prevent use of leaked passwords*).
4. **¿Dejar abierto el registro?** Con *Allow new users to sign up* activado, cualquiera puede crear un negocio. Para el piloto conviene: crear la cuenta del comercio real y después decidir con el mentor si se apaga hasta el lanzamiento abierto.

## D5. Pasar las apps a producción

1. Cloudflare → `fidelizacion-panel` → Settings → **Variables and Secrets** → entorno **Production**: reemplazar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` por los del proyecto de **producción**.
2. Lo mismo en `fidelizacion-tarjeta`.
3. **Retry deployment** en los dos (Parte B).
4. Repetir la verificación del Paso 7 con la cuenta del comercio real (sin cargar clientes inventados en producción).

Las tarjetas creadas en desarrollo dejan de abrir: eran de la base de prueba. Es lo esperado.

## D6. Mails propios (SMTP): necesario antes del primer cliente real

**El problema:** Supabase gratis manda los mails de "confirmá tu cuenta" y "cambiá tu contraseña" con su propio cartero, pero **solo 2 por hora y solo a las direcciones del equipo del proyecto**. Supabase dice que no es para producción. Con la confirmación de email activada (D4), un comerciante real **no podría terminar de registrarse**.

**La solución:** conectar un cartero propio (*SMTP*) gratuito. Recomendado: **Brevo** (300 mails por día gratis, sin tarjeta; Supabase lo lista entre sus proveedores sugeridos).

1. Creá una cuenta gratis en brevo.com.
2. **Remitente.** Brevo pide autenticar un **dominio** (por ejemplo `avisos@tunegocio.com.ar`) copiando dos registros (SPF y DKIM) en el DNS del dominio; así los mails no caen en spam. Comprar un dominio cuesta plata y es un checkpoint ("dominios reales"). Mientras tanto, podés probar con tu email como remitente si Brevo lo acepta, sabiendo que **es probable que lleguen a spam**: sirve para el piloto, no para crecer.
3. Brevo → **SMTP & API** → pestaña **SMTP** → generar una **SMTP key**. Es un secreto: va **solo** en Supabase (nunca en el repositorio, en Cloudflare ni en el chat).
4. Supabase (producción) → **Authentication → Emails → SMTP Settings** → activar *Custom SMTP*:

   | Campo | Valor |
   |---|---|
   | Host | `smtp-relay.brevo.com` |
   | Port | `587` |
   | Username | el email con el que entrás a Brevo |
   | Password | la SMTP key |
   | Sender email | el remitente verificado en Brevo |
   | Sender name | el nombre del producto |

5. **Authentication → Rate Limits:** con SMTP propio, Supabase arranca en 30 mails por hora. Alcanza para empezar; se sube ahí si hace falta.
6. Probar: registrate con un email que **no** sea del equipo de Supabase (por ejemplo uno de un familiar). Tiene que llegar el mail de confirmación.
7. Opcional: traducir los textos de los mails en **Authentication → Emails → Templates**.

Alternativa cuando haya dominio: **Resend** (3.000 mails por mes, 100 por día, gratis).

## D7. Copias de seguridad (backups)

* **El plan gratis de Supabase no tiene backups automáticos.** Si se borra algo por error, no hay botón para volver atrás.
* Hasta pasar a Pro, hacé una copia **cada semana** (y antes de cada migración en producción). En Codespaces, desde la carpeta del repositorio (necesita Docker; Codespaces lo tiene):

  ```bash
  npx supabase link --project-ref <REF-DE-PRODUCCION>   # pide la contraseña de la base
  mkdir -p backups                                       # carpeta ignorada por git: nunca se sube
  npx supabase db dump -f backups/roles.sql --role-only
  npx supabase db dump -f backups/schema.sql
  npx supabase db dump -f backups/data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
  npx supabase unlink
  ```

* **Las copias tienen datos personales:** nunca al repositorio ni a un lugar público. En el explorador de archivos de Codespaces: clic derecho en `backups` → *Download*. Después borralas de Codespaces (`rm -rf backups`), guardalas en un zip con contraseña (y una copia en tu Drive privado), y borrá las de más de un mes.
* Una vez, probar que una copia se puede restaurar en un lugar seguro (Postgres local o un proyecto temporal), nunca sobre producción. Lo prepara Claude con el mentor.
* Cuando haya comercios pagando: pasar producción al plan **Pro** (pago). Trae backups diarios automáticos, la protección de contraseñas filtradas y no se pausa.

## D8. Nota sobre `rls_auto_enable`

Al crear el proyecto, Supabase puede agregar una función propia, `public.rls_auto_enable()`, que activa RLS sola en tablas nuevas de `public`. El *Security Advisor* la marca como alerta. Es casi inofensiva (no se puede llamar desde afuera y solo agrega seguridad); nuestras tablas están en `core` y `loyalty` y sus permisos los ponen las migraciones. Explicación completa y propuesta: `docs/supabase/RLS_AUTO_ENABLE.md`. **No** ejecutar el `REVOKE` que propone ese documento sin la aprobación del mentor.

## D9. Límites del plan gratis de Supabase (para tener a mano)

* 2 proyectos activos por organización.
* 500 MB de base de datos y 5 GB de tráfico por mes por proyecto.
* **Se pausa después de 1 semana sin uso.** Si el comercio cierra por vacaciones, puede pausarse: se reactiva desde el dashboard (*Restore*).
* Sin backups automáticos (D7) y sin protección de contraseñas filtradas (D4).

## D10. Dominio propio (más adelante)

Una dirección como `club.tunegocio.com.ar` es un checkpoint (cuesta plata y toca DNS). Cloudflare Pages permite hasta 100 dominios por proyecto en el plan gratis. Cuando llegue el momento: agregarlo en el proyecto (Custom domains), y después actualizar `VITE_CLIENT_APP_URL` y las direcciones de Supabase (Paso 6 y D4).

---

## Fuentes (consultadas el 2026-10-09)

* Cloudflare Pages, límites del plan gratis: https://developers.cloudflare.com/pages/platform/limits/
* Cloudflare Pages, apps de una sola página y encabezados por defecto: https://developers.cloudflare.com/pages/configuration/serving-pages/
* Cloudflare Pages, archivo `_headers`: https://developers.cloudflare.com/pages/configuration/headers/
* Cloudflare Pages, build watch paths: https://developers.cloudflare.com/pages/configuration/build-watch-paths
* Cloudflare Pages, Node.js y `SKIP_DEPENDENCY_INSTALL`: https://developers.cloudflare.com/pages/configuration/build-image/
* Cloudflare Pages, conectar GitHub: https://developers.cloudflare.com/pages/get-started/git-integration/
* Netlify, cómo funcionan los créditos: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
* Vercel, uso comercial en Hobby: https://vercel.com/docs/limits/fair-use-guidelines
* Supabase, SMTP propio y límites del cartero por defecto: https://supabase.com/docs/guides/auth/auth-smtp
* Supabase, seguridad de contraseñas: https://supabase.com/docs/guides/auth/password-security
* Supabase, precios y límites del plan gratis: https://supabase.com/pricing
* Supabase, backup y restore con la CLI: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
* Brevo, conectar con Supabase: https://developers.brevo.com/docs/supabase-smtp-integration
* Brevo, plan gratis: https://www.brevo.com/free-smtp-server
* Resend, precios: https://resend.com/pricing
