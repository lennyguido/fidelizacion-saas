import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage, feedback } from '@plataforma/sdk'
import { Button, Card, Spinner, TextField, useToast } from '@plataforma/ui'
import { useActiveBusiness } from './ActiveBusinessContext'

/** Link de reseñas de Google (D-036). Solo dueño/admin. */
export function ReviewLinkCard() {
  const { business } = useActiveBusiness()
  const url = useQuery({
    queryKey: ['business', business.id, 'review-url'],
    queryFn: () => feedback.getReviewUrl(business.id),
  })
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold">Reseñas en Google</h2>
        <p className="text-sm text-slate-600">
          Después de cada visita, la tarjeta del cliente pregunta "¿Cómo te atendimos?" y a todos
          les ofrece dejar una reseña en Google. Sin premios ni filtros: Google lo prohíbe. Las
          notas de 3 o menos te llegan como aviso privado.
        </p>
      </div>
      {url.isPending ? <Spinner /> : <ReviewLinkForm initial={url.data ?? ''} />}
    </Card>
  )
}

function ReviewLinkForm({ initial }: { initial: string }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [value, setValue] = useState(initial)
  const invalid = value.trim() !== '' && !feedback.isValidReviewUrl(value)
  const save = useMutation({
    mutationFn: () => feedback.saveReviewUrl(business.id, value),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['business', business.id, 'review-url'] })
      toast.show('Link de reseñas guardado', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!invalid) save.mutate()
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <TextField
        label="Link para dejar una reseña"
        placeholder="https://g.page/r/..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={
          invalid ? 'Tiene que ser un link de Google (g.page, google.com o maps.app.goo.gl).' : null
        }
        hint='En Google Maps, abrí tu negocio → "Pedir reseñas" → copiar el link.'
      />
      <div>
        <Button type="submit" loading={save.isPending} disabled={invalid}>
          Guardar
        </Button>
      </div>
    </form>
  )
}
