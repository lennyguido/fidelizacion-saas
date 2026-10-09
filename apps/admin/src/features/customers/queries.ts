import { useQuery, useQueryClient } from '@tanstack/react-query'
import { customers, visits, type CustomerStatus } from '@plataforma/sdk'

export const customerKeys = {
  all: (businessId: string) => ['customers', businessId] as const,
  search: (businessId: string, query: string, status: CustomerStatus | null, limit: number) =>
    ['customers', businessId, 'search', query, status, limit] as const,
  counts: (businessId: string) => ['customers', businessId, 'count-by-status'] as const,
  detail: (businessId: string, customerId: string) =>
    ['customers', businessId, 'detail', customerId] as const,
  visits: (businessId: string, customerId: string) =>
    ['customers', businessId, 'visits', customerId] as const,
}

export function useCustomerSearch(
  businessId: string,
  query: string,
  status: CustomerStatus | null = null,
  limit = 20,
) {
  return useQuery({
    queryKey: customerKeys.search(businessId, query, status, limit),
    queryFn: () => customers.search({ businessId, query, status, limit }),
    placeholderData: (previous) => previous,
  })
}

export function useCustomerCounts(businessId: string) {
  return useQuery({
    queryKey: customerKeys.counts(businessId),
    queryFn: () => customers.countByStatus(businessId),
  })
}

export function useCustomer(businessId: string, customerId: string) {
  return useQuery({
    queryKey: customerKeys.detail(businessId, customerId),
    queryFn: () => customers.get(customerId),
  })
}

export function useCustomerVisits(businessId: string, customerId: string) {
  return useQuery({
    queryKey: customerKeys.visits(businessId, customerId),
    queryFn: () => visits.listForCustomer(customerId),
  })
}

/** Después de registrar o anular una visita, todo lo de clientes puede cambiar. */
export function useInvalidateCustomers(businessId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: customerKeys.all(businessId) })
}
