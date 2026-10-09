# Guía para probar todo (puntos, tarjeta, recuperación)

> Complementa `GUIA-PRUEBA-MOSTRADOR.md` (registro, login, clientes, visitas, archivado). Anotá ✅ o ❌ en cada paso y mandá captura de lo que falle con el número.

## Antes (una sola vez)

1. Supabase → **Settings → Data API → Exposed schemas**: agregá **`loyalty`** (además de `core`) y guardá. Sin esto, las pantallas de puntos dan error.
2. En el Codespace: `git checkout main`, `git pull` (si se queja, antes `git stash`), `npm install`.
3. Terminal 1: `npm run dev` (panel, puerto 5173).
4. Terminal 2 (botón **+** de la terminal): `npm run dev:client` (tarjeta del cliente, puerto 5174).
5. Para abrir la tarjeta **desde tu celular**: en la pestaña **Ports** del Codespace, clic derecho en el 5174 → **Port visibility → Public**.

## Puntos y recompensas

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| 1 | Menú **Fidelización** → "Guardar programa" | Dice "1 punto por visita" |
| 2 | "Cambiar" → Por compra: 1 punto cada $ 1.000 → Guardar | Dice "1 punto por visita + 1 punto cada $ 1.000" |
| 3 | Nueva recompensa "Café gratis", 5 puntos → Agregar | Aparece en la lista |
| 4 | Abrí un cliente → tarjeta **Puntos** → "Sumar al programa" | Muestra 0 puntos |
| 5 | En su ficha: "+ Registrar visita" | Pasa a 1 punto |
| 6 | En el **Mostrador**, buscalo, monto 3.500 → +1 (esperá 2 minutos desde la visita anterior: es la protección contra doble carga) | Suma 1 + 3 = 4 → total 5 |
| 7 | En su ficha: "Canjear" en Café gratis | "Canje confirmado. Código: XXXXXX" y vuelve a 0 |
| 8 | "Cancelar canje" con un motivo | Vuelven los 5 puntos |
| 9 | "Ajustar puntos a mano": +10, motivo "Regalo" | 15 puntos y aparece en Movimientos |

## Tarjeta digital del cliente

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| 10 | En la ficha: "Crear tarjeta digital" | Aparece un link largo y los botones WhatsApp / Copiar |
| 11 | Copiá el link y abrilo (o mandalo a tu WhatsApp y abrilo en el celu) | "Hola, (nombre)", los puntos, un QR y el código de 8 letras |
| 12 | Mirá "Recompensas" | Barra de progreso o "¡Ya podés canjearla!" |
| 13 | En el **Mostrador** escribí el código de 8 letras | "Socio encontrado por código" con botón +1 |
| 14 | (Solo Chrome en Android) "Escanear QR de la tarjeta" y apuntá al QR | Se completa el código solo |
| 15 | En la ficha: "Generar link nuevo" y abrí el link **viejo** | "Este link ya no funciona" |

## Tablero y recuperación

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| 16 | **Inicio** | Tarjeta "Este mes": visitas, ventas, ticket promedio, nuevos, recuperados, en juego |
| 17 | En la ficha de un cliente con teléfono: "Mensajes por WhatsApp" → "Acepta WhatsApp" | Dice "Acepta mensajes (desde…)" |
| 18 | Menú **Recuperación** | Listas "En riesgo" e "Inactivos" (pueden estar vacías: un cliente pasa a "en riesgo" cuando tarda más de lo normal en volver) |
| 19 | "Nueva campaña" | Vista previa: "N clientes entran… M aceptaron WhatsApp" y "Así le llega a Ana" |
| 20 | "Guardar y revisar" | Borrador con "Lanzar campaña" (deshabilitado si nadie aceptó WhatsApp) |
| 21 | Si hay alguien: "Lanzar campaña" → "WhatsApp" en un cliente | Se abre WhatsApp con el mensaje armado; al volver dice "mensaje enviado" |
| 22 | Registrale una visita a ese cliente y volvé a la campaña | En Resultados: "Volvieron (les escribiste)" sube y aparece "Volvió · $…" |
| 23 | En la lista "A quiénes escribirles", mirá el código que dice "Cupón ……" de otro cliente | Cada cliente tiene un código distinto de 6 letras y números, y el mensaje de WhatsApp lo incluye |
| 24 | **Mostrador** → "¿Trae un cupón de una campaña?" → escribí ese código (con o sin guion, en minúscula también) | Aparece el nombre del cliente, el beneficio y "Vence el …" |
| 25 | "Usar cupón y registrar visita" | Mensaje "Cupón usado: …". En la campaña, el cliente dice "Cupón …… · usado" y Resultados muestra "Cupones usados: 1" |
| 26 | Escribí el mismo código otra vez | Dice "Este cupón ya se usó." y no deja usarlo |

> Para tener clientes "en riesgo" en la prueba sin esperar semanas, se pueden cargar visitas viejas con la importación CSV… o pedirle a Claude que cree datos de demo en desarrollo.
