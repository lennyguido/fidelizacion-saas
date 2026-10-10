// Validación de la venta que manda la caja. Sin dependencias: se prueba solo.

export interface SaleInput {
  receipt: string
  amountMinor: number | null
  occurredAt: string | null
  phone: string | null
  memberCode: string | null
}

const KEY_PATTERN = /^lk_[0-9a-f]{40}$/

/** Clave del negocio desde "Authorization: Bearer lk_..." o "X-Api-Key: lk_...". */
export function keyFromHeaders(headers: Headers): string | null {
  const bearer = headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  const key = (bearer ?? headers.get('x-api-key') ?? '').trim()
  return KEY_PATTERN.test(key) ? key : null
}

/**
 * Celular a formato E.164. Acepta "+54 9 11 2233-4455", "5491122334455" o un
 * celular argentino de 10 dígitos ("11 2233-4455"). Si no se entiende, null.
 */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')
  let e164: string
  if (trimmed.startsWith('+')) e164 = `+${digits}`
  else if (digits.length === 10) e164 = `+549${digits}`
  else if (digits.startsWith('54')) e164 = `+${digits}`
  else return null
  return /^\+[1-9][0-9]{7,14}$/.test(e164) ? e164 : null
}

/** Lee el cuerpo. amount en pesos (8500.5) o amount_minor en centavos (850050). */
export function parseSale(body: unknown): SaleInput | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalid body' }
  const b = body as Record<string, unknown>
  const receipt = typeof b.receipt === 'string' ? b.receipt.trim() : ''
  if (receipt.length < 1 || receipt.length > 200) return { error: 'receipt is required' }

  let amountMinor: number | null = null
  if (b.amount_minor !== undefined && b.amount_minor !== null) {
    if (!Number.isInteger(b.amount_minor)) return { error: 'amount_minor must be an integer' }
    amountMinor = b.amount_minor as number
  } else if (b.amount !== undefined && b.amount !== null) {
    if (typeof b.amount !== 'number' || !Number.isFinite(b.amount)) {
      return { error: 'invalid amount' }
    }
    amountMinor = Math.round(b.amount * 100)
  }
  if (amountMinor !== null && (amountMinor < 0 || amountMinor > 100_000_000_000)) {
    return { error: 'invalid amount' }
  }

  let occurredAt: string | null = null
  if (b.occurred_at !== undefined && b.occurred_at !== null) {
    const date = typeof b.occurred_at === 'string' ? new Date(b.occurred_at) : null
    if (!date || Number.isNaN(date.getTime())) return { error: 'invalid occurred_at' }
    occurredAt = date.toISOString()
  }

  const code = typeof b.member_code === 'string' ? b.member_code.trim().toUpperCase() : ''
  const memberCode = /^[A-HJ-NP-Z2-9]{8}$/.test(code) ? code : null

  return { receipt, amountMinor, occurredAt, phone: normalizePhone(b.phone), memberCode }
}
