import { booking } from '@plataforma/sdk'
import { AppointmentPage } from '@/AppointmentPage'
import { BookingPage } from '@/BookingPage'
import { HomePage } from '@/HomePage'

/**
 * turnos.neriva.net (D-049):
 * /            qué es Turnos (para dueños)
 * /<negocio>   reservar un turno
 * /turno#…     ver o cancelar el turno (link secreto)
 */
export function App() {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/turno') {
    return <AppointmentPage token={booking.tokenFromHash(window.location.hash)} />
  }
  const slug = path.replace(/^\//, '')
  if (/^[a-z0-9-]{2,60}$/.test(slug)) return <BookingPage slug={slug} />
  return <HomePage />
}
