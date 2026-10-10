# Cómo se calculan los resultados de una campaña

Esta guía explica, sin fórmulas raras, qué significan los números que aparecen
en la pantalla de resultados de una campaña de recuperación. Las cuentas las hace
la base de datos (`core.campaign_results` y `core.list_campaign_recipients`); la
pantalla solo las muestra. La decisión de producto está en `DECISIONS.md` (D-021).

## 1. Las dos listas: "a quiénes escribirles" y "grupo de control"

Cuando lanzás una campaña, el sistema toma a todos los clientes del grupo que
elegiste (por ejemplo, "en riesgo") que **pueden** recibir un WhatsApp: tienen
teléfono y aceptaron mensajes. Después los mezcla al azar, como quien mezcla un
mazo de cartas, y los separa en dos:

* **Grupo contactado** (o "a quiénes escribirles"): a estos les mandás el mensaje.
* **Grupo de control**: a estos **no** les escribís. Están para comparar.

¿Para qué sirve no escribirle a algunos? Porque siempre hay gente que vuelve
sola, con o sin mensaje. Si no tuviéramos con quién comparar, le daríamos todo el
mérito a la campaña. El grupo de control nos dice cuántos habrían vuelto igual.

Como la separación es al azar, los dos grupos se parecen (misma clase de
clientes); la única diferencia importante es que a uno le escribiste.

## 2. Qué quiere decir "volvió"

Un cliente **volvió** si tiene al menos una visita válida (no anulada) **después**
de que lanzaste la campaña y **dentro de la ventana** que elegiste (por defecto,
14 días).

* Si vino el día 3, volvió.
* Si vino el día 20 con una ventana de 14 días, no cuenta para esta campaña.
* Si la visita se anula después ("error de carga"), deja de contar sola: los
  resultados se recalculan cada vez que los mirás.

La plata que "trajo" es la suma de lo que gastó en las visitas dentro de esa ventana.

## 3. Las cuentas

Primero se calcula, para cada grupo, **qué parte volvió** (la "tasa"):

```
tasa = cuántos volvieron ÷ cuántos había en el grupo
```

**Clientes incrementales** (los que volvieron *gracias* a la campaña):

```
(tasa del grupo contactado − tasa del grupo de control) × cantidad del grupo contactado
```

**Plata incremental** (la plata que entró *gracias* a la campaña):

```
(gasto promedio del grupo contactado − gasto promedio del grupo de control) × cantidad del grupo contactado
```

El "gasto promedio" es lo que gastó todo el grupo dividido por la cantidad de
personas del grupo (contando también a los que no volvieron, que gastaron $0).

## 4. Ejemplo con números

Lanzás una campaña a 100 clientes en riesgo con 20% de grupo de control:

| | Grupo contactado | Grupo de control |
|---|---|---|
| Personas | 80 | 20 |
| Volvieron en 14 días | 24 | 3 |
| Tasa | 24 ÷ 80 = 30% | 3 ÷ 20 = 15% |
| Gastaron en total | $960.000 | $90.000 |
| Gasto promedio por persona | $960.000 ÷ 80 = $12.000 | $90.000 ÷ 20 = $4.500 |

* **Clientes incrementales** = (30% − 15%) × 80 = 0,15 × 80 = **12 clientes**.
  De los 24 que volvieron, unos 12 habrían vuelto igual; los otros 12 son mérito
  del mensaje.
* **Plata incremental** = ($12.000 − $4.500) × 80 = $7.500 × 80 = **$600.000**.
  De los $960.000 que gastaron, unos $360.000 habrían entrado igual.

Si el grupo de control es 0% no hay con qué comparar: el sistema muestra cuántos
volvieron y cuánto gastaron, pero **no** muestra "incremental" (sería inventar).

## 5. ¿Por qué se multiplica por todo el grupo contactado?

La cuenta usa **todas** las personas del grupo contactado, le hayas mandado el
WhatsApp o no. Si de los 80 solo le escribiste a 50, los otros 30 igual cuentan
(y bajan el promedio, porque se parecen al grupo de control).

Es a propósito: es la forma **conservadora** (prudente) de medir. Nos dice "cuánto
rindió la campaña tal como la ejecutaste", sin agrandar el resultado. Si solo
contáramos a los que efectivamente recibieron el mensaje, podríamos estar eligiendo
sin querer a los más fáciles de recuperar y el número saldría inflado.
Consejo práctico: mandá los mensajes a todos los de la lista.

## 6. Limitaciones (leer antes de sacar conclusiones)

* **Muestras chicas = números que bailan.** Con 10 clientes en control, que vuelva
  1 más o 1 menos cambia la tasa del control en 10 puntos. Con pocos clientes, el
  incremental es una pista, no una certeza. Puede incluso dar negativo por azar.
  Cuantos más clientes, más confiable.
* **La ventana importa.** Solo cuenta lo que pasa dentro de los días elegidos.
  Mientras la ventana está abierta, los números todavía pueden cambiar.
  Un cliente que vuelve el día 15 con ventana de 14 no aparece.
* **Campañas superpuestas.** Si un cliente estuviera en dos campañas a la vez, no
  se sabría cuál lo hizo volver, y los grupos de control se "contaminarían". Por
  eso, al lanzar, el sistema **deja afuera** a quien ya está (contactado o en
  control) en otra campaña con la ventana abierta. La vista previa avisa: "X ya
  están en otra campaña activa y no se incluyen".
* **Bajas después de lanzar.** Si un cliente pide no recibir más mensajes (o se lo
  archiva) después de lanzar, el panel ya no muestra su teléfono ni su mensaje
  ("No quiere mensajes" / "Cliente archivado") y no deja marcarlo como contactado.
  Sigue contando en los resultados como parte de su grupo (así la comparación no
  se rompe).
* **Solo visitas registradas.** Si el cliente vino pero no se registró la visita
  (o no se anotó el monto), el sistema no lo puede saber.
* **Es una estimación.** Nunca es una promesa: es la mejor cuenta honesta que se
  puede hacer con los datos que hay.

## 7. Cupones (la prueba más segura)

Si el mensaje incluye `{cupon}`, cada cliente del grupo contactado recibe un
código propio de 6 letras y números (por ejemplo `K7P2QX`). Cuando vuelve y lo
muestra, el cajero lo escribe en el **Mostrador** ("¿Trae un cupón de una
campaña?") y toca "Usar cupón y registrar visita".

* Un cupón se usa **una sola vez**, solo **dentro de la ventana** de la campaña y
  solo si el cliente sigue activo.
* Un cupón usado siempre queda **atado a una visita** de ese cliente. Si la visita
  ya se había cargado hace un momento (el "+1" del mostrador), se usa esa misma
  y no se carga otra.
* Nadie del equipo puede usar un cupón de un cliente que es su propia cuenta.
* Si el negocio deja de tener el módulo de recuperación, los cupones no se pueden
  buscar ni usar.
* Los resultados muestran **cuántos cupones se usaron**. Si después se anula la
  visita, ese cupón deja de contar.
* El cupón confirma que **esa persona** volvió por el mensaje. Igual, los números
  de "incremental" se siguen calculando con el grupo de control (punto 3): hay
  gente que vuelve por la campaña y se olvida de mostrar el cupón.
