// Exportar datos ("Tus clientes son tuyos", D-034). La base arma las filas (solo
// dueño o admin, queda registrado); acá solo se convierten a CSV con títulos en castellano.
import { getSupabase } from './client.ts'
import { toCsv } from './csv.ts'
import { fromPostgrestError } from './errors.ts'

type Row = Record<string, string | number | boolean | null>

/** Una columna del CSV: título y cómo sacar el valor de la fila. */
interface Column {
  title: string
  value: (row: Row) => string
}

function text(key: string): (row: Row) => string {
  return (row) => {
    const value = row[key]
    return value === null || value === undefined ? '' : String(value)
  }
}

function yesNo(key: string): (row: Row) => string {
  return (row) => (row[key] === true ? 'Sí' : 'No')
}

/** 150050 → "1500,50" (número que Excel en castellano entiende). */
export function minorToDecimal(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return ''
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(minor)
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

function money(key: string): (row: Row) => string {
  return (row) => minorToDecimal(row[key] as number | null)
}

function translated(key: string, labels: Record<string, string>): (row: Row) => string {
  return (row) => {
    const value = row[key]
    if (value === null || value === undefined) return ''
    return labels[String(value)] ?? String(value)
  }
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Mostrador',
  import: 'Importado',
  qr: 'Alta por QR',
  booking: 'Reserva',
  integration: 'Integración',
  qr_customer: 'QR del cliente',
  qr_business: 'QR del negocio',
  mercadopago: 'Mercado Pago',
  pos: 'Caja',
}

const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  ACTIVE: 'Activo',
  AT_RISK: 'En riesgo',
  INACTIVE: 'Inactivo',
  RECOVERED: 'Recuperado',
}

const LEDGER_REASON_LABELS: Record<string, string> = {
  visit: 'Visita',
  visit_voided: 'Visita anulada',
  redemption: 'Canje',
  redemption_cancelled: 'Canje anulado',
  adjustment: 'Ajuste',
  referral: 'Invitación',
  referral_voided: 'Invitación anulada',
}

const CUSTOMER_COLUMNS: Column[] = [
  { title: 'Nombre', value: text('name') },
  { title: 'Teléfono', value: text('phone') },
  { title: 'Email', value: text('email') },
  {
    title: 'Cumpleaños',
    value: (row) =>
      row.birth_day && row.birth_month
        ? `${String(row.birth_day).padStart(2, '0')}/${String(row.birth_month).padStart(2, '0')}`
        : '',
  },
  { title: 'Etiquetas', value: text('tags') },
  { title: 'Notas', value: text('notes') },
  { title: 'Cómo llegó', value: translated('source', SOURCE_LABELS) },
  { title: 'Archivado', value: (row) => (row.status === 'archived' ? 'Sí' : 'No') },
  { title: 'Datos borrados', value: yesNo('anonymized') },
  { title: 'Acepta WhatsApp', value: yesNo('whatsapp_marketing') },
  { title: 'Alta', value: text('created_at') },
  { title: 'Visitas', value: text('visit_count') },
  { title: 'Primera visita', value: text('first_visit_at') },
  { title: 'Última visita', value: text('last_visit_at') },
  { title: 'Gasto total', value: money('total_spend_minor') },
  { title: 'Estado', value: translated('customer_status', CUSTOMER_STATUS_LABELS) },
]

const VISIT_COLUMNS: Column[] = [
  { title: 'Fecha', value: text('occurred_at') },
  { title: 'Cliente', value: text('customer_name') },
  { title: 'Teléfono', value: text('customer_phone') },
  { title: 'Sucursal', value: text('location') },
  { title: 'Monto', value: money('amount_minor') },
  { title: 'Moneda', value: text('currency') },
  { title: 'Origen', value: translated('source', SOURCE_LABELS) },
  { title: 'Notas', value: text('notes') },
  { title: 'Anulada', value: yesNo('voided') },
  { title: 'Motivo de anulación', value: text('void_reason') },
]

const LEDGER_COLUMNS: Column[] = [
  { title: 'Fecha', value: text('created_at') },
  { title: 'Cliente', value: text('customer_name') },
  { title: 'Teléfono', value: text('customer_phone') },
  { title: 'Puntos', value: text('delta') },
  { title: 'Motivo', value: translated('reason', LEDGER_REASON_LABELS) },
  { title: 'Premio', value: text('reward_name') },
  { title: 'Nota', value: text('note') },
]

export function rowsToCsv(columns: Column[], rows: Row[]): string {
  return toCsv([
    columns.map((c) => c.title),
    ...rows.map((row) => columns.map((c) => c.value(row))),
  ])
}

export const customersCsv = (rows: Row[]) => rowsToCsv(CUSTOMER_COLUMNS, rows)
export const visitsCsv = (rows: Row[]) => rowsToCsv(VISIT_COLUMNS, rows)
export const ledgerCsv = (rows: Row[]) => rowsToCsv(LEDGER_COLUMNS, rows)

function asRows(data: unknown): Row[] {
  return Array.isArray(data) ? (data as Row[]) : []
}

export async function exportCustomers(businessId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('export_customers', {
    p_business_id: businessId,
  })
  if (error) throw fromPostgrestError(error)
  return customersCsv(asRows(data))
}

/** `from` y `to` en formato AAAA-MM-DD, inclusive, en la hora del negocio. */
export async function exportVisits(businessId: string, from: string, to: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('export_visits', {
    p_business_id: businessId,
    p_from: from,
    p_to: to,
  })
  if (error) throw fromPostgrestError(error)
  return visitsCsv(asRows(data))
}

export async function exportLedger(businessId: string, from: string, to: string): Promise<string> {
  const { data, error } = await getSupabase()
    .schema('loyalty')
    .rpc('export_ledger', { p_business_id: businessId, p_from: from, p_to: to })
  if (error) throw fromPostgrestError(error)
  return ledgerCsv(asRows(data))
}

/** Nombre de archivo con la fecha, p. ej. "clientes-2026-10-11.csv". */
export function exportFileName(kind: 'clientes' | 'visitas' | 'puntos', today: string): string {
  return `${kind}-${today}.csv`
}
