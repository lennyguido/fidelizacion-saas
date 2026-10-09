const E164 = /^\+[1-9][0-9]{7,14}$/

/**
 * Normaliza un teléfono escrito a mano al formato E.164 que guarda la base.
 * Pensado para Argentina: "11 2233-4455", "011 15 2233 4455" o "+54 9 11 2233 4455"
 * → "+5491122334455". Los números locales se asumen celulares (llevan el 9),
 * que es lo que sirve para WhatsApp. Devuelve null si no se puede interpretar.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  if (trimmed.startsWith('+')) {
    const candidate = '+' + trimmed.slice(1).replace(/\D/g, '')
    return E164.test(candidate) ? candidate : null
  }

  let digits = trimmed.replace(/\D/g, '')

  if (digits.startsWith('549') && digits.length === 13) return `+${digits}`
  if (digits.startsWith('54') && digits.length === 12) return `+549${digits.slice(2)}`

  // Prefijo de larga distancia nacional.
  if (digits.startsWith('0')) digits = digits.slice(1)
  // "15" después del código de área (11 15 2233 4455 → 11 2233 4455).
  const withFifteen = /^(\d{2,4})15(\d{6,8})$/.exec(digits)
  if (withFifteen && withFifteen[1] && withFifteen[2] && digits.length === 12) {
    digits = withFifteen[1] + withFifteen[2]
  }

  if (digits.length === 10) return `+549${digits}`
  return null
}

/** "+5491122334455" → "+54 9 11 2233-4455" (solo para mostrar). */
export function formatPhone(phone: string | null): string {
  if (!phone) return ''
  const ar =
    /^\+549(11)(\d{4})(\d{4})$/.exec(phone) ?? /^\+549(\d{3,4})(\d{2,3})(\d{4})$/.exec(phone)
  if (ar) return `+54 9 ${ar[1]} ${ar[2]}-${ar[3]}`
  return phone
}
