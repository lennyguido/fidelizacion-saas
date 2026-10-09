import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'

export type CustomerStatus = 'NEW' | 'ACTIVE' | 'AT_RISK' | 'INACTIVE' | 'RECOVERED'

export const CUSTOMER_STATUSES: CustomerStatus[] = [
  'NEW',
  'ACTIVE',
  'AT_RISK',
  'INACTIVE',
  'RECOVERED',
]

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
