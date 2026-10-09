# Análisis de mercado

> Investigado el 2026-10-09. Los precios de la competencia cambian seguido (inflación): **volver a mirarlos antes de salir a vender.** Donde dice "estimación" es una cuenta nuestra, no un dato publicado.

## 1. Lo que dicen los datos del consumidor argentino

| Dato | Qué significa para nosotros | Fuente |
|---|---|---|
| **95 %** conoce algún programa de fidelización, pero **43 %** no participa de ninguno. | La gente sabe qué es, pero muchos no se anotan. Hay que medir también al que **no** quiere puntos (nuestro diseño ya lo hace: cliente ≠ socio de puntos). | VML Loyalty Pulse, vía Mercado |
| Solo ~**30 %** se mantiene fiel a una sola marca; la **facilidad de uso** es de lo más valorado (~33 %). | Gana el que es más fácil: sin app, sin tarjeta, solo el celular. | VML Loyalty Pulse, vía InfoNegocios |
| Gastronomía y comercio de barrio muestran participación **baja**. | Oportunidad: es justo el segmento menos atendido por los programas de las grandes cadenas. | VML Loyalty Pulse, vía InfoNegocios |
| WhatsApp funciona como "infraestructura social": la mayoría contrató servicios y compró por WhatsApp. | El canal para recuperar clientes es WhatsApp, no la app ni el mail. | Infobip Messaging Trends 2026, vía Mercado |
| El retail argentino migra de "descuentos masivos" a fidelización personalizada. | El mensaje "dejá de regalar descuentos a todos, premiá al que vuelve" ya está instalado. | Mercado / ITSitio |

## 2. Competencia directa (comercio local, Argentina)

| Competidor | Modelo | Precio publicado | Tamaño | Fuente |
|---|---|---|---|---|
| **Tienda de Puntos** | Programa de puntos marca blanca, QR, WhatsApp/mail | Desde ~$55.000/mes | +1.000 marcas, ~$50 M/mes de facturación según la nota | iProfesional (jun-2026), Forbes Argentina |
| **Wappoints** | Puntos + recuperación por WhatsApp | $30.000 / $55.000 / $95.000 por mes; 30 días gratis; "si no vuelve ningún cliente, no pagás" | s/d | Su web (ver `docs/COMPETENCIA.md`) |
| **Loybox** | Red de puntos compartida entre comercios + app en Tiendanube | Desde ~$20.000/mes (dato 2025) | ~110 comercios | InfoNegocios, iProUP |
| Fidelizoo, Fide Club, apps genéricas | Tarjeta de sellos digital | Bajo / freemium | s/d | Comparasoftware, Tiendanube |
| **Sustitutos** | Tarjeta de cartón con sellos, grupo/lista de difusión de WhatsApp, Instagram | ~$0 | Los usa casi todo el mundo | — |

**Nuestro verdadero competidor es la tarjetita de cartón y "no hacer nada".** El dueño no compara software: compara contra no gastar.

## 3. Dónde hay un hueco

Lo que ninguno muestra bien es **cuánta plata volvió de verdad por el sistema**. Wappoints muestra una pantalla de ejemplo ("Recuperaste 12 clientes, $214.000"), pero no explica cómo separa al cliente que iba a volver igual.

Nuestra arquitectura ya trae un **grupo de control** (D-009): a una parte chica de los clientes "dormidos" no se les manda el mensaje, y se compara. Así podemos decir *"estos $186.000 volvieron por Vueltita; estos otros $40.000 hubieran vuelto igual"*. Eso es **honestidad medible** y es nuestra diferencia principal.

Otras diferencias reales (ya construidas o en el diseño):

1. **Sin app para el cliente:** alcanza con el número de celular en caja.
2. **Cuenta también al que no quiere puntos** (visitas sin programa).
3. **Una base, varios productos:** turnos, reseñas, club VIP después, sin migrar datos.
4. **Privacidad en regla** (Ley 25.326): baja de datos, aviso para el local, consentimiento y opt-out centralizados.

## 4. Tamaño del mercado (estimación)

* En Argentina hay alrededor de **2,9 millones de monotributistas y autónomos** (dato de prensa 2026; confirmar con ARCA). Solo una parte tiene local con clientes que repiten.
* Segmento inicial (clientes que vuelven seguido y ticket chico/medio): **cafeterías, panaderías, heladerías, barberías/peluquerías, petshops, verdulerías, dietéticas, lavaderos.**
* Cuenta simple: si conseguimos **300 locales a $30.000/mes** → $9 M/mes. Con **1.000 locales** → $30 M/mes. Es el orden de magnitud que la prensa le atribuye a Tienda de Puntos, así que **es alcanzable pero hay que ganarse cada local**.
* Costo de infraestructura: Supabase gratis alcanza para el piloto; el plan pago (~USD 25/mes) alcanza para cientos de locales. El margen es alto: el costo real es **vender y acompañar**.

## 5. Riesgos

| Riesgo | Cómo lo bajamos |
|---|---|
| El dueño no carga las visitas (se olvida, hay fila) | Registro en 2 toques; cajero con manual de 1 página; medir % de clientes identificados (ya en Inicio). |
| WhatsApp oficial cuesta por mensaje y Meta puede bloquear números | Mensajes solo con consentimiento; empezar con pocos y bien elegidos; nunca listas compradas. |
| Inflación desactualiza precios | Precio en pesos con ajuste trimestral anunciado; descuento por pago anual. |
| Competidor con más plata baja precios | Competir por resultado medido y cercanía, no por precio. |
| Cliente final siente spam | Máximo de mensajes por cliente, opt-out en 1 toque (mensajería del núcleo). |

## Fuentes

* [El 95 % de los argentinos conoce programas de fidelización pero el 43 % aún no participa — Mercado](https://mercado.com.ar/marketing/el-95-de-los-argentinos-conoce-programas-de-fidelizacion-pero-el-43-aun-no-participa)
* [¿Sirven los programas de fidelidad? VML Argentina, Loyalty Pulse — InfoNegocios](https://infonegocios.info/enfoque/sirven-los-programas-de-fidelidad-vml-argentina-con-su-estudio-loyalty-pulse-lo-responde)
* [El informe de Infobip describe a WhatsApp como infraestructura social en Argentina — Mercado](https://mercado.com.ar/tendencias/el-informe-de-infobip-describe-a-whatsapp-como-infraestructura-social-en-argentina)
* [Menos descuentos masivos y más personalización — Mercado](https://mercado.com.ar/marketing/menos-descuentos-masivos-y-mas-personalizacion-la-fidelizacion-se-impone-en-el-retail-argentino)
* [Invirtieron el costo de un auto usado y crearon una app que factura 50 millones al mes — iProfesional](https://www.iprofesional.com/negocios/445105-invirtieron-el-costo-de-un-auto-usado-y-crearon-una-app-que-factura-50-millones-al-mes)
* [De una charla en un bar a procesar 300.000 transacciones — Forbes Argentina](https://www.forbesargentina.com/negocios/de-una-charla-bar-procesar-300000-transacciones-historia-startup-democratiza-fidelizacion-n86607)
* [Loybox, la red de fidelización que ya usan 110 comercios — InfoNegocios](https://infonegocios.info/default/loybox-la-red-de-fidelizacion-que-ya-usan-110-comercios-en-argentina-y-que-quiere-multiplicarse-por-10-en-un-ano)
* [Software de fidelización de clientes — Comparasoftware](https://www.comparasoftware.com/fidelizacion-de-clientes)
* [Fide Club — Tiendanube](https://www.tiendanube.com/tienda-aplicaciones-nube/fide-club)
