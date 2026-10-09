import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'

export interface Visit {
  id: string
  customerId: string | null
  occurredAt: string
  amountMinor: number | null
  currency: string
  source: string
  notes: string | null
  voidedAt: string | null
  voidReason: string | null
}

interface VisitRow {
  id: string
  customer_id: string | null
  occurred_at: string
  amount_minor: number | null
  currency: string
  source: string
  notes: string | null
  voided_at: string | null
  void_reason: string | null
}

const VISIT_COLUMNS =
  'id, customer_id, occurred_at, amount_minor, currency, source, notes, voided_at, void_reason'

function toVisit(row: VisitRow): Visit {
  return {
    id: row.id,
    customerId: row.customer_id,
    occurredAt: row.occurred_at,
    amountMinor: row.amount_minor === null ? null : Number(row.amount_minor),
    currency: row.currency,
    source: row.source,
    notes: row.notes,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
  }
}

export interface RecordVisitInput {
  businessId: string
  customerId?: string | null
  locationId?: string | null
  amountMinor?: number | null
  notes?: string | null
}

/** Registra una visita (core.record_visit). Sin cliente = visita anónima. */
export async function record(input: RecordVisitInput): Promise<Visit> {
  const { data, error } = await getSupabase()
    .rpc('record_visit', {
      p_business_id: input.businessId,
      p_location_id: input.locationId ?? null,
      p_customer_id: input.customerId ?? null,
      p_amount_minor: input.amountMinor ?? null,
      p_notes: input.notes ?? null,
    })
    .returns<VisitRow>()
    .single()
  if (error) throw fromPostgrestError(error)
  return toVisit(data)
}

export async function voidVisit(visitId: string, reason: string): Promise<Visit> {
  const { data, error } = await getSupabase()
    .rpc('void_visit', { p_visit_id: visitId, p_reason: reason })
    .returns<VisitRow>()
    .single()
  if (error) throw fromPostgrestError(error)
  return toVisit(data)
}

export async function listForCustomer(customerId: string, limit = 50): Promise<Visit[]> {
  const { data, error } = await getSupabase()
    .from('visits')
    .select(VISIT_COLUMNS)
    .eq('customer_id', customerId)
    .order('occurred_at', { ascending: false })
    .limit(limit)
    .returns<VisitRow[]>()
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map(toVisit)
}
