# Problemas de los negocios e ideas de funciones

> Análisis del 2026-10-09. **Esto no es backlog:** son ideas para priorizar después de validar el mostrador con un negocio real. Ninguna se construye sin decidirlo antes.
>
> Cada idea responde al menos una pregunta de la "regla final" de `TASKS.md`: ¿ayuda a que el cliente vuelva, a que venga más seguido, a recuperarlo, a demostrar que volvió o a que el negocio opere mejor?

## Cómo leer esta lista

* **Datos:** qué necesita. "Ya los tenemos" = sale de lo que hoy guarda el sistema (visitas, clientes, montos, estados).
* **Esfuerzo:** chico (días), medio (1–2 semanas), grande (más).
* **Dónde vive:** núcleo (`core`) o el módulo que corresponda (ver `docs/ARCHITECTURE.md`).

---

## 1. "Vino una vez y nunca más volvió"

**Problema:** la mayoría de los clientes nuevos no vuelve. El negocio no se entera, porque nunca supo quiénes eran.

**Idea — Segunda visita.** A los pocos días de la primera visita, el sistema propone un mensaje con un motivo para volver ("tu segundo café va por la casa"). En el panel se muestra la **tasa de segunda visita**: de cada 10 clientes nuevos, cuántos volvieron. Es la métrica que más predice si un negocio crece.

* Datos: ya los tenemos (estado NEW + primera visita). · Esfuerzo: chico. · Dónde: `recovery`.

## 2. "Me entero tarde de que alguien dejó de venir"

**Problema:** cuando el dueño nota que un habitual desapareció, ya pasaron meses.

**Idea — Aviso diario al dueño.** Un mensaje corto cada mañana: "Bruno venía todos los lunes y hace 12 días que no viene. ¿Le escribimos?", con un botón que arma el mensaje listo para mandar.

* Datos: ya los tenemos (riesgo por ritmo propio). · Esfuerzo: chico. · Dónde: `recovery`.

## 3. "El dueño no tiene tiempo de mirar un panel"

**Problema:** los dashboards no se usan. El dueño está atendiendo.

**Idea — Resumen semanal en 5 líneas por WhatsApp**, con **una sola acción sugerida**: "Esta semana vinieron 142 clientes (+8 %). 3 habituales están en riesgo. Sugerencia: mandales esto 👉".

* Datos: ya los tenemos. · Esfuerzo: chico (con envío manual al principio). · Dónde: núcleo (mensajería) + `recovery`.

## 4. "Mis empleados no conocen a los clientes"

**Problema:** con la rotación de personal se pierde el trato personal. El cliente fiel no se siente reconocido.

**Idea — Reconocimiento en el mostrador.** Al buscar al cliente, el panel muestra en una línea lo que importa: "Ana · viene hace 2 años · hoy es su visita 50 🎉 · toma cortado sin azúcar". A veces el reconocimiento vale más que los puntos.

* Datos: ya los tenemos (estadísticas + notas). · Esfuerzo: chico. · Dónde: núcleo.

## 5. "Los martes a la tarde está vacío"

**Problema:** días y horarios muertos, con el local y el personal pagos igual.

**Idea — Llenar horas flojas.** El sistema detecta las franjas con menos visitas y sugiere un beneficio solo para esa franja, enviado a los clientes que **suelen poder venir en ese horario** (lo sabe por su historial). Medido con grupo de comparación.

* Datos: ya los tenemos (hora de cada visita). · Esfuerzo: medio. · Dónde: `recovery` (y después `booking` para turnos libres).

## 6. "Los clientes contentos no dejan reseñas; los enojados sí"

**Problema:** la reputación en Google la arman los enojados. Las quejas llegan cuando ya son públicas.

**Idea — Encuesta de un toque + escudo de reseñas.** Después de la visita: "¿Cómo te atendimos? 😀 😐 😞".

* Si responde 😀, se lo invita a dejar una reseña en Google.
* Si responde 😞, le llega un aviso **privado** al dueño para que lo resuelva antes de que se vuelva una mala reseña.

* Datos: visita + consentimiento. · Esfuerzo: medio. · Dónde: `reputation`.
* Cuidado: Google prohíbe pedir reseñas solo a los contentos (*review gating*). La invitación a reseñar se puede ofrecer a todos; lo distinto es que el 😞 dispara además la alerta privada. Revisar las políticas vigentes antes de construir.

## 7. "No sé si la promo sirvió"

**Problema:** el negocio hace promociones a ciegas. Si vienen más clientes no sabe si fue por la promo, por el clima o por casualidad.

**Idea — Experimentos fáciles.** Toda acción (campaña, beneficio, horario flojo) se lanza con un grupo de comparación automático, y el sistema responde en castellano: "La promo trajo 9 visitas más de las que habrían venido igual: unos $54.000".

* Datos: ya los tenemos (grupo de control previsto). · Esfuerzo: medio. · Dónde: núcleo (campañas).

## 8. "La inflación me rompe los puntos y los números"

