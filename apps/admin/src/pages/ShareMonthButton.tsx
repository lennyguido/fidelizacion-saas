import { useMutation } from '@tanstack/react-query'
import { dashboard, formatMoney, type DashboardSummary } from '@plataforma/sdk'
import { Button, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { renderSummaryImage, shareOrDownload } from '../lib/summaryImage'

/** "Compartir como imagen" del resumen del mes (D-038), con los números del tablero. */
export function ShareMonthButton({ data }: { data: DashboardSummary }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const share = useMutation({
    mutationFn: async () => {
      const month = new Intl.DateTimeFormat('es-AR', {
        month: 'long',
        year: 'numeric',
        timeZone: business.timezone,
      }).format(new Date(data.monthStart))
      const change = dashboard.percentChange(data.visits, data.visitsPrev)
      const lines = [
        {
          label: 'Visitas',
          value:
            change === null
              ? String(data.visits)
              : `${data.visits} (${change >= 0 ? '+' : ''}${change}%)`,
        },
        { label: 'Clientes nuevos', value: String(data.newCustomers) },
        { label: 'Clientes que volvieron', value: String(data.recoveredCustomers) },
      ]
      if (data.revenueMinor > 0) {
        lines.push({
          label: 'Ventas registradas',
          value: formatMoney(data.revenueMinor, business.currency),
        })
      }
      const blob = await renderSummaryImage({
        businessName: business.name,
        monthLabel: `Resumen de ${month}`,
        lines,
      })
      await shareOrDownload(blob, `resumen-${data.monthStart.slice(0, 7)}.png`)
    },
    onError: () => toast.show('No se pudo armar la imagen en este navegador.', 'error'),
  })
  return (
    <Button variant="secondary" loading={share.isPending} onClick={() => share.mutate()}>
      Compartir como imagen
    </Button>
  )
}
