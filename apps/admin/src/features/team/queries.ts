import { useQuery, useQueryClient } from '@tanstack/react-query'
import { team } from '@plataforma/sdk'

export const teamKeys = {
  all: (businessId: string) => ['team', businessId] as const,
  members: (businessId: string) => ['team', businessId, 'members'] as const,
  invitations: (businessId: string) => ['team', businessId, 'invitations'] as const,
}

export function useTeamMembers(businessId: string) {
  return useQuery({
    queryKey: teamKeys.members(businessId),
    queryFn: () => team.listMembers(businessId),
  })
}

export function usePendingInvitations(businessId: string) {
  return useQuery({
    queryKey: teamKeys.invitations(businessId),
    queryFn: () => team.listPendingInvitations(businessId),
  })
}

export function useInvalidateTeam(businessId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: teamKeys.all(businessId) })
}
