# Oportunidades de producto

> Análisis del 2026-10-10. **Esto no es backlog.** Es una lista ordenada de ideas con evidencia, para decidir qué entra al backlog después (o durante) el piloto. Nada de esto se construye sin pasar por `TASKS.md` y, cuando corresponde, por un checkpoint humano.
>
> Complementa `docs/IDEAS.md` (problemas de los negocios), `docs/COMPETENCIA.md` y `docs/marketing/`. Precios de la competencia: tomados de sus páginas o de sitios de comparación en octubre de 2026. **Cambian seguido: volver a mirarlos antes de usarlos para vender.**
>
> Cuentas en pesos: usamos **~$1.500 por dólar** como referencia redonda (oct-2026). Verificar la cotización del día.

## Palabras que aparecen

* **Wallet:** la billetera del celular (Apple Wallet en iPhone, Google Wallet en Android). Ahí el cliente guarda la tarjeta como si fuera una tarjeta de embarque.
* **Push:** un aviso que aparece en la pantalla del celular sin abrir nada. Los avisos de una tarjeta de wallet **son gratis**.
* **API:** una "puerta" para que dos sistemas se hablen sin que una persona copie datos.
* **Webhook:** un aviso automático que un sistema (por ejemplo Mercado Pago) le manda al nuestro cuando pasa algo ("entró un pago").
* **Plantilla de WhatsApp:** mensaje pre-aprobado por Meta, obligatorio para escribirle primero a un cliente por la API oficial. Se paga por mensaje.
* **Churn:** cuando un negocio deja de pagar y se va.
* **Esfuerzo:** S = días · M = 1–2 semanas · L = 3 semanas o más (para un desarrollador con este stack).

---

## 0. Lo que ya tenemos (para no repetirlo)

Clientes y visitas (`core`), puntos/sellos, recompensas y canjes en el mostrador, tarjeta digital por link secreto (PWA, QR, código de socio), campañas de recuperación con links `wa.me`, **grupo de control** y resultados incrementales, tablero del mes, marca del negocio, roles del equipo. **En construcción:** tarjeta en Google/Apple Wallet.

Con eso ya estamos a la par de Wappoints y Tienda de Puntos en lo básico, y **por encima** en medir de forma honesta cuánta plata volvió.

---

## 1. Qué aprendimos de la competencia (resumen)

| Producto | Precio (por mes) | Lo que más destaca | Fuente |
|---|---|---|---|
| **Wappoints** (AR) | $30.000 / $55.000 / $95.000 | Wallet, canje por WhatsApp, **cumpleaños y referidos en todos los planes**, API abierta, recuperación automática solo en Pro+. Exportar datos solo en Premium. | wappoints.com |
| **Tienda de Puntos** (AR) | desde ~$55.000, todo incluido | +1.000 marcas, sin app, WhatsApp/mail, sorteos, encuestas, **referidos**, recordatorios automáticos, **acompañamiento para armar el programa** | iProfesional (ene-2026) |
| **Loybox** (AR) | físicos desde USD 249; online USD 69–499 | Pivoteó de "red compartida" a programas propios por marca. IA para segmentar y **generar reseñas**, campañas WhatsApp/mail, Tiendanube | iProUP |
| **Loopy Loyalty** | USD 25 / 69 / 95 | Wallet, push ilimitados, **mensajes por cercanía (geofencing)**, API, Zapier | loopyloyalty.com |
| **Stamp Me** | USD 49 / 79 / 199 | Push ilimitados, **Birthday Club**, herramientas para clientes perdidos, raspá y ganá, **StampTag (NFC)** | stampme.com |
| **Boomerangme** | USD 199 / 259 / 299 | 8 tipos de tarjeta (sellos, cashback, membresía, **gift card**, prepago), referidos, geofencing, **IA que arma el programa desde tu perfil de Google**, encuestas, RFM, POS | boomerangme.com |
| **Kangaroo** | USD 79 / 199 / 399 | Referidos, gift cards, encuestas, IA para campañas, niveles VIP (en el plan del medio) | Capterra |
| **Square Loyalty** | ~USD 45 por sucursal | Integrado al cobro: el cliente se identifica al pagar (teléfono o tarjeta guardada). Datos atrapados en Square | loop.fans (competidor de Square: tomar con pinzas) |
| **Toast Loyalty** | sin precio público (add-on) | Se suma en el cobro; cumpleaños; reportes dentro del POS | loop.fans |
| **Fivestars** | — | Fidelización + pagos. SumUp la compró por USD 317 M (12.000 comercios): **pagos y fidelización se potencian** | TechCrunch |
| **Belly** | — | Tablet en el mostrador; llegó a 10.000 comercios y cerró de golpe tras ser vendida: los negocios **perdieron sus datos** | loop.fans |
| **PassKit** | desde USD 39,50 + por tarjeta | Infraestructura de wallet (no es un producto para el comercio) | passkit.com |
| **Highlight Cards** | no se pudo verificar (el sitio bloquea la lectura) | — | — |
| **Fidelizoo** | no se encontró información pública actual | — | — |

**Patrones claros:**

