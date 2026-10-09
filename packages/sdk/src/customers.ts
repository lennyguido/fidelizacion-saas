import { getSupabase } from './client.ts'
import { AppError, fromPostgrestError } from './errors.ts'
import type { FunctionReturns, Tables } from './tables.ts'

export type CustomerStatus = 'NEW' | 'ACTIVE' | 'AT_RISK' | 'INACTIVE' | 'RECOVERED'

export const CUSTOMER_STATUSES: CustomerStatus[] = [
  'NEW',
  'ACTIVE',
  'AT_RISK',
  'INACTIVE',
  'RECOVERED',
]

export interface CustomerListItem {
  id: string
  name: string
  phone: string | null
  email: string | null
  status: CustomerStatus
  riskScore: number
  visitCount: number
  lastVisitAt: string | null
  totalSpendMinor: number
}

export interface CustomerStats {
  firstVisitAt: string | null
  lastVisitAt: string | null
  visitCount: number
  totalSpendMinor: number
  avgTicketMinor: number | null
  medianIntervalDays: number | null
  expectedNextVisitAt: string | null
  status: CustomerStatus
  riskScore: number
}

export interface Customer {
  id: string
  businessId: string
  name: string
  phone: string | null
  email: string | null
  birthdate: string | null
  notes: string | null
  status: 'active' | 'archived'
  createdAt: string
  stats: CustomerStats | null
}

export interface CustomerInput {
  name: string
  phone: string | null
  email: string | null
  notes: string | null
}

type SearchRow = FunctionReturns<'search_customers'>[number]

type StatsRow = Pick<
  Tables<'customer_stats'>,
  | 'first_visit_at'
  | 'last_visit_at'
  | 'visit_count'
  | 'total_spend_minor'
  | 'avg_ticket_minor'
  | 'median_interval_days'
  | 'expected_next_visit_at'
  | 'status'
  | 'risk_score'
>

type CustomerRow = Pick<
  Tables<'customers'>,
  | 'id'
  | 'business_id'
  | 'name'
  | 'phone'
  | 'email'
  | 'birthdate'
  | 'notes'
  | 'status'
  | 'created_at'
> & { stats: StatsRow | StatsRow[] | null }

const CUSTOMER_COLUMNS =
  'id, business_id, name, phone, email, birthdate, notes, status, created_at, stats:customer_stats(first_visit_at, last_visit_at, visit_count, total_spend_minor, avg_ticket_minor, median_interval_days, expected_next_visit_at, status, risk_score)' as const

function toStats(row: StatsRow): CustomerStats {
  return {
    firstVisitAt: row.first_visit_at,
    lastVisitAt: row.last_visit_at,
    visitCount: row.visit_count,
    totalSpendMinor: Number(row.total_spend_minor),
    avgTicketMinor: row.avg_ticket_minor === null ? null : Number(row.avg_ticket_minor),
    medianIntervalDays: row.median_interval_days === null ? null : Number(row.median_interval_days),
    expectedNextVisitAt: row.expected_next_visit_at,
    status: row.status as CustomerStatus,
    riskScore: row.risk_score,
  }
}

function toCustomer(row: CustomerRow): Customer {
  // customer_stats es 1 a 1 con customers; según cómo lo detecte PostgREST puede venir como objeto o lista.
  const stats = Array.isArray(row.stats) ? (row.stats[0] ?? null) : row.stats
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    birthdate: row.birthdate,
    notes: row.notes,
    status: row.status as Customer['status'],
    createdAt: row.created_at,
    stats: stats ? toStats(stats) : null,
  }
}

/** Cantidad de clientes por estado (los estados los calcula la base). */
export async function countByStatus(businessId: string): Promise<Record<CustomerStatus, number>> {
  const supabase = getSupabase()
  const results = await Promise.all(
    CUSTOMER_STATUSES.map((status) =>
      supabase
        .from('customer_stats')
        .select('customer_id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', status),
    ),
  )

  const counts = {} as Record<CustomerStatus, number>
  results.forEach((result, index) => {
    if (result.error) throw fromPostgrestError(result.error)
    const status = CUSTOMER_STATUSES[index]
    if (status) counts[status] = result.count ?? 0
  })
  return counts
}

export interface SearchParams {
  businessId: string
  query?: string
  status?: CustomerStatus | null
  limit?: number
  offset?: number
}

export async function search(params: SearchParams): Promise<CustomerListItem[]> {
  const { data, error } = await getSupabase().rpc('search_customers', {
    p_business_id: params.businessId,
    p_query: params.query?.trim() || undefined,
    p_status: params.status ?? undefined,
    p_limit: params.limit ?? 20,
    p_offset: params.offset ?? 0,
  })

  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row: SearchRow) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    status: row.status as CustomerStatus,
    riskScore: row.risk_score,
    visitCount: row.visit_count,
    lastVisitAt: row.last_visit_at,
    totalSpendMinor: Number(row.total_spend_minor),
  }))
}

export async function get(customerId: string): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('id', customerId)
    .single()
  if (error) throw fromPostgrestError(error)
  return toCustomer(data as CustomerRow)
}

function duplicateAware(error: { code?: string; message?: string }): AppError {
  const message = error.message ?? ''
  if (message.includes('customers_business_phone_idx')) {
    return new AppError('duplicate_phone', message)
  }
  if (message.includes('customers_business_email_idx')) {
    return new AppError('duplicate_email', message)
  }
  return fromPostgrestError(error)
}

export async function create(businessId: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .insert({
      business_id: businessId,
      name: input.name.trim(),
      phone: input.phone,
      email: input.email?.trim().toLowerCase() || null,
      notes: input.notes?.trim() || null,
    })
    .select(CUSTOMER_COLUMNS)
    .single()
  if (error) throw duplicateAware(error)
  return toCustomer(data as CustomerRow)
}

export async function update(customerId: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .update({
      name: input.name.trim(),
      phone: input.phone,
      email: input.email?.trim().toLowerCase() || null,
      notes: input.notes?.trim() || null,
    })
    .eq('id', customerId)
    .select(CUSTOMER_COLUMNS)
    .single()
  if (error) throw duplicateAware(error)
  return toCustomer(data as CustomerRow)
}

export async function archive(customerId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('customers')
    .update({ status: 'archived' })
    .eq('id', customerId)
  if (error) throw fromPostgrestError(error)
}

export interface ImportBatchResult {
  inserted: number
  skipped: Array<{ index: number; reason: string }>
}

/** Importa hasta 500 clientes ya normalizados (core.import_customers). */
export async function importBatch(
  businessId: string,
  rows: Array<{ name: string; phone: string | null; email: string | null; notes: string | null }>,
): Promise<ImportBatchResult> {
  const { data, error } = await getSupabase().rpc('import_customers', {
    p_business_id: businessId,
    p_rows: rows,
  })
  if (error) throw fromPostgrestError(error)
  const result = data as unknown as ImportBatchResult
  return { inserted: Number(result.inserted), skipped: result.skipped ?? [] }
}
