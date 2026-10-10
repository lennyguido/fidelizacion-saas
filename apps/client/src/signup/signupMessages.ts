import type { SelfSignupStatus } from '@plataforma/sdk'

/** Qué decirle a la persona en cada caso. Nunca se revela si el celular ya estaba anotado. */
export const SIGNUP_MESSAGES: Record<SelfSignupStatus, string> = {
  created: '¡Listo!',
  existing:
    'Recibimos tus datos. Si ya estabas anotado, pedí en el mostrador que te reenvíen tu tarjeta.',
  unavailable: 'El alta no está disponible en este momento. Preguntá en el mostrador.',
  rate_limited: 'Hay muchas altas seguidas. Probá de nuevo en unos minutos.',
  terms_required: 'Para anotarte tenés que aceptar que guardemos tus datos.',
  invalid_name: 'Escribí tu nombre (al menos 2 letras).',
  invalid_phone: 'Revisá el celular. Ej: 11 2233-4455',
}
