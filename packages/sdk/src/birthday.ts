// Cumpleaños sin año (D-031): día y mes, para el saludo automático.

export const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Igual que la regla de la base: el 29 de febrero vale (se saluda el 28 en años no bisiestos). */
export function isValidBirthday(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false
  const max = DAYS_IN_MONTH[month - 1]
  return max !== undefined && day >= 1 && day <= max
}

/** "3 de marzo". */
export function formatBirthday(birthday: { day: number; month: number }): string {
  return `${birthday.day} de ${MONTH_NAMES[birthday.month - 1] ?? ''}`
}
