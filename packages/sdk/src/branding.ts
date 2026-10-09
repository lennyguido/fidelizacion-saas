// Reglas puras de la marca del negocio (white-label). Sin acceso a datos:
// se pueden usar y probar en cualquier lado.

/** Bucket público de logos (migración core_audit_storage_jobs). Ruta: "{business_id}/archivo". */
export const LOGO_BUCKET = 'logos'

/** Mismo límite que el bucket: 1 MB. */
export const LOGO_MAX_BYTES = 1024 * 1024

const LOGO_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export const LOGO_ACCEPT = Object.keys(LOGO_EXTENSIONS).join(',')

/** Zonas horarias habituales de Argentina y Latinoamérica (nombres IANA). */
export const COMMON_TIMEZONES: { id: string; label: string }[] = [
  { id: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { id: 'America/Argentina/Cordoba', label: 'Argentina (Córdoba)' },
  { id: 'America/Argentina/Mendoza', label: 'Argentina (Mendoza)' },
  { id: 'America/Argentina/Salta', label: 'Argentina (Salta)' },
  { id: 'America/Argentina/Ushuaia', label: 'Argentina (Ushuaia)' },
  { id: 'America/Montevideo', label: 'Uruguay (Montevideo)' },
  { id: 'America/Asuncion', label: 'Paraguay (Asunción)' },
  { id: 'America/Santiago', label: 'Chile (Santiago)' },
  { id: 'America/La_Paz', label: 'Bolivia (La Paz)' },
  { id: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
  { id: 'America/Lima', label: 'Perú (Lima)' },
  { id: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { id: 'America/Caracas', label: 'Venezuela (Caracas)' },
  { id: 'America/Guayaquil', label: 'Ecuador (Guayaquil)' },
  { id: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { id: 'Europe/Madrid', label: 'España (Madrid)' },
]

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** Igual que el check de la base: "#" y 6 dígitos hexadecimales. */
export function isValidHexColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

/** Acepta "abc123" o " #ABC123 " y devuelve "#abc123"; null si no es un color válido. */
export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return isValidHexColor(withHash) ? withHash.toLowerCase() : null
}

/** Texto blanco u oscuro según qué se lea mejor sobre el color de marca. */
export function textColorOn(hex: string): '#ffffff' | '#0f172a' {
  if (!isValidHexColor(hex)) return '#ffffff'
  const channel = (start: number) => {
    const c = parseInt(hex.slice(start, start + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  // Punto donde el contraste con blanco y con #0f172a es parecido.
  return luminance > 0.18 ? '#0f172a' : '#ffffff'
}

export interface LogoFileInfo {
  type: string
  size: number
}

/** Devuelve el motivo por el que el archivo no sirve como logo, o null si está bien. */
export function logoFileError(file: LogoFileInfo): string | null {
  if (!(file.type in LOGO_EXTENSIONS)) return 'El logo tiene que ser PNG, JPG, WebP o SVG.'
  if (file.size <= 0) return 'El archivo está vacío.'
  if (file.size > LOGO_MAX_BYTES) return 'El logo no puede pesar más de 1 MB.'
  return null
}

/** Ruta dentro del bucket: "{business_id}/logo-<timestamp>.<ext>". */
export function logoObjectPath(businessId: string, type: string, now: number): string {
  const ext = LOGO_EXTENSIONS[type]
  if (!ext) throw new Error(`Tipo de logo no permitido: ${type}`)
  return `${businessId}/logo-${now}.${ext}`
}
