import { useState } from 'react'
import { dataExport, localDateInTimeZone } from '@plataforma/sdk'
import { Button, Card } from '@plataforma/ui'
import { DateRangeFields, type DateRange } from '../../lib/DateRangeFields'
import { useCsvDownload } from '../../lib/useCsvDownload'
import { useActiveBusiness } from './ActiveBusinessContext'

/** "Tus clientes son tuyos" (D-034): descargar clientes y visitas en CSV. Solo dueño/admin. */
export function ExportDataCard() {
  const { business } = useActiveBusiness()
  const today = () => localDateInTimeZone(business.timezone)
  const [range, setRange] = useState<DateRange>(() => ({
    from: localDateInTimeZone(business.timezone, new Date(), 30),
    to: localDateInTimeZone(business.timezone),
  }))

  const customers = useCsvDownload(
    () => dataExport.exportCustomers(business.id),
    () => dataExport.exportFileName('clientes', today()),
  )
  const visits = useCsvDownload(
    () => dataExport.exportVisits(business.id, range.from, range.to),
    () => dataExport.exportFileName('visitas', today()),
  )

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Tus clientes son tuyos</h2>
        <p className="text-sm text-slate-600">
          Descargá tus datos en una planilla (CSV, se abre con Excel o Google Sheets). Queda
          registrado quién la descargó. Cuidala: tiene teléfonos y emails de tus clientes.
        </p>
      </div>
      <Button variant="secondary" loading={customers.isPending} onClick={() => customers.mutate()}>
        Descargar todos los clientes
      </Button>
      <div className="flex flex-col gap-2">
        <DateRangeFields value={range} onChange={setRange} />
        <Button variant="secondary" loading={visits.isPending} onClick={() => visits.mutate()}>
          Descargar visitas (hasta un año por archivo)
        </Button>
      </div>
    </Card>
  )
}
