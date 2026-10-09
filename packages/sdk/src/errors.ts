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
  | 'already_member'
  | 'member_disabled'
  | 'owner_protected'
  | 'invitation_email_mismatch'
  | 'invitation_unavailable'
  | 'limit_reached'
  | 'auth_invalid_credentials'
  | 'auth_email_not_confirmed'
  | 'auth_user_exists'
  | 'auth_weak_password'
  | 'auth_invalid_email'
  | 'rate_limited'
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

/** Convierte un error de PostgREST (base de datos) en AppError. */
export function fromPostgrestError(error: PostgrestLikeError): AppError {
  const message = error.message ?? 'Error desconocido'
  if (message.includes('slug_taken')) return new AppError('slug_taken', message)
  if (message.includes('duplicate_visit')) return new AppError('duplicate_visit', message)
  if (message.includes('already_member')) return new AppError('already_member', message)
  if (message.includes('member_disabled')) return new AppError('member_disabled', message)
  if (message.includes('owner_protected')) return new AppError('owner_protected', message)
  if (message.includes('invitation_email_mismatch')) {
    return new AppError('invitation_email_mismatch', message)
  }
  if (message.includes('invitation_unavailable'))
    return new AppError('invitation_unavailable', message)

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
    already_member: 'Esa persona ya es parte del equipo.',
    owner_protected:
      'No podés cambiar el rol de otro dueño. Cada dueño solo puede cambiarse a sí mismo.',
    member_disabled:
      'Esa persona está desactivada en el equipo. El dueño puede reactivarla desde la lista de miembros.',
    invitation_email_mismatch:
      'Esta invitación es para otro email. Salí e ingresá con el email invitado.',
    invitation_unavailable: 'Esta invitación ya se usó, venció o fue cancelada. Pedí una nueva.',
    limit_reached: 'Llegaste al límite de tu plan.',
    auth_invalid_credentials: 'Email o contraseña incorrectos.',
    auth_email_not_confirmed: 'Confirmá tu email antes de ingresar. Revisá tu casilla.',
    auth_user_exists: 'Ya existe una cuenta con ese email. Probá ingresar.',
    auth_weak_password: 'La contraseña es muy débil. Usá al menos 8 caracteres.',
    auth_invalid_email: 'Revisá el email: no parece válido.',
    rate_limited: 'Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.',
    network: 'No hay conexión. Revisá tu internet.',
    unknown: 'Ocurrió un error inesperado. Probá de nuevo.',
  }
  return messages[error.code]
}
