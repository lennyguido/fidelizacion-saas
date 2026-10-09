import { useQuery } from '@tanstack/react-query'
import { businesses } from '@plataforma/sdk'
import { useSession } from '../auth/AuthContext'

export const businessKeys = {
  mine: (userId: string) => ['businesses', 'mine', userId] as const,
  modules: (businessId: string) => ['businesses', businessId, 'modules'] as const,
}

export function useMyBusinesses() {
  const session = useSession()
  return useQuery({
    queryKey: businessKeys.mine(session.user.id),
    queryFn: () => businesses.listMyBusinesses(session.user.id),
  })
}

export function useEnabledModules(businessId: string) {
  return useQuery({
    queryKey: businessKeys.modules(businessId),
    queryFn: () => businesses.listEnabledModules(businessId),
    enabled: businessId !== '',
  })
}
