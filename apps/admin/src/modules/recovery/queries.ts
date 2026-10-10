import { useQuery, useQueryClient } from '@tanstack/react-query'
import { automations, campaigns, type Segment } from '@plataforma/sdk'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'

export const RECOVERY_MODULE = 'recovery'

export const recoveryKeys = {
  all: (businessId: string) => ['customers', businessId, 'campaigns'] as const,
  list: (businessId: string) => ['customers', businessId, 'campaigns', 'list'] as const,
  detail: (businessId: string, id: string) => ['customers', businessId, 'campaigns', id] as const,
  recipients: (businessId: string, id: string) =>
    ['customers', businessId, 'campaigns', id, 'recipients'] as const,
  results: (businessId: string, id: string) =>
    ['customers', businessId, 'campaigns', id, 'results'] as const,
  preview: (businessId: string, segment: Segment) =>
    ['customers', businessId, 'campaigns', 'preview', JSON.stringify(segment)] as const,
}

export function useCampaigns(businessId: string) {
  return useQuery({
    queryKey: recoveryKeys.list(businessId),
    queryFn: () => campaigns.list(businessId, RECOVERY_MODULE),
  })
}

export function useCampaign(businessId: string, id: string) {
  return useQuery({
    queryKey: recoveryKeys.detail(businessId, id),
    queryFn: () => campaigns.get(id),
  })
}

export function useRecipients(businessId: string, id: string, enabled: boolean) {
  return useQuery({
    queryKey: recoveryKeys.recipients(businessId, id),
    queryFn: () => campaigns.listRecipients(id),
    enabled,
  })
}

export function useResults(businessId: string, id: string, enabled: boolean) {
  return useQuery({
    queryKey: recoveryKeys.results(businessId, id),
    queryFn: () => campaigns.results(id),
    enabled,
  })
}

export function useSegmentPreview(businessId: string, segment: Segment) {
  return useQuery({
    queryKey: recoveryKeys.preview(businessId, segment),
    queryFn: () => campaigns.previewSegment(businessId, segment),
    placeholderData: (previous) => previous,
  })
}

export function useInvalidateCampaigns(businessId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: recoveryKeys.all(businessId) })
}

/** Busca un cupón escrito en el mostrador (solo si tiene forma de cupón). */
export function useCouponLookup(code: string) {
  const { business } = useActiveBusiness()
  const normalized = code.replace(/[\s-]/g, '').toUpperCase()
  return useQuery({
    queryKey: [...recoveryKeys.all(business.id), 'coupon', normalized] as const,
    queryFn: () => campaigns.findCoupon(business.id, normalized),
    enabled: campaigns.looksLikeCouponCode(normalized),
  })
}

export function useAutomations(businessId: string) {
  return useQuery({
    queryKey: [...recoveryKeys.all(businessId), 'automations'] as const,
    queryFn: () => automations.list(businessId),
  })
}

/** Mensajes que la recuperación automática dejó listos para mandar. */
export function useReadyMessages(businessId: string) {
  return useQuery({
    queryKey: [...recoveryKeys.all(businessId), 'outbox'] as const,
    queryFn: () => automations.listReady(businessId),
  })
}

export function useReadyMessagesCount(businessId: string) {
  return useQuery({
    queryKey: [...recoveryKeys.all(businessId), 'outbox', 'count'] as const,
    queryFn: () => automations.countReady(businessId),
  })
}
