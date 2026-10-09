/** Error de la plataforma con un código estable para mostrar mensajes al usuario. */
export type AppErrorCode =
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'conflict'
  | 'slug_taken'
  | 'duplicate_visit'
  | 'duplicate_phone'
  | 'duplicate_email'
  | 'limit_reached'
  | 'insufficient_points'
  | 'reward_unavailable'
  | 'member_inactive'
  | 'module_disabled'
  | 'customer_not_active'
  | 'empty_segment'
  | 'campaign_not_draft'
  | 'control_group'
  | 'consent_revoked'
  | 'auth_invalid_credentials'
  | 'auth_email_not_confirmed'
  | 'auth_user_exists'
  | 'auth_weak_password'
  | 'auth_invalid_email'
  | 'rate_limited'
  | 'upload_failed'
  | 'network'
  | 'unknown'

export class AppError extends Error {
  readonly code: AppErrorCode

  constructor(code: AppErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

interface PostgrestLikeError {
  code?: string
  message?: string
}

interface AuthLikeError {
  code?: string
  message?: string
  status?: number
}

const DOMAIN_CODES = [
  'empty_segment',
  'campaign_not_draft',
  'control_group',
  'consent_revoked',
  'insufficient_points',
  'reward_unavailable',
  'member_inactive',
  'module_disabled',
  'customer_not_active',
] as const

/** Convierte un error de PostgREST (base de datos) en AppError. */
export function fromPostgrestError(error: PostgrestLikeError): AppError {
  const message = error.message ?? 'Error desconocido'
  if (message.includes('slug_taken')) return new AppError('slug_taken', message)
  if (message.includes('duplicate_visit')) return new AppError('duplicate_visit', message)
  for (const code of DOMAIN_CODES) {
    if (message.includes(code)) return new AppError(code, message)
  }

  switch (error.code) {
    case '42501':
      return new AppError('forbidden', message)
    case 'P0002':
    case 'PGRST116':
      return new AppError('not_found', message)
    case '22023':
    case '23514':
      return new AppError('invalid', message)
    case '23505':
      return new AppError('conflict', message)
    case '54000':
      return new AppError('limit_reached', message)
    default:
      return new AppError('unknown', message)
  }
}

/** Convierte un error de Supabase Auth en AppError. */
export function fromAuthError(error: AuthLikeError): AppError {
  const message = error.message ?? 'Error de autenticación'
  switch (error.code) {
    case 'invalid_credentials':
      return new AppError('auth_invalid_credentials', message)
    case 'email_not_confirmed':
      return new AppError('auth_email_not_confirmed', message)
    case 'user_already_exists':
    case 'email_exists':
      return new AppError('auth_user_exists', message)
    case 'weak_password':
      return new AppError('auth_weak_password', message)
    case 'email_address_invalid':
    case 'validation_failed':
      return new AppError('auth_invalid_email', message)
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
    case 'over_sms_send_rate_limit':
      return new AppError('rate_limited', message)
    default:
      if (error.status === 0) return new AppError('network', message)
      if (error.status === 429) return new AppError('rate_limited', message)
      return new AppError('unknown', message)
  }
}

/** Mensajes en castellano para mostrar al usuario. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof AppError)) return 'Ocurrió un error inesperado. Probá de nuevo.'
  const messages: Record<AppErrorCode, string> = {
    forbidden: 'No tenés permiso para hacer esto.',
    not_found: 'No encontramos lo que buscabas.',
    invalid: 'Revisá los datos ingresados.',
    conflict: 'Ya existe un registro con esos datos.',
    slug_taken: 'Esa dirección ya está en uso. Probá con otra.',
    duplicate_visit: 'Esta visita ya se registró hace un momento.',
    duplicate_phone: 'Ya hay un cliente con ese teléfono.',
    duplicate_email: 'Ya hay un cliente con ese email.',
    limit_reached: 'Llegaste al límite de tu plan.',
    insufficient_points: 'No le alcanzan los puntos para esta recompensa.',
    reward_unavailable: 'Esta recompensa no está disponible (desactivada o vencida).',
    member_inactive: 'Este cliente ya no está en el programa de puntos.',
    module_disabled: 'Tu plan no incluye esta función.',
    customer_not_active: 'Primero reactivá a este cliente.',
    empty_segment:
      'Nadie de este grupo puede recibir el mensaje: necesitan teléfono y haber aceptado WhatsApp.',
    campaign_not_draft: 'Esta campaña ya se lanzó o se canceló.',
    control_group: 'Este cliente es del grupo de control: no hay que escribirle.',
    consent_revoked:
      'Este cliente ya no quiere recibir mensajes (o fue archivado): no hay que escribirle.',
    auth_invalid_credentials: 'Email o contraseña incorrectos.',
    auth_email_not_confirmed: 'Confirmá tu email antes de ingresar. Revisá tu casilla.',
    auth_user_exists: 'Ya existe una cuenta con ese email. Probá ingresar.',
    auth_weak_password: 'La contraseña es muy débil. Usá al menos 8 caracteres.',
    auth_invalid_email: 'Revisá el email: no parece válido.',
    rate_limited: 'Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.',
    upload_failed: 'No se pudo subir el archivo. Revisá tu conexión y probá de nuevo.',
    network: 'No hay conexión. Revisá tu internet.',
    unknown: 'Ocurrió un error inesperado. Probá de nuevo.',
  }
  return messages[error.code]
}
