# Tarjeta en Google Wallet y Apple Wallet

> Guía para el dueño del proyecto. Explica qué es, qué cuentas hay que crear y qué
> "secrets" (claves secretas) hay que cargar. Nada de esto se puede hacer desde el
> código: son pasos en páginas de Google, Apple y Supabase que tenés que hacer vos.

## 1. ¿Qué es esto?

Hoy el cliente abre su tarjeta de puntos con un link (D-020). Con esto, además puede
**guardarla en la billetera del teléfono**, como una entrada de cine o una tarjeta de
embarque:

* **Google Wallet** (Android): gratis. Es lo primero que vamos a usar.
* **Apple Wallet** (iPhone): el código ya está, pero Apple pide una cuenta paga de
  desarrollador (ver sección 7).

Cuando el cliente suma puntos, la tarjeta de la billetera **se actualiza sola** y el
teléfono puede mostrar un aviso en la pantalla bloqueada (Google permite hasta 3 avisos
por día por tarjeta).

Qué datos viajan a Google/Apple: **nombre de pila, puntos, código de socio, nombre,
logo y color del negocio**. Nunca teléfono, email ni apellido.

### Cómo funciona por dentro (versión corta)

```text
Tarjeta (navegador) ──"quiero agregarla"──▶ Edge Function `wallet` ──▶ Google Wallet
                                              │  (tiene las claves secretas)
Base de datos: cambia el saldo ──▶ cola loyalty.wallet_updates
                                              ▲
Cada 5 minutos (pg_cron) ──"mandá los cambios"──┘
```

* Una **Edge Function** es un programa chico que corre en los servidores de Supabase.
  Ahí viven las claves secretas: nunca llegan al teléfono del cliente.
* Un **secret** es una clave guardada en Supabase que solo la Edge Function puede leer.
* Mientras no cargues los secrets, la función responde "no configurado" y **el botón no
  aparece** en la tarjeta. No se rompe nada.

## 2. Crear la cuenta de emisor de Google Wallet (gratis)

"Emisor" (issuer) es quien emite tarjetas: tu empresa.

1. Entrá a la consola de Google Pay & Wallet: <https://pay.google.com/business/console/>
   con la cuenta de Google de la empresa.
2. Escribí el nombre público del negocio (el de tu empresa, no el de cada cliente) y
   aceptá los términos.
3. En el panel, en la tarjeta **Google Wallet API**, tocá **Create a pass** y después
   **Build your first pass**. Aceptá los términos de Google Wallet API.
4. Anotá el **Issuer ID** (un número largo) que aparece en el panel de Google Wallet API.
   Es el valor de `GOOGLE_WALLET_ISSUER_ID`.

La cuenta empieza en **modo demo**: solo vos (y las cuentas de prueba que agregues)
pueden guardar tarjetas, y aparecen con la marca "[TEST ONLY]". Para clientes reales hay
que pedir acceso de publicación (paso 4).

