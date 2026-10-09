# Identidad de marca (Vueltita)

## Personalidad

Como el almacenero que te conoce por el nombre: **cercano, claro y honesto**. Habla de vos, en castellano rioplatense, sin palabras en inglés ("fidelización" se puede decir; "engagement", "churn", "loyalty" no).

| Somos | No somos |
|---|---|
| Del barrio, prácticos | Corporativos, fríos |
| Honestos con los números ("esto es lo que volvió de verdad") | Promesas infladas ("¡triplicá tus ventas!") |
| Simples (1 pantalla, 1 botón) | Complicados, llenos de opciones |
| Respetuosos con el cliente final (no spam) | "Bombardealos de mensajes" |

## Colores

La idea: **cálido como un local con la persiana levantada**, y el verde reservado para una sola cosa: la **plata que volvió**.

| Nombre | Hex | Para qué | Contraste |
|---|---|---|---|
| **Terracota** (principal) | `#C2410C` | Botones principales, logo, títulos destacados | 5,2:1 sobre blanco ✅ AA |
| **Noche** (texto) | `#1C1917` | Texto principal, fondo oscuro | 16,5:1 sobre Crema ✅ AAA |
| **Crema** (fondo) | `#FFF7ED` | Fondo de la web y carteles | — |
| **Yerba** (dinero/éxito) | `#15803D` | **Solo** "plata recuperada", "volvió", confirmaciones | 5,0:1 sobre blanco ✅ AA |
| **Mostaza** (acento) | `#FACC15` | Etiquetas, resaltados, stickers. Siempre con texto Noche | 11,4:1 con Noche ✅ |
| **Piedra** (secundario) | `#57534E` | Texto secundario, bordes | 7,2:1 sobre Crema ✅ |
| **Durazno** (modo oscuro) | `#FB923C` | Reemplaza a Terracota sobre fondo Noche | 7,7:1 ✅ |

Contrastes calculados con la fórmula de WCAG 2.1 (AA = mínimo para texto normal, 4,5:1).

**Por qué no azul ni violeta:** la mayoría del software (y los bancos) usa azul; las billeteras virtuales, celeste o violeta. Terracota + crema se diferencia en una vidriera de Instagram y se asocia con comida, café y barrio, que es nuestro cliente.

Para Tailwind (panel): Terracota = `orange-700`, Crema = `orange-50`, Yerba = `green-700`, Mostaza = `yellow-400`, Noche = `stone-900`, Piedra = `stone-600`, Durazno = `orange-400`.

## Tipografía

* **Títulos:** *Bricolage Grotesque* (Google Fonts, gratis). Con personalidad, un poco "de cartel".
* **Texto e interfaz:** *Inter* (Google Fonts, gratis). Se lee perfecto en celulares baratos.
* Números grandes (plata recuperada) en Inter con números tabulares.

## Logo (brief para un diseñador)

* Palabra **vueltita** en minúscula, Bricolage Grotesque, Terracota.
* Ícono: una **flecha que da la vuelta** (↻) formando el punto de la "i" o abrazando la "v". Tiene que verse bien chiquito (ícono de app, 48 px) y en un sticker de vidriera.
* Versiones: color sobre Crema, blanco sobre Terracota, una sola tinta (Noche) para imprimir barato.
* Presupuesto razonable: un diseñador freelance local o una convocatoria en una escuela de diseño. **Hacerlo después de registrar el nombre** (ver `NOMBRE.md`).

## Tono: ejemplos

| En vez de… | Decimos… |
|---|---|
| "Plataforma de fidelización omnicanal" | "Que tus clientes vuelvan. Y saber cuántos volvieron." |
| "Aumentá tu retención un 300 %" | "El mes pasado volvieron 14 clientes que hacía 2 meses no venían. Gastaron $186.000." |
| "Error 401" | "Se cerró tu sesión. Entrá de nuevo." |
| "¡Última oportunidad! ¡¡Descuento!!" | "Hace mucho que no te vemos, Marta. Esta semana el café va por la casa ☕" |

## Material para el local (piloto)

* **Sticker de vidriera** (10×10 cm): "Acá sumás tu vueltita 📲 — pedí tu cuenta en caja".
* **Cartelito de caja** (A6): "¿Te anotamos? Solo tu celular. Sin app." + aviso de privacidad (ver `docs/piloto/AVISO-PRIVACIDAD.md`).