**Problema:** "1 punto cada $1.000" queda viejo en meses, y "facturé más que el año pasado" puede ser mentira con 100 % de inflación.

**Ideas:**

* **Premios en productos, no en pesos** ("10 visitas = 1 café") por defecto.
* **Comparaciones en pesos de hoy:** mostrar las métricas ajustadas por inflación ("en pesos de hoy vendiste 12 % menos que en octubre del año pasado"), usando el índice oficial publicado.

* Datos: visitas + índice de inflación. · Esfuerzo: medio. · Dónde: núcleo.

## 9. "Empleados que regalan puntos o cargan visitas de más"

**Problema:** fraude chico pero constante, o errores que nadie ve.

**Idea — Alertas de cosas raras.** "Lucas cargó 6 visitas a la misma persona hoy", "las anulaciones de esta semana triplican lo normal". Ya existe el registro de cada cambio y de quién lo hizo.

* Datos: ya los tenemos (auditoría + visitas por empleado). · Esfuerzo: chico/medio. · Dónde: núcleo.

## 10. "Mis empleados no usan el sistema"

**Problema:** si el cajero no registra, no hay datos. Es el riesgo número uno del producto.

**Ideas:**

* **Mostrador en menos de 5 segundos** (ya está).
* **Ranking amistoso del equipo:** "esta semana Sofi identificó al 80 % de los clientes", para que el dueño premie a quien lo usa.

* Datos: ya los tenemos. · Esfuerzo: chico. · Dónde: núcleo.

## 11. "El boca a boca no lo puedo medir ni premiar"

**Problema:** el mejor cliente es el que trae otros, y el negocio no sabe quién es.

**Idea — Traé un amigo.** Cada cliente tiene un link o código. Cuando un amigo viene por primera vez con ese código, los dos ganan. El panel muestra quién trae más clientes.

* Datos: código de referido en el alta. · Esfuerzo: medio. · Dónde: `loyalty`.

## 12. "No sé cuánto vale un cliente"

**Problema:** el dueño no sabe cuánto puede invertir para recuperar a alguien.

**Idea — Valor del cliente en pesos:** "Ana te deja unos $380.000 por año". Con eso, "regalarle un café para que vuelva" se entiende como inversión, no como pérdida.

* Datos: ya los tenemos. · Esfuerzo: chico. · Dónde: núcleo.

## 13. "Quiero ingresos fijos, no depender del día a día"

**Problema:** ventas que suben y bajan con el clima o la quincena.

**Ideas:**

* **Membresías del negocio:** "café ilimitado por $X al mes", "club del corte mensual". El cliente paga por mes y viene más seguido.
* **Gift cards digitales** para regalar: plata por adelantado y clientes nuevos que llegan por un regalo.

* Datos: requieren cobros (Mercado Pago u otro). · Esfuerzo: grande. · Dónde: módulo nuevo.

## 14. "Cargar todo dos veces (caja + fidelización)"

**Problema:** fricción y datos incompletos.

**Ideas:**

* Registrar la visita sola cuando el cliente paga con QR de Mercado Pago, o cuando un turno se marca "asistió".
* Importación CSV (ya está).

* Esfuerzo: medio/grande. · Dónde: núcleo (integraciones).

## 15. "¿Bajaron las ventas o es idea mía?"

**Problema:** caídas generales (obra en la cuadra, competidor nuevo) que se notan tarde.

**Idea — Detector de pérdidas del negocio:** compara cada semana con las semanas parecidas anteriores, incluidas las visitas sin identificar, y avisa: "esta semana vinieron 25 % menos personas que lo normal para octubre".

* Datos: ya los tenemos. · Esfuerzo: chico/medio. · Dónde: `recovery`.

## 16. "El cliente no quiere otra app"

**Idea — Tarjeta en la billetera del celular** (Apple Wallet / Google Wallet), que se actualiza sola con los puntos. Se vio en la competencia (ver `COMPETENCIA.md`).

* Esfuerzo: medio. · Dónde: `loyalty` (Fase 4).

---

## Prioridad sugerida (para discutir)

| Orden | Idea | Por qué |
|---|---|---|
| 1 | Reconocimiento en el mostrador (4) | Chico, usa datos que ya están y hace que el empleado quiera usar el sistema |
| 2 | Segunda visita (1) | La métrica que más predice el crecimiento; chico |
| 3 | Aviso diario al dueño (2) + resumen semanal (3) | Convierte los datos en una acción concreta sin tener que mirar el panel |
| 4 | Valor del cliente (12) | Chico; ayuda a vender el producto y a decidir campañas |
| 5 | Experimentos con grupo de comparación (7) | Es la diferencia principal frente a la competencia |
| 6 | Tarjeta en la billetera (16) | Lo que pide el cliente final; va con la Fase 4 |
| 7 | Horas flojas (5) · encuesta + reseñas (6) · inflación (8) | Muy diferenciales; esfuerzo medio |
| Después | Referidos, alertas raras, membresías, gift cards, integraciones | Necesitan validación o cobros |