1. **Wallet + push gratis** es lo mínimo esperado en 2026 (Loopy, Stamp Me, Boomerangme, Wappoints).
2. **Cumpleaños y referidos** están en casi todos, muchas veces en el plan más barato (Wappoints los da en todos).
3. Los caros (Boomerangme, Kangaroo, Loybox) se diferencian con **IA, gift cards/prepago, encuestas y POS**.
4. **Nadie muestra resultado medido contra un grupo de control.** Ese hueco sigue siendo nuestro.

**Por qué los negocios no usan o abandonan estas herramientas** (evidencia):

* 73 % de los comercios chicos de EE. UU. **no tiene** programa; la razón principal es "mi clientela es muy chica para que valga la pena" (SumUp, nov-2025). → Hay que mostrar valor en plata con pocos clientes.
* Los programas fallan por: **demasiado complicados**, el cliente se olvida la tarjeta, premios poco tentadores o muy lejanos, **el personal se olvida de ofrecerlo**, y usarlo como descuento para todos (Stamp Me).
* En software para comercios chicos, **la mayor parte del churn pasa en los primeros 90 días** y depende de cuán rápido el negocio ve valor; el pago mensual se cae 2–3 veces más que el anual (UserJot; cifras sin fuente original, usar como orientación).
* Lección de Belly: el comercio quiere que **sus clientes sean suyos** (poder exportar todo).

**Conclusión práctica:** lo que hace que un comercio **pague y se quede** es (a) que el cajero lo use sin pensar, (b) que el dueño vea **plata** en su celular cada semana sin abrir el panel, y (c) que arrancar tome minutos, no días.

---

## 2. Lista ordenada de oportunidades

El número es el **orden de prioridad global** (1 = lo primero). "Checkpoint" = necesita autorización o una acción del dueño según `CLAUDE.md`.

### A. Imprescindible para competir

**1. Tarjeta en Apple/Google Wallet con avisos gratis** *(en construcción)*
* **Qué es:** la tarjeta se guarda en la billetera del celular y se actualiza sola ("sumaste 1 sello, te faltan 3"). Los cambios generan un aviso en la pantalla.
* **Por qué:** es lo primero que pregunta el cliente final ("no quiero otra app") y **reemplaza mensajes de WhatsApp pagos por avisos gratis**. Ver sección 4: esto cambia la cuenta de costos.
* **Evidencia:** Wappoints, Loopy ("unlimited push"), Stamp Me, Boomerangme ("free push notifications").
* **Esfuerzo:** M (ya empezado). Edge Function que firma la tarjeta de Apple y emite la de Google; reacciona a `visit.recorded`.
* **Costo/humano:** cuenta Apple Developer (USD 99/año) y emisor de Google Wallet (gratis, requiere aprobación). **Checkpoint: credenciales.**

**2. Alta del cliente por QR (autoregistro)**
* **Qué es:** un cartel en el mostrador con un QR. El cliente lo escanea, pone nombre + celular + acepta recibir mensajes, y recibe su tarjeta. El cajero no escribe nada.
* **Por qué:** el riesgo número uno del producto es que el cajero no cargue (ver `IDEAS.md` §10). Esto pasa trabajo del cajero al cliente, y junta el **consentimiento** (Ley 25.326) en el momento.
* **Evidencia:** Tienda de Puntos ("registro por QR o por el encargado"), Wappoints ("escanea un QR en el local"), Stamp Me (código de alta en la StampTag).
* **Esfuerzo:** M. Función pública nueva tipo `get_card` (con límite de intentos por negocio/IP y sin devolver datos de otros clientes). Duplicados por teléfono se fusionan con el cliente existente sin revelar que existía.
* **Costo/humano:** ninguno. Es una función ejecutable sin sesión: **revisión de seguridad del mentor antes de aplicar** (como se hizo con D-020).

**3. Cumpleaños automático**
* **Qué es:** se pide la fecha (día y mes, sin año) y, la semana del cumpleaños, el cliente recibe un regalo (aviso en la wallet o mensaje armado para mandar).
* **Por qué:** es la automatización más fácil de entender para el dueño y la que el cliente recibe con más cariño. Los mails de cumpleaños tienen ~45 % de apertura y mucho más ingreso por mail que una promo común (datos recopilados por DataCandy; son de e-commerce, tomar como orientación).
* **Evidencia:** Wappoints (todos los planes), Stamp Me (Birthday Club), Toast.
* **Esfuerzo:** S. Campo nuevo en `core.customers`, job diario con `pg_cron`, regalo como recompensa con vencimiento.
* **Costo/humano:** ninguno si va por wallet o `wa.me`.

**4. Segunda visita automática ("bienvenida")**
* **Qué es:** a los X días de la primera visita, si no volvió, se le ofrece un motivo para volver. En el panel: **tasa de segunda visita**.
* **Por qué:** es donde más clientes se pierden y la métrica que mejor predice si un negocio crece (`IDEAS.md` §1). Se mide con el grupo de control que ya existe.
* **Evidencia:** Tienda de Puntos ("recordatorios automáticos"), Stamp Me ("lapsed-customer tools"). Nadie mide la segunda visita con control.
* **Esfuerzo:** S (reutiliza campañas + segmentos de `core`).
* **Costo/humano:** ninguno.

