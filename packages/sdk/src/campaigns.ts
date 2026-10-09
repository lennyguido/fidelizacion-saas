// Campañas del núcleo (D-009, D-021). La base elige destinatarios, grupo de
// control y calcula resultados; acá solo se llaman funciones.
import { getSupabase } from './client.ts'
import type { CustomerStatus } from './customers.ts'
import { fromPostgrestError } from './errors.ts'
import type { FunctionReturns, Tables } from './tables.ts'

// `type` (no `interface`) para que sea asignable al tipo Json de Supabase.
export type Segment = {
  statuses?: CustomerStatus[]
  min_visits?: number
  min_spend_minor?: number
  min_days_since_visit?: number
}

export interface SegmentPreview {
  matching: number
  reachable: number
}

export type CampaignStatus = 'draft' | 'sent' | 'cancelled'

export interface Campaign {
  id: string
  moduleId: string
  name: string
  segment: Segment
  message: string
  benefit: string | null
  controlPct: number
  attributionDays: number
  status: CampaignStatus
  recipientsCount: number
  createdAt: string
  sentAt: string | null
}

export interface CampaignInput {
  moduleId: string
  name: string
  segment: Segment
  message: string
  benefit: string | null
  controlPct: number
  attributionDays: number
}

function toCampaign(row: Tables<'campaigns'>): Campaign {
  return {
    id: row.id,
    moduleId: row.module_id,
    name: row.name,
    segment: row.segment as unknown as Segment,
    message: row.message,
    benefit: row.benefit,
    controlPct: row.control_pct,
    attributionDays: row.attribution_days,
    status: row.status as CampaignStatus,
    recipientsCount: row.recipients_count,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  }
}

export async function previewSegment(
  businessId: string,
  segment: Segment,
): Promise<SegmentPreview> {
  const { data, error } = await getSupabase().rpc('preview_segment', {
    p_business_id: businessId,
    p_segment: segment,
  })
  if (error) throw fromPostgrestError(error)
  const row = data?.[0]
  return { matching: row?.matching ?? 0, reachable: row?.reachable ?? 0 }
}

export async function list(businessId: string, moduleId: string): Promise<Campaign[]> {
  const { data, error } = await getSupabase()
    .from('campaigns')
    .select('*')
    .eq('business_id', businessId)
    .eq('module_id', moduleId)
    .order('created_at', { ascending: false })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map(toCampaign)
}

export async function get(campaignId: string): Promise<Campaign> {
  const { data, error } = await getSupabase()
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()
  if (error) throw fromPostgrestError(error)
  return toCampaign(data)
}

export async function create(businessId: string, input: CampaignInput): Promise<Campaign> {
  const { data, error } = await getSupabase().rpc('create_campaign', {
    p_business_id: businessId,
    p_module_id: input.moduleId,
    p_name: input.name,
    p_segment: input.segment,
    p_message: input.message,
    p_benefit: input.benefit ?? undefined,
    p_control_pct: input.controlPct,
    p_attribution_days: input.attributionDays,
  })
  if (error) throw fromPostgrestError(error)
  return toCampaign(data as Tables<'campaigns'>)
}

/** Congela la lista de destinatarios y elige el grupo de control. */
export async function launch(campaignId: string): Promise<Campaign> {
  const { data, error } = await getSupabase().rpc('launch_campaign', { p_campaign_id: campaignId })
  if (error) throw fromPostgrestError(error)
  return toCampaign(data as Tables<'campaigns'>)
}

export async function cancel(campaignId: string): Promise<void> {
  const { error } = await getSupabase().rpc('cancel_campaign', { p_campaign_id: campaignId })
  if (error) throw fromPostgrestError(error)
}

export async function markContacted(recipientId: string): Promise<void> {
  const { error } = await getSupabase().rpc('mark_recipient_contacted', {
    p_recipient_id: recipientId,
  })
  if (error) throw fromPostgrestError(error)
}

export interface Recipient {
  id: string
  customerId: string
  name: string
  phone: string | null
  isControl: boolean
  statusAtSend: CustomerStatus
  message: string | null
  contactedAt: string | null
  returnedAt: string | null
  returnedAmountMinor: number
}

export async function listRecipients(campaignId: string): Promise<Recipient[]> {
  const { data, error } = await getSupabase().rpc('list_campaign_recipients', {
    p_campaign_id: campaignId,
  })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row: FunctionReturns<'list_campaign_recipients'>[number]) => ({
    id: row.recipient_id,
    customerId: row.customer_id,
    name: row.name,
    phone: row.phone,
    isControl: row.is_control,
    statusAtSend: row.status_at_send as CustomerStatus,
    message: row.message,
    contactedAt: row.contacted_at,
    returnedAt: row.returned_at,
    returnedAmountMinor: Number(row.returned_amount_minor),
  }))
}

export interface CampaignResults {
  treatmentCount: number
  controlCount: number
  contactedCount: number
  treatmentReturned: number
  controlReturned: number
  treatmentRevenueMinor: number
  controlRevenueMinor: number
  treatmentRate: number | null
  controlRate: number | null
  /** Clientes que volvieron gracias a la campaña (estimado). Null sin grupo de control. */
  incrementalCustomers: number | null
  /** Plata que entró gracias a la campaña (estimado). Null sin grupo de control. */
  incrementalRevenueMinor: number | null
  windowEndsAt: string
  windowOpen: boolean
}

const num = (value: number | string | null): number | null =>
  value === null ? null : Number(value)

export async function results(campaignId: string): Promise<CampaignResults> {
  const { data, error } = await getSupabase().rpc('campaign_results', { p_campaign_id: campaignId })
  if (error) throw fromPostgrestError(error)
  const row = data?.[0]
  if (!row) throw fromPostgrestError({ message: 'not found', code: 'P0002' })
  return {
    treatmentCount: row.treatment_count,
    controlCount: row.control_count,
    contactedCount: row.contacted_count,
    treatmentReturned: row.treatment_returned,
    controlReturned: row.control_returned,
    treatmentRevenueMinor: Number(row.treatment_revenue_minor),
    controlRevenueMinor: Number(row.control_revenue_minor),
    treatmentRate: num(row.treatment_rate),
    controlRate: num(row.control_rate),
    incrementalCustomers: num(row.incremental_customers),
    incrementalRevenueMinor: num(row.incremental_revenue_minor),
    windowEndsAt: row.window_ends_at,
    windowOpen: row.window_open,
  }
}

/** Placeholders que la base reemplaza al lanzar (vista previa para el formulario). */
export function renderPreview(
  message: string,
  values: { nombre: string; negocio: string; beneficio: string },
): string {
  return message
    .split('{nombre}')
    .join(values.nombre)
    .split('{negocio}')
    .join(values.negocio)
    .split('{beneficio}')
    .join(values.beneficio)
}
