import { useQuery, useQueryClient } from '@tanstack/react-query'
import { booking } from '@plataforma/sdk'

export const bookingKeys = {
  all: (businessId: string) => ['customers', businessId, 'booking'] as const,
  agenda: (businessId: string, day: string) =>
    ['customers', businessId, 'booking', 'agenda', day] as const,
  settings: (businessId: string) => ['customers', businessId, 'booking', 'settings'] as const,
  services: (businessId: string) => ['customers', businessId, 'booking', 'services'] as const,
  staff: (businessId: string) => ['customers', businessId, 'booking', 'staff'] as const,
  hours: (businessId: string) => ['customers', businessId, 'booking', 'hours'] as const,
}

export function useAgenda(businessId: string, day: string) {
  return useQuery({
    queryKey: bookingKeys.agenda(businessId, day),
    queryFn: () => booking.agenda(businessId, day, day),
  })
}

export function useBookingSettings(businessId: string) {
  return useQuery({
    queryKey: bookingKeys.settings(businessId),
    queryFn: () => booking.getSettings(businessId),
  })
}

export function useServices(businessId: string) {
  return useQuery({
    queryKey: bookingKeys.services(businessId),
    queryFn: () => booking.listServices(businessId),
  })
}

export function useStaff(businessId: string) {
  return useQuery({
    queryKey: bookingKeys.staff(businessId),
    queryFn: () => booking.listStaff(businessId),
  })
}

export function useHours(businessId: string) {
  return useQuery({
    queryKey: bookingKeys.hours(businessId),
    queryFn: () => booking.listHours(businessId),
  })
}

export function useInvalidateBooking(businessId: string) {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: bookingKeys.all(businessId) })
}

export function useWeek(businessId: string, from: string) {
  return useQuery({
    queryKey: [...bookingKeys.all(businessId), 'week', from],
    queryFn: () => booking.agenda(businessId, from, booking.addDays(from, 6)),
  })
}

export function useClients(businessId: string, search: string) {
  return useQuery({
    queryKey: [...bookingKeys.all(businessId), 'clients', search],
    queryFn: () => booking.clients(businessId, search),
  })
}

export function useClientHistory(businessId: string, customerId: string | null) {
  return useQuery({
    queryKey: [...bookingKeys.all(businessId), 'history', customerId],
    queryFn: () => booking.clientHistory(businessId, customerId ?? ''),
    enabled: Boolean(customerId),
  })
}