**5. Resumen semanal al dueño + detector de pérdidas**
* **Qué es:** los lunes, 5 líneas al dueño: visitas vs. una semana normal, plata recuperada, 3 habituales en riesgo y **una sola acción** con botón ("mandales esto"). Si la semana viene muy por debajo de lo normal, lo avisa ("vinieron 25 % menos personas que un octubre normal").
* **Por qué:** **ataca nuestro propio churn.** El dueño no abre paneles; si cada lunes ve plata, renueva. Es el canal donde se "cobra" el valor.
* **Evidencia:** Boomerangme ("automated reports"); Stamp Me ("activity insights"). Ninguno lo hace con una acción sugerida ni con comparación honesta.
* **Esfuerzo:** S–M. Cálculo en Postgres (ya existe `dashboard_summary`), envío por mail con Edge Function. Al principio el dueño también puede recibirlo como link `wa.me` a sí mismo.
* **Costo/humano:** proveedor de mail (el SMTP propio ya está en `CHECKLIST-PRODUCCION.md`). **Checkpoint: credenciales del proveedor.**

**6. Programa listo en 10 minutos (plantillas por rubro + kit para imprimir)**
* **Qué es:** al registrarse, el dueño elige "cafetería / heladería / barbería / petshop / panadería" y queda armado: regla de sellos, 2 recompensas, mensaje de bienvenida, de cumpleaños y de recuperación, más el cartel con QR en PDF.
* **Por qué:** el churn se decide en los primeros 90 días y depende de cuán rápido se ve valor. Tienda de Puntos vende **acompañamiento para diseñar el programa** como parte del precio; esto es la versión automática y barata.
* **Evidencia:** Tienda de Puntos (acompañamiento), Boomerangme (su IA arma el programa desde el perfil de Google).
* **Esfuerzo:** S. Datos semilla por rubro en el onboarding (`core.create_business`).
* **Costo/humano:** el dueño (nosotros) valida los textos por rubro.

**7. Traé un amigo (referidos)**
* **Qué es:** cada socio tiene un link. Si un amigo nuevo se registra con él y hace su primera visita, los dos ganan. El panel muestra quién trae más gente.
* **Por qué:** el boca a boca es como crece un local de barrio. Además **genera clientes nuevos**, algo que puntos y recuperación no hacen; eso ayuda a vender ("no solo cuida a los que tenés, te trae nuevos").
* **Evidencia:** Wappoints (todos los planes), Tienda de Puntos, Boomerangme, Kangaroo (plan medio).
* **Esfuerzo:** M. En `loyalty`; el premio se da solo con la primera **visita real** del amigo (no con el registro), para que no se fabriquen amigos.
* **Costo/humano:** ninguno.

**8. Pedido de reseña en Google después de la visita (+ alerta privada)**
* **Qué es:** después de una visita, el cliente recibe "¿Cómo te atendimos?" y **a todos** se les ofrece el link para dejar reseña en Google. Si alguien responde mal, además le llega un aviso privado al dueño.
* **Por qué:** 41 % de la gente siempre lee reseñas antes de elegir un local, 31 % solo va a lugares con 4,5 estrellas o más, y 74 % mira reseñas de los últimos 3 meses (BrightLocal 2026, EE. UU.). Las reseñas recientes valen mucho y el dueño lo entiende al instante.
* **Evidencia:** Loybox (IA para generar reseñas), Boomerangme y Kangaroo (encuestas). Wappoints no lo tiene.
* **Cuidado (importante):** Google prohíbe pedir reseñas **solo a los contentos** ("review gating") y prohíbe **premiar** las reseñas. Nada de "dejá reseña y ganá puntos". La versión correcta: pedir a todos, sin premio.
* **Esfuerzo:** M. Versión 1 sin API de Google: el dueño pega su link de reseñas (Google lo da gratis en el perfil). Leer y responder reseñas por API requiere aprobación manual de Google y perfil verificado hace 60+ días: dejarlo para después.
* **Costo/humano:** ninguno en la versión 1.

**9. "Tus clientes son tuyos": exportar todo, en todos los planes**
* **Qué es:** botón para bajar clientes, visitas y puntos en CSV.
* **Por qué:** genera confianza al vender (lección de Belly). Wappoints lo deja solo en su plan más caro: nosotros podemos decir "en Vueltita, siempre".
* **Evidencia:** Wappoints (solo Premium), Loopy (data export), Belly (los comercios perdieron todo al cerrar).
* **Esfuerzo:** S. Solo dueño/admin, queda en auditoría.
* **Costo/humano:** ninguno.

**10. Canje desde el celular del cliente**
* **Qué es:** el cliente elige el premio en su tarjeta y muestra un código que vence en minutos; el cajero lo confirma.
* **Por qué:** saca trabajo del mostrador y hace visible el premio ("me alcanza para un café").
* **Evidencia:** Wappoints (canje por WhatsApp con código), previsto en D-018/D-020.
* **Esfuerzo:** M. Necesita que el link secreto pueda iniciar una acción (hoy `get_card` es solo lectura): **revisión de seguridad**.
* **Costo/humano:** ninguno.

**11. Atribución por cupón** *(pendiente de la Fase 5)*
* **Qué es:** cada mensaje de campaña lleva un cupón; si se usa, la vuelta se atribuye con certeza.
* **Por qué:** refuerza nuestra diferencia (resultados honestos) y da un número fácil de creer.
* **Evidencia:** Boomerangme y Kangaroo (cupones). Ya está en `TASKS.md`.
* **Esfuerzo:** S–M.
* **Costo/humano:** ninguno.

