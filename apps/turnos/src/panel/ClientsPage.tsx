import { useState } from 'react'
import { booking, errorMessage, formatPhone, type BookingClient } from '@plataforma/sdk'
import { Alert, Button, EmptyState, Spinner, TextField } from '@plataforma/ui'
import { usePanel } from './context'
import { useClientHistory, useClients } from './queries'

const STATUS_LABEL = {
  booked: 'Pendiente',
  attended: 'Asistió',
  no_show: 'No vino',
  cancelled: 'Cancelado',
} as const

function pesos(minor: number): string {
  return `$${Math.round(minor / 100).toLocaleString('es-AR')}`
}

/** Clientes de Turnos con su historial (D-050). */
export function ClientsPage() {
  const { business } = usePanel()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<BookingClient | null>(null)
  const list = useClients(business.id, search.trim())

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
      <TextField
        label="Buscar"
        placeholder="Nombre o celular"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      {list.isPending && <Spinner />}
      {list.error && <Alert tone="error">{errorMessage(list.error)}</Alert>}
      {list.data && list.data.length === 0 && (
        <EmptyState
          title={search ? 'Nadie con ese nombre o celular' : 'Todavía no hay clientes'}
          description="Aparecen solos cuando alguien saca un turno."
        />
      )}
      {list.data && list.data.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Vino</th>
                <th className="px-4 py-3 font-medium">Faltó</th>
                <th className="px-4 py-3 font-medium">Gastó</th>
                <th className="px-4 py-3 font-medium">Próximo turno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data.map((c) => (
                <tr
                  key={c.customerId}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelected(c)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name}</p>
                    {c.phone && <p className="text-xs text-slate-500">{formatPhone(c.phone)}</p>}
                  </td>
                  <td className="px-4 py-3">{c.attended}</td>
                  <td className={`px-4 py-3 ${c.noShows > 0 ? 'font-medium text-red-700' : ''}`}>
                    {c.noShows}
                  </td>
                  <td className="px-4 py-3">{pesos(c.spentMinor)}</td>
                  <td className="px-4 py-3 capitalize">
                    {c.nextAt
                      ? `${booking.formatDay(booking.dayInTimeZone(new Date(c.nextAt), business.timezone))} ${booking.formatTime(c.nextAt, business.timezone)}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && <ClientSheet client={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}

function ClientSheet({ client, onClose }: { client: BookingClient; onClose: () => void }) {
  const { business } = usePanel()
  const history = useClientHistory(business.id, client.customerId)

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-label={client.name}
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{client.name}</h2>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Vino" value={String(client.attended)} />
          <Stat label="Faltó" value={String(client.noShows)} />
          <Stat label="Gastó" value={pesos(client.spentMinor)} />
        </dl>
        {client.phone && (
          <a
            href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 w-fit items-center rounded-full px-4 text-sm font-medium ring-1 ring-inset ring-slate-300"
          >
            WhatsApp · {formatPhone(client.phone)}
          </a>
        )}
        <h3 className="font-semibold">Historial</h3>
        {history.isPending && <Spinner />}
        <ul className="divide-y divide-slate-100 text-sm">
          {history.data?.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="font-medium capitalize">
                  {booking.formatDay(booking.dayInTimeZone(new Date(v.startsAt), business.timezone))}{' '}
                  {booking.formatTime(v.startsAt, business.timezone)}
                </p>
                <p className="text-slate-500">
                  {v.serviceName} · {v.staffName}
                </p>
              </div>
              <span className="text-xs text-slate-600">{STATUS_LABEL[v.status]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}
