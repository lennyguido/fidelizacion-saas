# Alta del cliente por QR

> Decisión: `DECISIONS.md` D-032. Migraciones `20261011010000_core_self_signup.sql`
> y `20261011010100_loyalty_self_signup.sql`.
>
> ⚠ **Pendiente de revisión del mentor:** agrega una función que puede usar
> cualquiera sin cuenta (`loyalty.self_signup`). No se aplica en Supabase hasta
> que la revise. Mientras tanto, en el proyecto de desarrollo el alta no funciona.

## Qué hace, en simple

1. El dueño activa el alta en **Fidelización → Alta por QR** e imprime el cartel
   ("Imprimir cartel", tamaño A4 o A5, o "Guardar PDF").
2. El cliente escanea el QR con la cámara, escribe su **nombre y celular** y marca
   dos casillas (las dos empiezan sin tildar):
   * aceptar que el negocio guarde sus datos (**obligatoria**);
   * recibir promociones por WhatsApp (**opcional**; queda registrado con fecha y
     fuente `self_signup`, Ley 25.326).
3. Recibe su **tarjeta** al instante (la misma del link secreto, D-020). Anotarse
   no da puntos.

## Seguridad

* El cartel lleva un **código de 10 caracteres al azar**, no el nombre del negocio:
  no se puede adivinar. "Cambiar código" invalida el cartel viejo.
* Viene **apagado**; solo dueño o admin lo prenden. Exige el módulo de fidelización.
* Máximo **30 altas por hora** por negocio.
* **Si el celular ya estaba anotado:** no se revela nada, no se devuelve la tarjeta y
  no se cambia el consentimiento. La persona ve un mensaje genérico y el negocio un
  aviso en **Avisos del alta**, con un botón para ir a su ficha y reenviarle la
  tarjeta (no hay forma de saber si quien escribe es el dueño de ese número).

## Plantillas por rubro

En **Fidelización → Empezar con una plantilla** (dueño o admin): cafetería, heladería,
panadería, barbería, petshop u otro. Arman la regla del programa y dos recompensas
(las recompensas activas anteriores se desactivan, no se borran). Si el programa ya
tiene movimientos, pide confirmación. El titular del cartel sale de la plantilla
elegida (por ejemplo, "Sumate al club: tu 9.º café es gratis").

## Para el mentor

* Funciones: `loyalty.self_signup` (anon) → `core.self_signup_business` y
  `core.self_signup_customer` (internas, sin grant). Panel: `core.set_self_signup`,
  `core.rotate_self_signup_code`, `core.resolve_self_signup_notice`,
  `loyalty.list_templates`, `loyalty.apply_template`.
* Tests: `042-self-signup` y `043-loyalty-templates`; el meta-test lista
  `loyalty.self_signup` como segunda función anon.
* Pantallas: `apps/client/src/signup/` (ruta `/alta/<código>`) y
  `apps/admin/src/modules/loyalty/` (`SelfSignupCard`, `PosterPage`, `TemplatesCard`).