**12. Aviso de puntos por vencer**
* **Qué es:** "Tenés 8 sellos y vencen en 15 días": un motivo concreto para volver.
* **Por qué:** es un mensaje de recuperación que no parece publicidad.
* **Evidencia:** Wappoints (vencimiento de puntos en todos los planes, avisos de vencimiento).
* **Esfuerzo:** S–M (el libro de puntos ya existe; agregar fecha de vencimiento por movimiento).
* **Costo/humano:** decidir la regla de vencimiento con el dueño (cambia la promesa al cliente final: dejarla clara en los términos).

### B. Diferencial fuerte

**13. Mercado Pago: visita y monto sin que el cajero cargue nada**
* **Qué es:** el negocio conecta su cuenta de Mercado Pago. Cada cobro crea una visita con el monto. Si el que paga ya está vinculado (por ejemplo, la primera vez el cajero toca "es Ana"), las siguientes veces se reconoce sola.
* **Por qué:** es **el sueño del mostrador**: cero esfuerzo y datos completos. Aunque no se identifique al cliente, cada cobro entra como **visita sin identificar**, y eso alimenta el detector de pérdidas y el % de clientes identificados. La compra de Fivestars por SumUp (USD 317 M) muestra que pagos + fidelización valen mucho juntos. Ningún competidor argentino lo publica.
* **Verdad incómoda:** "cero esfuerzo" es solo en parte. (a) Los pagos con QR interoperable desde otras billeteras (MODO, bancos) o con tarjeta en un Point traen poca información de quién paga. (b) No está confirmado que podamos recibir avisos de los cobros que el negocio hace con su QR de siempre: puede que solo lleguen los pagos creados por nuestra integración (las órdenes de la API). **Antes de prometerlo, hacer una prueba técnica de 2–3 días.**
* **Evidencia:** documentación de Mercado Pago (webhooks `order.processed` con monto y referencia; OAuth para actuar en nombre del vendedor). Square y Toast hacen esto mismo dentro de su POS.
* **Esfuerzo:** L. Edge Function que recibe webhooks, tabla de cuentas conectadas por negocio, vinculación pago ↔ cliente, deduplicación con `record_visit` (idempotente).
* **Costo/humano:** aplicación en Mercado Pago Developers y conexión con cuentas reales. **Checkpoint: credenciales, producción y datos reales.** La comisión de MP la paga el negocio igual que hoy (~0,6 % + IVA con saldo o débito, según una guía 2026; verificar).

**14. "Vueltita te devolvió $X" como producto, no solo como pantalla**
* **Qué es:** un resumen mensual que se puede compartir (imagen o PDF) con la plata recuperada **medida contra el grupo de control**, y la garantía "si no te trajo de vuelta ni un cliente, ese mes no lo pagás".
* **Por qué:** es la razón para pagar y la diferencia más grande. Wappoints muestra una pantalla de ejemplo; en su web actual no aparece garantía de devolución.
* **Evidencia:** ningún competidor revisado mide con grupo de control.
* **Esfuerzo:** S (los números ya están, D-021).
* **Costo/humano:** decidir la letra chica de la garantía (es una promesa comercial).

**15. Reconocimiento en el mostrador + ranking del equipo**
* **Qué es:** al buscar al cliente, una línea: "Ana · hace 2 años · visita 50 · cortado sin azúcar". Y "esta semana Sofi identificó al 80 % de los clientes".
* **Por qué:** hace que el cajero **quiera** usar el sistema (problema número uno). Stamp Me dice que los programas mueren cuando el personal se olvida.
* **Evidencia:** ninguno lo destaca; Stamp Me identifica el problema.
* **Esfuerzo:** S. Datos que ya existen.
* **Costo/humano:** ninguno.

**16. Mensajes de recuperación escritos por IA (el dueño aprueba)**
* **Qué es:** la IA redacta el mensaje en el tono del negocio, personalizado ("Bruno, hace rato que no te vemos los lunes…"). El dueño toca "enviar". **La IA nunca calcula números**: la base calcula, la IA solo redacta.
* **Por qué:** escribir es lo que más frena al dueño; los grandes ya lo venden.
* **Evidencia:** Boomerangme (Richie AI Marketer), Kangaroo (campañas con IA), Loybox (IA).
* **Esfuerzo:** S–M. Edge Function que llama a un modelo con datos mínimos (nombre de pila, días sin venir, rubro).
* **Costo/humano:** cuenta y clave de un proveedor de IA (costo por uso: centavos de dólar por cientos de mensajes). **Checkpoint: credenciales y privacidad** (no mandar teléfonos ni apellidos; Ley 25.326).

**17. WhatsApp automático por la API oficial** *(Fase 6)*
* **Qué es:** los mensajes salen solos, sin que el dueño toque `wa.me` uno por uno.
* **Por qué:** en Argentina WhatsApp es el canal; la recuperación automática es lo que Wappoints cobra en su plan Pro.
* **Costo real (clave para el precio):** desde julio 2025 Meta cobra **por mensaje**. Para Argentina, referencia: marketing ~USD 0,062 (~$93) y utilidad ~USD 0,026 (~$39) por mensaje (Cliengo; Meta no publica la tabla abierta). Recuperación, cumpleaños y promos son "marketing". **300 mensajes de marketing ≈ $28.000/mes: más que nuestro plan Barrio.**
* **Dato útil:** con "coexistencia" el negocio puede seguir usando su app de WhatsApp Business en el mismo número mientras la API manda las plantillas (pierde listas de difusión y algunas herramientas de la app).
* **Esfuerzo:** L (cola, reintentos, plantillas, webhooks de estado).
* **Costo/humano:** cuenta de Meta Business verificada con CUIT, número, plantillas aprobadas, medio de pago. **Checkpoint: WhatsApp real.**

