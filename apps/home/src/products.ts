/**
 * Los productos de Neriva. Esta lista arma el mapa de la línea, la sección
 * "Cada estación, una herramienta" y el footer. Para sumar un producto nuevo,
 * agregá un bloque más: va a aparecer como estación en el orden de la lista.
 */
export interface Product {
  /** Identificador corto, sin espacios (se usa en el código). */
  id: string
  /** Nombre que se muestra. */
  name: string
  /** Nombre corto para la estación del mapa. */
  station: string
  /** Frase corta: qué te resuelve. */
  tagline: string
  /** Una o dos oraciones con lo que hace. */
  description: string
  /** Adónde lleva el link. Puede ser otra página o una sección de esta ("#contacto"). */
  href: string
  /** Texto del link. */
  linkLabel: string
}

export const PRODUCTS: Product[] = [
  {
    id: 'turnos',
    name: 'Neriva Turnos',
    station: 'Turnos',
    tagline: 'Tus clientes reservan solos',
    description:
      'Tus clientes eligen el servicio, con quién y el horario desde el celular, sin llamarte. Vos ves la agenda del día por profesional y movés un turno arrastrándolo.',
    href: 'https://turnos.neriva.net',
    linkLabel: 'Conocer Neriva Turnos',
  },
  {
    id: 'fidelizacion',
    name: 'Neriva Fidelización',
    station: 'Fidelización',
    tagline: 'Tus clientes vuelven',
    description:
      'Te avisa qué clientes dejaron de venir, te arma el WhatsApp para invitarlos a volver y te muestra cuánta plata volvió. Con tarjeta de sellos en el celular, sin app.',
    href: 'https://fidelizacion.neriva.net',
    linkLabel: 'Conocer Neriva Fidelización',
  },
  {
    id: 'web',
    name: 'Web para tu local',
    station: 'Tu web',
    tagline: 'Tu local, en internet',
    description:
      'Una web simple con tus servicios, fotos, horarios y el botón para sacar turno. La hacemos nosotros.',
    href: '#contacto',
    linkLabel: 'Pedir mi web',
  },
]
