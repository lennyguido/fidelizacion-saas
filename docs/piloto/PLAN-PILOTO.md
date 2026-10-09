# Plan del piloto (2 semanas con un negocio real)

> Es el "checkpoint de producto" de la Fase 3 en `TASKS.md`. La pregunta que queremos responder:
> **¿el personal registra las visitas todos los días sin que se lo pidan?** Si la respuesta es no, hay que cambiar el producto antes de construir más.

## A quién elegir

* Un negocio donde los clientes **vuelven seguido**: café, kiosco, panadería, peluquería, almacén.
* Que tenga **una sola caja** y un dueño accesible (un conocido, un familiar).
* Que tenga un celular o una tablet en el mostrador con internet.

## Qué ofrecerle (en sus palabras)

> "Estoy armando una herramienta para que sepas quiénes son tus clientes habituales y te avise cuando alguno deja de venir. ¿Me dejás probarla gratis 2 semanas? Solo hay que tocar un botón cuando atendés a alguien. Al final te muestro qué descubrimos."

No prometer descuentos, puntos ni resultados en plata: en el piloto todavía no hay programa de puntos.

## Día 0 — preparación (30 minutos, con el dueño)

1. Crear la cuenta y el negocio desde el panel (la persona que use el panel es el "dueño" en el sistema).
2. Si tiene una lista de clientes (Excel, agenda), importarla con **Clientes → Importar**.
3. Dejar el panel abierto en el celular o tablet del mostrador, en la pantalla **Mostrador**.
4. Mostrarle al cajero el `MANUAL-CAJERO.md` (1 página) y hacer 3 visitas de práctica.
5. Pegar el cartel de privacidad (`AVISO-PRIVACIDAD.md`) cerca de la caja.

## Qué mirar cada día (5 minutos)

Anotar en la tabla de abajo, con lo que se ve en el panel:

| Día | Visitas registradas | De esas, con cliente identificado | Clientes nuevos | Problemas o comentarios |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| … | | | | |

Señales de alarma (avisar a Claude o al mentor):

* un día sin ninguna visita registrada;
* el cajero dice que "tarda mucho" o que "no hay tiempo";
* clientes que no quieren dar su nombre (se usa "+ Visita sin identificar", está bien);
* cualquier error en pantalla (sacar captura).

## Al final (día 14) — preguntas para el dueño

1. ¿Lo usaron todos los días? Si no, ¿por qué?
2. ¿Cuántos segundos tardaban en registrar una visita?
3. ¿Viste algo en el panel que no sabías de tus clientes?
4. ¿Qué te gustaría que haga que hoy no hace?
5. ¿Pagarías por esto? ¿Cuánto te parece razonable por mes?

## Cómo saber si salió bien

| Resultado | Qué significa | Qué hacemos |
|---|---|---|
| Registraron visitas **casi todos los días** y la mayoría con cliente identificado | El mostrador funciona | Pasamos a la Fase 4 (puntos y recompensas) |
| Registraron **a veces** | Hay fricción | Arreglamos lo que molestó y repetimos 1 semana |
| **Dejaron de usarlo** a los pocos días | El diseño no sirve así | Rediseñamos la carga (QR del cliente, integración con pagos) antes de seguir |
