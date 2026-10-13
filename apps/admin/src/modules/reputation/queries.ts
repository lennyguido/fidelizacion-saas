import { useQuery, useQueryClient } from '@tanstack/react-query'
import { reputation } from '@plataforma/sdk'

export const reputationKeys = {
  tags: (businessId: string) => ['customers', businessId, 'reputation', 'tags'] as const,
}

export function useReviewTags(businessId: string) {
  return useQuery({
    queryKey: reputationKeys.tags(businessId),
    queryFn: () => reputation.listTags(businessId),
  })
}

export function useInvalidateReviewTags(businessId: string) {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: reputationKeys.tags(businessId) })
}
