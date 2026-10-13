import type { ModuleManifest } from '../types'
import { AgendaPage } from './AgendaPage'
import { BookingSetupPage } from './BookingSetupPage'
import { TodayHomeCard } from './TodayHomeCard'

export const bookingManifest: ModuleManifest = {
  id: 'booking',
  name: 'Turnos',
  nav: [{ label: 'Turnos', path: 'turnos' }],
  routes: [
    { path: 'turnos', element: <AgendaPage /> },
    { path: 'turnos/configuracion', element: <BookingSetupPage /> },
  ],
  homeCard: TodayHomeCard,
}