**18. Llenar horas flojas**
* **Qué es:** detecta "martes 15–18 h vacío" y sugiere un beneficio solo en esa franja a quienes suelen venir a esa hora; medido con control.
* **Por qué:** ataca un dolor de plata concreto (local y personal pagos igual).
* **Evidencia:** no lo vimos en los competidores revisados → diferencial, pero **sin prueba de demanda**: validarlo preguntando en el piloto.
* **Esfuerzo:** M.
* **Costo/humano:** ninguno.

**19. Valor del cliente en pesos**
* **Qué es:** "Ana te deja ~$380.000 por año".
* **Por qué:** transforma "regalar un café" en inversión; ayuda a vender.
* **Evidencia:** Boomerangme (RFM, análisis por valor). Datos ya existentes.
* **Esfuerzo:** S.
* **Costo/humano:** ninguno.

**20. Alertas de cosas raras (fraude chico del personal)**
* **Qué es:** "Lucas cargó 6 visitas a la misma persona", "las anulaciones triplican lo normal".
* **Por qué:** al dueño le importa mucho y casi nadie lo ofrece; ya tenemos topes (D-022) y auditoría.
* **Evidencia:** Boomerangme ("duplicate control"), Wappoints (auditoría).
* **Esfuerzo:** S–M. Puede ir dentro del resumen semanal (#5).
* **Costo/humano:** ninguno.

**21. Integración con Fudo (POS gastronómico argentino)**
* **Qué es:** leer las ventas y clientes de Fudo para crear visitas solas.
* **Por qué:** Fudo dice atender hasta 10.000 restaurantes y tiene API de lectura de ventas y clientes. Para cafés que ya cobran con Fudo, evita cargar dos veces.
* **Cuidado:** la API es **solo para el plan Pro de Fudo**, los tokens vencen cada 24 h, y no encontramos webhooks (habría que consultar cada pocos minutos). Sirve a una parte del mercado, no a la barbería ni al petshop.
* **Esfuerzo:** M–L.
* **Costo/humano:** clave de API de cada negocio. **Checkpoint: credenciales y datos reales.** Hacerlo cuando un cliente real con Fudo lo pida.

### C. Más adelante (o con dudas honestas)

**22. Gift cards digitales**
* **Qué es:** el cliente compra un regalo para otro ("1 corte para papá"); llega como tarjeta al celular.
* **Por qué:** plata por adelantado y clientes nuevos: en encuestas de EE. UU., 41 % dijo que no habría ido al local sin la gift card y la mayoría gasta más que el valor (First Data/Fiserv; datos autodeclarados y viejos).
* **Evidencia:** Boomerangme, Kangaroo (plan medio), Square.
* **Esfuerzo:** L (cobro, saldo, vencimientos, contabilidad).
* **Costo/humano:** **Checkpoint: pagos reales.** El cobro pasa por el Mercado Pago del negocio (no tocamos la plata).

**23. Club de suscripción ("café ilimitado", "corte mensual")**
* **Qué es:** el cliente paga un monto fijo por mes y tiene un beneficio diario o mensual.
* **Por qué:** ingresos fijos y más visitas. Panera llegó a 600.000 socios; un tercio de las veces que retiraban la bebida gratis sumaban comida; dicen que un socio vale ~11 veces un no socio. Para una barbería, el "corte mensual" es muy natural.
* **Cuidado:** funciona en cadenas con margen alto en bebida; en un café chico, un "ilimitado" mal calculado pierde plata. Ofrecer "X cafés por mes", no ilimitado.
* **Esfuerzo:** L (suscripciones de Mercado Pago, estados de pago, control en el mostrador).
* **Costo/humano:** **Checkpoint: pagos reales.**

**24. Saldo a favor / monedero**
* **Qué es:** el cliente carga plata y paga con su saldo.
* **Por qué:** Wappoints lo tiene en Premium; Boomerangme tiene "prepago".
* **Cuidado:** guardar plata de clientes tiene implicancias contables y regulatorias (consultar contador/abogado). **Más riesgo que valor para el arranque.**
* **Esfuerzo:** L. **Checkpoint: pagos y legal.**

**25. Comparaciones entre sucursales y contra el rubro**
* **Qué es:** "tu sucursal Centro recupera el doble que Palermo"; "los cafés parecidos tienen 35 % de segunda visita, vos 22 %".
* **Por qué:** vende el plan Cadena. La comparación con el rubro necesita **muchos negocios** para que no sea un dato inventado ni revele datos de otro negocio.
* **Evidencia:** Boomerangme (plan Franchise), Wappoints (sucursales).
* **Esfuerzo:** M (por sucursal) · L (por rubro, con datos anónimos y agregados; **cambio de arquitectura/privacidad: checkpoint**).

**26. Aviso por cercanía en la wallet (geofencing)** — *suena muy bien, vende poco*
* **Qué es:** cuando el cliente pasa cerca del local, la tarjeta aparece en la pantalla bloqueada.
* **Realidad:** no es un mensaje: es un **atajo** a la tarjeta en la pantalla bloqueada. Máximo 10 ubicaciones por tarjeta, el radio lo decide Apple/Google, en Google el texto no se puede elegir, y Google lo tuvo apagado años (lo está volviendo a lanzar como "Nearby Pass").
* **Esfuerzo:** S **si sale junto con la wallet** (es agregar la ubicación del local a la tarjeta). Hacerlo así, sin venderlo como gran cosa.
* **Costo/humano:** ninguno extra.

**27. Sello por NFC (tocar el celular contra una tarjetita)** — *suena muy bien, no vende*
* **Qué es:** el cliente toca su celular contra un llavero del cajero y suma el sello (StampTag de Stamp Me).
* **Realidad:** necesita hardware, en iPhone la lectura desde la web es limitada, y una etiqueta fija se puede tocar de más (Stamp Me no explica cómo lo evita). Nuestro QR + código de socio ya resuelve lo mismo.
* **Esfuerzo:** M. **No recomendado.**

**28. Autoregistro de visitas "en la mesa" (el cliente escanea y suma solo)** — *con cuidado*
* **Qué es:** QR en la mesa para que el cliente sume su visita sin pasar por caja.
* **Realidad:** un QR fijo permite sumar visitas desde la casa; rompe los topes antifraude (D-022). Solo sirve con un **código que cambia cada pocos segundos en la pantalla del cajero** (Stamp Me usa un "StampCode temporal"). El alta por QR (#2) sí conviene; el sumar visitas solo, no todavía.
* **Esfuerzo:** M.

**29. Niveles VIP, juegos de raspá y ganá, sorteos** — *no ahora*
* **Por qué no:** la complejidad es la primera causa de fracaso de estos programas en comercios chicos (Stamp Me). Los grandes lo tienen en planes caros. Esperar a que un cliente lo pida.

**30. Red de puntos compartida entre comercios del barrio** — *no*
* **Por qué no:** Loybox empezó así y **pivoteó** a programas propios por marca porque los comercios querían el suyo. Además complica la privacidad entre negocios.

**Otras ideas de `IDEAS.md` que siguen vigentes pero no suben de prioridad:** ajuste por inflación en métricas (útil, nicho; M), experimentos con control para cualquier acción (ya es la base de #4, #11 y #18).

---

## 3. Ideas no obvias con mucha palanca (resumen con veredicto)

| Idea | Veredicto | Por qué |
|---|---|---|
| **Avisos de wallet en vez de WhatsApp pago** | **Sí, ya** | Gratis e ilimitados. Hace que "puntos sumados", "cumpleaños" y "se te vencen" no cuesten nada. Es lo que permite un plan barato rentable. |
| **Resumen semanal + detector de pérdidas al dueño** | **Sí, ya** | Es el antídoto contra nuestro churn: el dueño ve plata cada lunes sin abrir nada. |
| **Mercado Pago → visita automática** | **Sí, después de una prueba técnica** | Mayor diferencial posible en Argentina, pero con límites reales (identificación del que paga, alcance de los avisos). Primero confirmar. |
| **Pedido de reseña en Google** | **Sí** (a todos, sin premio) | El dueño lo entiende al instante y lo valora. Premiar reseñas o pedirlas solo a los contentos viola las reglas de Google. |
| **Traé un amigo** | **Sí** | Trae clientes nuevos; la competencia local ya lo tiene, sin él quedamos atrás. |
| **Cumpleaños automático** | **Sí** | Barato, querido, esperado. |
| **IA que escribe los mensajes** | **Sí, con aprobación del dueño** | Ya es argumento de venta de los caros; para nosotros es barato. |
| **Club "X cafés por mes" / corte mensual** | **Más adelante** | Muy bueno para barberías; requiere cobros reales y cuidar el margen. |
| **Gift cards** | **Más adelante** | Clientes nuevos y plata por adelantado; requiere cobros. Buen add-on para diciembre (Día del Padre/Navidad). |
| **Benchmarks multi-sucursal** | **Por sucursal sí (plan Cadena); por rubro, cuando haya muchos negocios** | Sin volumen, el dato es ruido o expone a otro negocio. |
| **Integración con POS (Fudo)** | **Cuando un cliente real la pida** | Útil solo para gastronomía con Fudo Pro. |
| **Geofencing** | **Gratis con la wallet, no venderlo** | Es un atajo en la pantalla, no un mensaje. |
| **QR en la mesa para sumar solo** | **No por ahora** | Rompe el antifraude salvo con código rotativo. |
| **NFC** | **No** | Hardware + poco beneficio frente al QR. |
| **Saldo prepago** | **No por ahora** | Riesgo legal/contable alto para el beneficio. |

---

## 4. Hoja de ruta recomendada: próximos 90 días

Objetivo: **que el negocio del piloto pague y se quede.** Todo lo que no ayude a eso, espera. Se respeta el orden de `TASKS.md`: lo que no está en el backlog entra primero como tarea nueva, decidida por el dueño.

| Orden | Qué | Semanas | Por qué ahora | Cómo se mide en el piloto |
|---|---|---|---|---|
| 1 | **Terminar la wallet** con avisos de cambio de puntos (+ ubicación del local en la tarjeta, sin esfuerzo extra) | 1–3 | Ya está en marcha; abre el canal gratis para todo lo que sigue | % de socios con la tarjeta guardada; visitas con QR vs. búsqueda manual |
| 2 | **Alta por QR + plantillas por rubro + cartel imprimible** | 3–5 | Saca trabajo del cajero y baja el tiempo de arranque de un negocio nuevo | % de clientes identificados (ya está en Inicio); minutos desde el registro hasta la primera visita |
| 3 | **Resumen semanal al dueño** (con detector de pérdidas y alertas raras) | 5–6 | Es lo que hace que el dueño renueve; usa datos que ya existen | ¿El dueño lo abre? ¿Toca la acción sugerida? (preguntarle) |
| 4 | **Cumpleaños + segunda visita automáticos** (y cerrar la **atribución por cupón** pendiente) | 6–8 | Primeras automatizaciones "de fábrica", medidas con control | Tasa de segunda visita; incremental vs. control |
| 5 | **Traé un amigo** | 8–10 | Paridad con Wappoints/Tienda de Puntos y trae clientes nuevos | Clientes nuevos por referido |
| 6 | **Pedido de reseña en Google** (versión sin API) | 10–11 | Valor que el dueño ve en público y en días | Reseñas nuevas en el mes vs. antes |
| 7 | **Prueba técnica de Mercado Pago** (2–3 días, sin datos reales) y decisión | 11–12 | Si funciona, es el diferencial del siguiente trimestre | Informe: qué datos llegan, de qué pagos, con qué identificación |

**Fuera de los 90 días a propósito:** WhatsApp API (checkpoint y costo por mensaje: esperar a tener clientes pagando), IA para redactar (es barato, pero suma un proveedor y revisión de privacidad; buen candidato para el trimestre siguiente), gift cards y suscripciones (pagos reales).

**Lo que el piloto tiene que responder antes del día 90:** ¿cuánta plata recuperada por mes muestra el local? (si es < $50.000, el plan Barrio está caro); ¿el dueño leyó los resúmenes?; ¿qué haría que pague hoy?

---

## 5. Qué significa para los planes y precios

Base: los planes de `docs/marketing/PRECIOS.md` (Barrio $24.900 · Local $44.900 · Cadena $79.900).

**Reglas que salen de la investigación:**

1. **Lo que la competencia argentina da en su plan más barato, nosotros también:** wallet, cumpleaños y referidos (Wappoints los incluye desde $30.000). Si no, Barrio parece peor aunque sea más barato.
2. **Nunca esconder la prueba de valor:** "plata recuperada con grupo de control" y el resumen semanal van en **todos** los planes. Es lo que hace renovar.
3. **Exportar datos en todos los planes** ("tus clientes son tuyos"): Wappoints lo cobra aparte.
4. **WhatsApp automático nunca ilimitado.** Con ~$93 por mensaje de marketing, 300 mensajes cuestan más que el plan Barrio. Incluir un **cupo** en Local y Cadena y cobrar el excedente al costo. El canal por defecto para avisos es la **wallet** (gratis).
5. **Lo que ahorra trabajo o trae plata nueva va en planes más altos:** WhatsApp automático, IA, Mercado Pago, horas flojas.
6. **Lo que mueve plata del cliente (gift cards, club) va como extra con comisión chica o fijo**, no dentro del plan: tiene costos y riesgos propios. Definir el número cuando exista.

**Propuesta de reparto (para validar):**

| Función | Barrio | Local | Cadena |
|---|---|---|---|
| Wallet + avisos gratis | ✅ | ✅ | ✅ |
| Alta por QR + plantillas por rubro | ✅ | ✅ | ✅ |
| Cumpleaños, segunda visita, puntos por vencer | ✅ (mensajes armados / wallet) | ✅ automático | ✅ automático |
| Traé un amigo | ✅ | ✅ | ✅ |
| Plata recuperada con control + resumen semanal | ✅ | ✅ | ✅ por sucursal |
| Exportar datos | ✅ | ✅ | ✅ |
| Pedido de reseña en Google | ✅ (link) | ✅ + alerta privada | ✅ + alerta privada |
| Mensajes escritos por IA | — | ✅ | ✅ |
| WhatsApp automático (API) | — | ✅ con cupo | ✅ con cupo mayor |
| Horas flojas, alertas raras, valor del cliente | valor del cliente | ✅ | ✅ |
| Mercado Pago (visita automática) | — | ✅ (cuando exista) | ✅ |
| Comparación entre sucursales, integración POS | — | — | ✅ |
| Gift cards / club de suscripción | extra | extra | extra |

**Comparación de precios en pesos (referencia ~$1.500/USD):** Loopy desde ~$37.500, Stamp Me desde ~$73.500, Kangaroo desde ~$118.500, Boomerangme desde ~$300.000, Square ~$67.500 por sucursal. Los locales: Wappoints $30.000–95.000, Tienda de Puntos ~$55.000. **Nuestro rango ($24.900–79.900) es razonable**; con wallet + referidos + resumen semanal en Barrio, el plan de entrada queda mejor armado que el básico de Wappoints.

---

## Fuentes

**Competencia y precios**

* [Wappoints — sitio oficial](https://wappoints.com/)
* [Tienda de Puntos — iProfesional: "Invirtieron el costo de un auto usado y crearon una app que factura 50 millones al mes"](https://www.iprofesional.com/negocios/445105-invirtieron-el-costo-de-un-auto-usado-y-crearon-una-app-que-factura-50-millones-al-mes)
* [Loybox — iProUP: "Crearon un club de beneficios para comercios y ya facturan USD 50.000 al año"](https://www.iproup.com/startups/68984-crearon-un-club-de-beneficios-para-comercios-y-ya-facturan-usd-50000-al-ano)
* [Loybox — InfoNegocios](https://infonegocios.info/default/loybox-la-red-de-fidelizacion-que-ya-usan-110-comercios-en-argentina-y-que-quiere-multiplicarse-por-10-en-un-ano)
* [Loopy Loyalty — Pricing](https://www.loopyloyalty.com/pricing)
* [Stamp Me — Pricing plans](https://www.stampme.com/punch-card-app/pricing-plans/)
* [Stamp Me — Qué es la StampTag](https://help.stampme.com/en/articles/9328188-what-is-a-stamptag)
* [Boomerangme — Pricing](https://boomerangme.com/pricing) · [Boomerangme — sitio](https://boomerangme.com/)
* [Boomerangme — Software Advice](https://www.softwareadvice.com/product/501190-Boomerangme/)
* [Kangaroo Rewards — Capterra pricing](https://www.capterra.com/p/149363/Kangaroo-Rewards/pricing/)
* [Square Loyalty review — Loop (competidor de Square)](https://loop.fans/blog/square-loyalty-program-review)
* [Toast Loyalty review — Loop (competidor de Toast)](https://loop.fans/blog/toast-loyalty-program-review-features-pricing-alternatives)
* [PassKit — Pricing rates](https://passkit.com/pricing/rates/)
* [SumUp compra Fivestars por USD 317 M — TechCrunch](https://techcrunch.com/?p=2217893)
* [Belly: qué pasó — Loop](https://authors.loop.fans/blog/belly-loyalty-program)
* [Fudo consigue USD 7,5 M — Techloy](https://www.techloy.com/argentinian-saas-startup-fudo-secures-7-5-million-in-seed-funding/)
* [Fudo — API de propósito general (centro de ayuda)](https://intercom.help/fudoapp/es/articles/11939789-api-de-proposito-general)

**Wallet**

* [Google Wallet Nearby Pass — Android Authority](https://www.androidauthority.com/google-wallet-nearby-pass-rollout-3607222)
* [PassKit — cuántas ubicaciones activan el mensaje en pantalla bloqueada](https://help.passkit.com/en/articles/2010114-how-many-locations-will-trigger-a-lock-screen-message)
* [Airship — Location-Based Pass Alerts](https://www.airship.com/docs/guides/wallet/user-guide/notifications/triggers/)

**WhatsApp**

* [Meta — Pricing on the WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/pricing)
* [Cliengo — Guía de precios WhatsApp Business 2026](https://guiawabusiness.cliengo.com/precios)
* [ChatDaddy — WhatsApp Business API Argentina 2026](https://www.chatdaddy.tech/blog/whatsapp-business-api-argentina)
* [Chakra — WhatsApp coexistence](https://chakrahq.com/article/whatsapp-coexistence-business-app-register-cloud-api/)

**Mercado Pago y pagos**

* [Mercado Pago Developers — Notificaciones de QR](https://www.mercadopago.com.ar/developers/en/docs/qr-code/notifications)
* [Mercado Pago Developers — Gestión de OAuth](https://mercadopago.cl/developers/en/docs/oauth/management)
* [Cómo cobrar con QR en Argentina: comisiones 2026 — Jonatan Almeira](https://www.jonatanalmeira.com/?p=70857)

**Reseñas y Google**

* [BrightLocal Local Consumer Review Survey 2026 — resumen de PinMeTo](https://www.pinmeto.com/news/brightlocal-local-consumer-review-survey-2026/)
* [Riesgos del review gating — Vendasta](https://vendasta.com/blog/review-gating)
* [Google Business Profile API 2026: acceso y documentación — Slashpost](https://slashpost.ai/blogs/google-business-profile/google-business-profile-api-documentation-2026)

**Por qué pagan o se van, y efectos de cada función**

* [SumUp: 73 % de los comercios chicos no tiene programa de fidelización](https://www.sumup.com/en-us/press/loyalty-data-story/)
* [Stamp Me: por qué fallan los programas de fidelización](https://www.stampme.com/blog/why-loyalty-programs-fail)
* [UserJot: benchmarks de churn en SaaS 2025](https://userjot.com/blog/saas-churn-rate-benchmarks)
* [DataCandy: impacto de los premios de cumpleaños](https://datacandy.com/resources/whats-the-revenue-impact-of-offering-birthday-rewards)
* [Panera amplía su suscripción de bebidas — Restaurant Dive](https://www.restaurantdive.com/news/panera-expands-coffee-subscription-to-include-all-self-serve-drinks/622243/)
* [Estadísticas de gift cards 2026 — SchedulingKit](https://schedulingkit.com/de/statistics/gift-card-industry-statistics)
