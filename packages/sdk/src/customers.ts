import { getSupabase } from './client.ts'
import { AppError, fromPostgrestError } from './errors.ts'

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

interface SearchRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  status: CustomerStatus
  risk_score: number
  visit_count: number
  last_visit_at: string | null
  total_spend_minor: number
}

interface StatsRow {
  first_visit_at: string | null
  last_visit_at: string | null
  visit_count: number
  total_spend_minor: number
  avg_ticket_minor: number | null
  median_interval_days: number | null
  expected_next_visit_at: string | null
  status: CustomerStatus
  risk_score: number
}

interface CustomerRow {
  id: string
  business_id: string
  name: string
  phone: string | null
  email: string | null
  birthdate: string | null
  notes: string | null
  status: 'active' | 'archived'
  created_at: string
  stats: StatsRow | null
}

const CUSTOMER_COLUMNS =
  'id, business_id, name, phone, email, birthdate, notes, status, created_at, ' +
  'stats:customer_stats(first_visit_at, last_visit_at, visit_count, total_spend_minor, ' +
  'avg_ticket_minor, median_interval_days, expected_next_visit_at, status, risk_score)'

function toStats(row: StatsRow): CustomerStats {
  return {
    firstVisitAt: row.first_visit_at,
    lastVisitAt: row.last_visit_at,
    visitCount: row.visit_count,
    totalSpendMinor: Number(row.total_spend_minor),
    avgTicketMinor: row.avg_ticket_minor === null ? null : Number(row.avg_ticket_minor),
    medianIntervalDays: row.median_interval_days === null ? null : Number(row.median_interval_days),
    expectedNextVisitAt: row.expected_next_visit_at,
    status: row.status,
    riskScore: row.risk_score,
  }
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    birthdate: row.birthdate,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    stats: row.stats ? toStats(row.stats) : null,
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
  const { data, error } = await getSupabase()
    .rpc('search_customers', {
      p_business_id: params.businessId,
      p_query: params.query?.trim() || null,
      p_status: params.status ?? null,
      p_limit: params.limit ?? 20,
      p_offset: params.offset ?? 0,
    })

  if (error) throw fromPostgrestError(error)
  // Función que devuelve una tabla: PostgREST responde un array.
  const rows = (data ?? []) as SearchRow[]
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    status: row.status,
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
    .returns<CustomerRow>()
    .single()
  if (error) throw fromPostgrestError(error)
  return toCustomer(data)
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
    .returns<CustomerRow>()
    .single()
  if (error) throw duplicateAware(error)
  return toCustomer(data)
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
    .returns<CustomerRow>()
    .single()
  if (error) throw duplicateAware(error)
  return toCustomer(data)
}

export async function archive(customerId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('customers')
    .update({ status: 'archived' })
    .eq('id', customerId)
  if (error) throw fromPostgrestError(error)
}
