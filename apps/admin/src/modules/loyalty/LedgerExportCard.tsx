import { useState } from 'react'
import { dataExport, localDateInTimeZone } from '@plataforma/sdk'
import { Button, Card } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { DateRangeFields, type DateRange } from '../../lib/DateRangeFields'
import { useCsvDownload } from '../../lib/useCsvDownload'

/** Descargar los movimientos de puntos o sellos en CSV (D-034). Solo dueño/admin. */
export function LedgerExportCard() {
  const { business } = useActiveBusiness()
  const [range, setRange] = useState<DateRange>(() => ({
    from: localDateInTimeZone(business.timezone, new Date(), 30),
    to: localDateInTimeZone(business.timezone),
  }))
  const ledger = useCsvDownload(
    () => dataExport.exportLedger(business.id, range.from, range.to),
    () => dataExport.exportFileName('puntos', localDateInTimeZone(business.timezone)),
  )

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold">Descargar movimientos</h2>
        <p className="text-sm text-slate-600">
          Cada punto o sello sumado, canjeado o ajustado, en una planilla (hasta un año por
          archivo).
        </p>
      </div>
      <DateRangeFields value={range} onChange={setRange} />
      <Button variant="secondary" loading={ledger.isPending} onClick={() => ledger.mutate()}>
        Descargar movimientos
      </Button>
    </Card>
  )
}
