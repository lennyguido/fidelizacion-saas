import { normalizePhone } from './phone.ts'

export type ImportField = 'name' | 'lastName' | 'phone' | 'email' | 'notes'

/** Índice de columna del CSV para cada campo (null = no se usa). */
export type ColumnMapping = Record<ImportField, number | null>

export interface ImportRow {
  name: string
  phone: string | null
  email: string | null
  notes: string | null
}

export interface InvalidRow {
  /** Número de línea en el archivo (1 = encabezado). */
  line: number
  reason: ImportRejection
  values: string[]
}

export type ImportRejection =
  | 'invalid_name'
  | 'invalid_phone'
  | 'invalid_email'
  | 'duplicate_phone'
  | 'duplicate_email'
  | 'duplicate'
  | 'invalid'

export const importRejectionLabels: Record<ImportRejection, string> = {
  invalid_name: 'Falta el nombre',
  invalid_phone: 'Teléfono no reconocido',
  invalid_email: 'Email inválido',
  duplicate_phone: 'Teléfono repetido',
  duplicate_email: 'Email repetido',
  duplicate: 'Cliente repetido',
  invalid: 'Datos inválidos',
}

const synonyms: Record<ImportField, string[]> = {
  name: [
    'nombre',
    'name',
    'cliente',
    'nombre y apellido',
    'apellido y nombre',
    'nombre completo',
    'razon social',
  ],
  lastName: ['apellido', 'apellidos', 'last name', 'lastname', 'surname'],
  phone: ['telefono', 'tel', 'celular', 'cel', 'whatsapp', 'movil', 'phone', 'mobile', 'numero'],
  email: ['email', 'e-mail', 'mail', 'correo', 'correo electronico'],
  notes: ['notas', 'nota', 'observaciones', 'comentarios', 'comentario', 'notes'],
}

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Adivina qué columna es cada campo a partir de los encabezados. */
export function detectColumns(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader)
  const mapping: ColumnMapping = {
    name: null,
    lastName: null,
    phone: null,
    email: null,
    notes: null,
  }
  const used = new Set<number>()

  for (const field of Object.keys(synonyms) as ImportField[]) {
    const index = normalized.findIndex(
      (header, i) => !used.has(i) && synonyms[field].includes(header),
    )
    if (index >= 0) {
      mapping[field] = index
      used.add(index)
    }
  }
  return mapping
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Convierte las filas del CSV (sin encabezado) en clientes a importar.
 * Valida y normaliza en el navegador para mostrar una vista previa; la base
 * vuelve a validar todo al importar.
 */
export function buildImportRows(
  rows: string[][],
  mapping: ColumnMapping,
): { valid: Array<ImportRow & { line: number }>; invalid: InvalidRow[] } {
  const valid: Array<ImportRow & { line: number }> = []
  const invalid: InvalidRow[] = []
  const seenPhones = new Set<string>()
  const seenEmails = new Set<string>()
  const cell = (row: string[], index: number | null) =>
    index === null ? '' : (row[index] ?? '').trim()

  rows.forEach((values, i) => {
    const line = i + 2
    const name = [cell(values, mapping.name), cell(values, mapping.lastName)]
      .filter(Boolean)
      .join(' ')
    const rawPhone = cell(values, mapping.phone)
    const rawEmail = cell(values, mapping.email).toLowerCase()
    const phone = rawPhone === '' ? null : normalizePhone(rawPhone)
    const reject = (reason: ImportRejection) => invalid.push({ line, reason, values })

    if (name === '' || name.length > 120) return reject('invalid_name')
    if (rawPhone !== '' && phone === null) return reject('invalid_phone')
    if (rawEmail !== '' && !EMAIL.test(rawEmail)) return reject('invalid_email')
    if (phone && seenPhones.has(phone)) return reject('duplicate_phone')
    if (rawEmail && seenEmails.has(rawEmail)) return reject('duplicate_email')

    if (phone) seenPhones.add(phone)
    if (rawEmail) seenEmails.add(rawEmail)
    valid.push({
      line,
      name,
      phone,
      email: rawEmail || null,
      notes: cell(values, mapping.notes) || null,
    })
  })

  return { valid, invalid }
}

export const IMPORT_TEMPLATE: string[][] = [
  ['Nombre', 'Teléfono', 'Email', 'Notas'],
  ['Ana Gómez', '11 2233-4455', 'ana@mail.com', 'Toma cortado'],
  ['Don Carlos', '', '', 'Viene a la mañana'],
]
