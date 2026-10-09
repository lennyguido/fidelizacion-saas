import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  businesses,
  errorMessage,
  normalizeHexColor,
  type BrandingInput,
  type MyBusiness,
} from '@plataforma/sdk'
import { Alert, Button, Card, TextField, useToast } from '@plataforma/ui'
import { ColorField } from './ColorField'
import { TimezoneSelect } from './TimezoneSelect'
import { useInvalidateMyBusinesses } from './queries'

const DEFAULT_BRAND_COLOR = '#0f172a'

/** Nombre, color de marca y zona horaria del negocio. */
export function BrandingForm({ business }: { business: MyBusiness }) {
  const toast = useToast()
  const invalidate = useInvalidateMyBusinesses()
  const [name, setName] = useState(business.name)
  const [color, setColor] = useState(business.primaryColor ?? DEFAULT_BRAND_COLOR)
  const [timezone, setTimezone] = useState(business.timezone)
  const [error, setError] = useState<string | null>(null)

  const colorError = normalizeHexColor(color) ? null : 'Usá el formato #RRGGBB (ej. #d97706).'

  const save = useMutation({
    mutationFn: (input: BrandingInput) => businesses.updateBranding(business.id, input),
    onSuccess: async () => {
      await invalidate()
      toast.show('Datos del negocio guardados', 'success')
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) return setError('El negocio necesita un nombre.')
    if (colorError) return setError(colorError)
    save.mutate({ name, primaryColor: color, timezone })
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <h2 className="text-base font-semibold">Datos y marca</h2>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Nombre del negocio"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <ColorField value={color} onChange={setColor} error={colorError} />
        <TimezoneSelect value={timezone} onChange={setTimezone} />
        <div>
          <Button type="submit" loading={save.isPending}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Card>
  )
}
