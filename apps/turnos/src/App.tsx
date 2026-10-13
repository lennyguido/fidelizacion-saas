import { booking } from '@plataforma/sdk'
import { AppointmentPage } from '@/AppointmentPage'
import { BookingPage } from '@/BookingPage'
import { HomePage } from '@/HomePage'
import { PanelApp } from '@/panel/PanelApp'

/**
 * turnos.neriva.net (D-049):
 * /            qué es Turnos (para dueños)
 * /<negocio>   reservar un turno
 * /turno#…     ver, cambiar o cancelar el turno (link secreto)
 * /panel…      panel del negocio (D-050)
 */
export function App() {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/panel' || path.startsWith('/panel/')) return <PanelApp />
  if (path === '/turno') {
    return <AppointmentPage token={booking.tokenFromHash(window.location.hash)} />
  }
  const slug = path.replace(/^\//, '')
  if (/^[a-z0-9-]{2,60}$/.test(slug)) return <BookingPage slug={slug} />
  return <HomePage />
}