Fuentes: [Setting up a Google Wallet API Issuer account](https://developers.google.com/wallet/retail/loyalty-cards/getting-started/issuer-onboarding),
[Prerequisites](https://developers.google.com/wallet/retail/loyalty-cards/web/prerequisites).

## 3. Crear la cuenta de servicio en Google Cloud

Una **cuenta de servicio** es un "usuario robot" que usa nuestra Edge Function para
hablar con Google. Su clave es un archivo JSON.

1. Entrá a <https://console.cloud.google.com> y creá un proyecto nuevo (por ejemplo
   "fidelizacion-wallet") con el menú de proyectos de arriba.
2. Activá la API: abrí
   <https://console.cloud.google.com/apis/library/walletobjects.googleapis.com> y tocá
   **Enable**.
3. Creá la cuenta de servicio: abrí
   <https://console.cloud.google.com/iam-admin/serviceaccounts/create>, poné un nombre
   (por ejemplo "wallet"), **copiá el email** que aparece debajo de "Service account ID"
   y tocá **DONE** (los pasos opcionales se saltan).
4. Creá la clave: entrá a la cuenta de servicio → pestaña **KEYS** → **ADD KEY** →
   **Create new key** → tipo **JSON** → **CREATE**. Se descarga un archivo `.json`.
   **Es una clave secreta: no la mandes por chat ni la subas a GitHub.**
5. Autorizá al robot en la consola de Wallet: en <https://pay.google.com/business/console/>
   → **Users** → **Invite a user** → pegá el email del paso 3 → **Access level:
   Developer** → **Invite**.

Fuente: [Generate REST API credentials](https://developers.google.com/wallet/retail/loyalty-cards/getting-started/auth/rest).

## 4. Pasar de "demo" a clientes reales (cuando lo quieras usar de verdad)

1. En la consola, completá **Business Profile** (datos de la empresa).
2. Tiene que existir al menos una "clase" de tarjeta: se crea sola la primera vez que
   alguien toca "Agregar a Google Wallet" en la tarjeta (en modo demo, hacelo vos).
3. En **Google Wallet API**, en el recuadro "Get publishing access", tocá **Request
   publishing access** y esperá el mail de aprobación de Google.

Fuente: [Request publishing access](https://developers.google.com/wallet/retail/loyalty-cards/test-and-go-live/request-publishing-access).

## 5. Cargar los secrets en Supabase

En el proyecto de Supabase: **Project → Edge Functions → Secrets** (o "Edge Function
Secrets"). Por cada fila: escribí el nombre en **Key**, el valor en **Value** y **Save**.
No hace falta volver a publicar la función después de cambiar un secret.

| Nombre | Qué poner | ¿Obligatorio? |
|---|---|---|
| `GOOGLE_WALLET_ISSUER_ID` | El número del paso 2.4 | Sí, para Google |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` | **Todo** el contenido del archivo `.json` del paso 3.4 (abrilo con el Bloc de notas, copiá y pegá) | Sí, para Google |
| `WALLET_SYNC_SECRET` | Una contraseña larga inventada por vos (por ejemplo, 40 letras y números al azar). La usa el reloj del paso 6 | Sí, para que se actualicen los puntos |
| `WALLET_ALLOWED_ORIGINS` | La dirección de la tarjeta, por ejemplo `https://tarjeta-xxx.pages.dev` (varias, separadas por coma) | Recomendado |
| `WALLET_DEFAULT_LOGO_URL` | Un link público a un logo PNG, para negocios que no subieron logo PNG/JPG | Opcional |

Notas:

* Google necesita un logo **PNG o JPG**. Si el negocio subió un logo SVG o WebP (o
  ninguno) y no cargaste `WALLET_DEFAULT_LOGO_URL`, la tarjeta muestra: "El negocio
  todavía no cargó su logo…".
* `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` **no se cargan**: Supabase se los da solos
  a la función. Esa clave nunca va al frontend.
* También se puede cargar todo con la terminal: `supabase secrets set --env-file wallet.env`
  (con un archivo que **no** se sube a GitHub).

Fuente: [Supabase · Managing secrets](https://supabase.com/docs/guides/functions/secrets).

### Publicar la función

Con la terminal (Codespaces), en la carpeta del proyecto:

1. `supabase login` (una sola vez).
2. `supabase link --project-ref <ref-del-proyecto>` (una sola vez; el "ref" está en la
   dirección del proyecto: `https://<ref>.supabase.co`).
3. `supabase functions deploy wallet`

La configuración `verify_jwt = false` ya está en `supabase/config.toml`: la tarjeta no
tiene sesión y Apple llama directo, así que cada ruta se protege sola (con el código de
la tarjeta, el token del pase o `WALLET_SYNC_SECRET`).

Para probar: abrí `https://<ref>.supabase.co/functions/v1/wallet/status`. Tiene que
decir `{"google":true,"apple":false}`. Si dice `false`, falta o está mal algún secret.

## 6. Que los puntos se actualicen solos (reloj cada 5 minutos)

Cuando cambia el saldo, la base deja anotado "este pase cambió" en
`loyalty.wallet_updates`. Hace falta algo que cada tanto le diga a la función "mandá
los cambios a Google". Para eso usamos **pg_cron** (un reloj dentro de la base) y
**pg_net** (para que la base llame a una dirección web).

1. En Supabase: **Database → Extensions** → activá `pg_cron` y `pg_net`.
2. En **SQL Editor**, pegá esto cambiando los dos valores de las primeras líneas
   (el primero es la dirección del proyecto; el segundo, el mismo `WALLET_SYNC_SECRET`).
   Se guardan en **Vault** (la caja fuerte de Supabase) para que no queden a la vista:

```sql
select vault.create_secret('https://TU-REF.supabase.co', 'wallet_base_url');
select vault.create_secret('EL-MISMO-WALLET_SYNC_SECRET', 'wallet_sync_secret');

select cron.schedule(
  'wallet-google-sync',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'wallet_base_url')
           || '/functions/v1/wallet/google/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-wallet-sync-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'wallet_sync_secret')),
    body := '{}'::jsonb
  );
  $job$
);
```

3. Para ver si anda: `select * from cron.job_run_details order by start_time desc limit 5;`
   y `select status, count(*) from loyalty.wallet_updates group by status;`
   (`done` = enviado, `pending` = esperando, `failed` = falló 8 veces).

Detalles: el envío es en tandas, se puede repetir sin problema (mandar dos veces el
mismo saldo no cambia nada) y si Google falla se reintenta más tarde (2, 4, 8… minutos).
Por defecto Google muestra un aviso cuando cambia el saldo. El cuerpo del pedido acepta
`{"notify": false}` (sin avisos) o `{"message": {"header": "…", "body": "…"}}` (agrega
un mensaje a cada tarjeta actualizada).

Fuentes: [Supabase · Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions),
[Google · Push notifications](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/trigger-push-notifications).

## 7. Apple Wallet (más adelante, tiene costo)

Qué hace falta:

* **Apple Developer Program**: 99 USD por año
  ([Choosing a Membership](https://developer.apple.com/support/compare-memberships)).
* Una computadora Mac ayuda (para el pedido de certificado con "Acceso a Llaveros"),
  pero también se puede hacer con `openssl`.

Pasos (con la cuenta paga):

1. **Pass Type ID**: en [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources)
   → **Identifiers** → **+** → **Pass Type IDs** → descripción e identificador (por
   ejemplo `pass.com.tuempresa.tarjeta`) → **Continue** → **Register**. Ese texto es
   `APPLE_PASS_TYPE_ID`.
2. **Certificado**: **Certificates** → **+** → **Pass Type ID Certificate** → elegí el
   Pass Type ID → subí un "pedido de firma de certificado" (archivo `.certSigningRequest`)
   → **Download** (archivo `.cer`).
   * Crear el pedido con openssl (guarda la clave privada en `pass-key.pem`):
     `openssl req -new -newkey rsa:2048 -nodes -keyout pass-key.pem -out pass.certSigningRequest -subj "/CN=Tarjeta"`
   * Pasar el `.cer` a PEM: `openssl x509 -inform der -in pass.cer -out pass-cert.pem`
3. **Certificado intermedio de Apple (WWDR G4)**: bajalo de
   <https://www.apple.com/certificateauthority/> ("Worldwide Developer Relations - G4") y
   pasalo a PEM igual que el anterior (`wwdr-g4.pem`).
4. **Team ID**: está en la página de tu membresía de Apple Developer (10 letras/números).
5. Cargá en Supabase (sección 5) estos secrets: `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`,
   `APPLE_PASS_CERT_PEM` (contenido de `pass-cert.pem`), `APPLE_PASS_KEY_PEM` (contenido
   de `pass-key.pem`), `APPLE_WWDR_PEM` (contenido de `wwdr-g4.pem`) y, si la clave tiene
   contraseña, `APPLE_PASS_KEY_PASSPHRASE`.

Con eso, `/wallet/status` dice `"apple": true` y aparece el botón "Agregar a Apple
Wallet". El iPhone se registra solo en el "web service" de la función para recibir
cambios.

**Pendiente (cuando exista la cuenta):** el aviso automático al iPhone (APNs: un
"push" vacío que le dice "bajá la tarjeta nueva") todavía no está programado. Mientras
tanto la tarjeta de Apple se actualiza cuando el cliente la refresca a mano.

Fuentes: [Create wallet identifiers and certificates](https://developer.apple.com/help/account/configure-app-capabilities/create-wallet-identifiers-and-certificates),
[Building a Pass](https://developer.apple.com/documentation/walletpasses/building-a-pass),
[WWDR intermediate certificates](https://developer.apple.com/help/account/certificates/wwdr-intermediate-certificates),
[Adding a web service to update passes](https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes).

## 8. Tarjeta de sellos

Como las tarjetas de cartón del café: una fila de casilleros que se van llenando con el
**logo del negocio** en cada visita. Se ve así en los tres lugares:

* **Tarjeta por link** (el navegador del cliente): casilleros en filas de 5, el último
  sello "cae" con una animación corta (no se anima si el teléfono pide "reducir
  movimiento"), y los textos "Te faltan X sellos para …" y "Recompensas listas: N".
* **Google Wallet**: la fila de sellos es la imagen grande del pase (`heroImage`).
* **Apple Wallet**: la fila de sellos va en la franja del medio (`strip.png` y
  `strip@2x.png`); el saldo pasa arriba, al lado del logo, para no taparla.

Cuándo aparece: siempre en los programas **"Tarjeta de sellos"** (se elige en
Fidelización → "Cómo se muestra") y también en los de **puntos** cuando la recompensa
cuesta 20 puntos o menos. Sin recompensas activas no hay casilleros (no hay meta).

Cuántos casilleros: tantos como cuesta la **próxima recompensa** que todavía no le
alcanza. Si ya le alcanzan todas, la tarjeta apunta a la más barata y se muestra llena.
Como mucho se dibujan **20**; si la recompensa cuesta más, se llenan en proporción (por
ejemplo, 15 de 30 sellos = 10 de 20 casilleros). La cuenta la hacen
`card.stampSlots()` (SDK, tarjeta por link) y `lib/stamps.ts` (wallet), con la misma
regla.

### La imagen de sellos

`GET /wallet/stamps.png?b=<id del negocio>&n=<llenos>&t=<total>&v=<versión de la marca>`

* Es pública (Google la tiene que poder bajar) y no lleva datos del cliente: solo el
  color y el logo del negocio, que ya son públicos (D-024). Responde 404 si el negocio
  no tiene el módulo de fidelización y 400 si los números no cierran (`t` entre 1 y 20,
  `n` entre 0 y `t`).
* `v` es una huella corta del logo y el color: si el negocio los cambia, cambia la URL y
  Google baja la imagen nueva. Por eso la imagen se guarda en caché "para siempre"
  (`immutable`). Con una `v` vieja, o si el logo no se pudo bajar, se sirve igual pero
  con caché de 5 minutos.
* Cada vez que cambia el saldo, el sync (sección 6) manda a Google la URL nueva junto con
  los puntos, así que la imagen se actualiza sola.

**Cómo se dibuja (limitación):** la imagen se arma dentro de la Edge Function con código
propio en TypeScript (`lib/stampImage.ts` y `lib/png.ts`), sin librerías nativas ni
WASM: no hay que instalar nada ni bajar archivos al arrancar, y la misma tarjeta da
siempre los mismos bytes. A cambio:

* El logo se usa solo si es **PNG** (como ya pasaba con Apple). Con un logo JPG, WebP o
  SVG, los casilleros llenos muestran un **tilde** (✓) en vez del logo. Recomendación al
  dueño: subir el logo en PNG.
* PNG entrelazados, muy grandes (más de 4096 px de lado o 4 millones de píxeles) o de
  más de 1 MB también caen en el tilde.
* No se dibujan textos en la imagen: los textos van en los campos del pase.
* Si un programa deja de ser de sellos, Google conserva la última imagen hasta que se
  vuelva a guardar el pase.

## 9. Para programadores

* Código: `supabase/functions/wallet/` (Deno). Lógica pura en `google/objects.ts`,
  `apple/pass.ts`, `apple/zip.ts`, `lib/text.ts`; tests en `tests/` (`deno test tests/`
  dentro de la carpeta). La firma de Apple (`apple/sign.ts`, node-forge) se carga solo si
  Apple está configurado.
* Base: `supabase/migrations/20261010141302_loyalty_wallet.sql`. Tablas
  `loyalty.wallet_passes`, `loyalty.wallet_devices`, `loyalty.wallet_updates` y funciones
  `loyalty.wallet_*`: **solo service role** (sin permisos para el panel ni la tarjeta).
  Tests: `supabase/tests/database/024-wallet.test.sql`. Tarjeta de sellos:
  `20261010141333_loyalty_wallet_stamps.sql` (`programKind` y `stampGoal` en
  `loyalty.wallet_pass_data`, y `loyalty.wallet_stamp_brand`), tests en
  `025-wallet-stamps.test.sql` y `tests/stamps_test.ts`.
* Rutas: `GET /wallet/status`, `GET /wallet/stamps.png`, `POST /wallet/google`, `POST /wallet/google/sync`,
  `POST /wallet/apple`, `GET /wallet/apple/download/:serial?auth=…`,
  `POST /wallet/apple/sync`, y el web service de PassKit bajo `/wallet/apple/v1/…`.
* Frontend: `packages/sdk/src/wallet.ts` y `apps/client/src/card/WalletButtons.tsx`.
* Límite conocido: si un cliente se **archiva** (sin salir del programa), la tarjeta de
  la billetera se marca inactiva recién con el próximo cambio de saldo o estado del socio.
