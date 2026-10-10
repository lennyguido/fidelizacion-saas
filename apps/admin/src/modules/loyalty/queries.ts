import { useQuery, useQueryClient } from '@tanstack/react-query'
import { loyalty, selfSignup } from '@plataforma/sdk'

// Las claves cuelgan de ['customers', negocio] a propósito: cuando se registra o
// anula una visita se invalida todo lo de clientes, y el saldo de puntos cambia.
export const loyaltyKeys = {
  all: (businessId: string) => ['customers', businessId, 'loyalty'] as const,
  program: (businessId: string) => ['customers', businessId, 'loyalty', 'program'] as const,
  rewards: (businessId: string) => ['customers', businessId, 'loyalty', 'rewards'] as const,
  member: (businessId: string, customerId: string) =>
    ['customers', businessId, 'loyalty', 'member', customerId] as const,
  movements: (businessId: string, memberId: string) =>
    ['customers', businessId, 'loyalty', 'movements', memberId] as const,
  redemptions: (businessId: string, memberId: string) =>
    ['customers', businessId, 'loyalty', 'redemptions', memberId] as const,
}

export function useProgram(businessId: string) {
  return useQuery({
    queryKey: loyaltyKeys.program(businessId),
    queryFn: () => loyalty.getProgram(businessId),
  })
}

export function useRewards(businessId: string) {
  return useQuery({
    queryKey: loyaltyKeys.rewards(businessId),
    queryFn: () => loyalty.listRewards(businessId),
  })
}

export function useMember(businessId: string, customerId: string) {
  return useQuery({
    queryKey: loyaltyKeys.member(businessId, customerId),
    queryFn: () => loyalty.getMemberByCustomer(customerId),
  })
}

export function useMovements(businessId: string, memberId: string) {
  return useQuery({
    queryKey: loyaltyKeys.movements(businessId, memberId),
    queryFn: () => loyalty.listMovements(memberId),
  })
}

export function useRedemptions(businessId: string, memberId: string) {
  return useQuery({
    queryKey: loyaltyKeys.redemptions(businessId, memberId),
    queryFn: () => loyalty.listRedemptions(memberId),
  })
}

export function useInvalidateLoyalty(businessId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: loyaltyKeys.all(businessId) })
}

export function useTemplates() {
  return useQuery({
    queryKey: ['loyalty-templates'],
    queryFn: () => loyalty.listTemplates(),
    staleTime: Infinity,
  })
}

export function useSelfSignupSettings(businessId: string) {
  return useQuery({
    queryKey: [...loyaltyKeys.all(businessId), 'self-signup'] as const,
    queryFn: () => selfSignup.getSettings(businessId),
  })
}

/** Personas que ya eran clientes y se quisieron anotar otra vez desde el cartel. */
export function useSignupNotices(businessId: string) {
  return useQuery({
    queryKey: [...loyaltyKeys.all(businessId), 'self-signup', 'notices'] as const,
    queryFn: () => selfSignup.listPendingNotices(businessId),
  })
}
