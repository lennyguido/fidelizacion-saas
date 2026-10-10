import { useMutation } from '@tanstack/react-query'
import { AppError, errorMessage, loyalty, type LoyaltyProgramTemplate } from '@plataforma/sdk'
import { Button, Card, Spinner, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useInvalidateLoyalty, useTemplates } from './queries'

/** Plantillas por rubro (D-032): arman el programa y 2 recompensas con un toque. */
export function TemplatesCard() {
  const templates = useTemplates()

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold">Empezar con una plantilla</h2>
        <p className="text-sm text-slate-600">
          Elegí tu rubro y te armamos el programa y dos recompensas. Después lo podés cambiar.
        </p>
      </div>
      {templates.isPending && <Spinner />}
      {templates.error && <p className="text-sm text-slate-500">Todavía no está disponible.</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {templates.data?.map((template) => (
          <TemplateButton key={template.kind} template={template} />
        ))}
      </ul>
    </Card>
  )
}

function TemplateButton({ template }: { template: LoyaltyProgramTemplate }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const apply = useMutation({
    mutationFn: async () => {
      try {
        await loyalty.applyTemplate(business.id, template.kind)
      } catch (err) {
        if (!(err instanceof AppError && err.code === 'program_has_activity')) throw err
        const ok = window.confirm(
          'Tu programa ya tiene puntos o sellos cargados. ¿Querés reemplazar la regla y las recompensas? Los puntos de los clientes no se borran.',
        )
        if (!ok) return false
        await loyalty.applyTemplate(business.id, template.kind, true)
      }
      return true
    },
    onSuccess: async (applied) => {
      if (!applied) return
      toast.show(`Listo: programa de ${template.label}`, 'success')
      await invalidate()
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
      <div className="min-w-0">
        <p className="font-medium">{template.label}</p>
        <p className="text-sm text-slate-600">{template.summary}</p>
      </div>
      <Button variant="secondary" loading={apply.isPending} onClick={() => apply.mutate()}>
        Usar
      </Button>
    </li>
  )
}
