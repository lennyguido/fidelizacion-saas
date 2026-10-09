import { useState, type FormEvent } from 'react'
import { formatPhone, normalizePhone, type CustomerInput } from '@plataforma/sdk'
import { Alert, Button, TextField } from '@plataforma/ui'
import { emptyCustomerForm, type CustomerFormValues } from './customerFormValues'

interface Props {
  initial?: CustomerFormValues
  submitLabel: string
  submitting: boolean
  error: string | null
  onSubmit: (input: CustomerInput) => void
  onCancel?: () => void
}

/** Alta/edición de cliente. Solo el nombre es obligatorio. */
export function CustomerForm({
  initial = emptyCustomerForm,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState(initial)
  const normalizedPhone = normalizePhone(values.phone)
  const phoneInvalid = values.phone.trim() !== '' && normalizedPhone === null
  const emailInvalid =
    values.email.trim() !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())
  const canSubmit = values.name.trim() !== '' && !phoneInvalid && !emailInvalid

  function set<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit({
      name: values.name,
      phone: normalizedPhone,
      email: values.email.trim() || null,
      notes: values.notes.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <TextField
        label="Nombre"
        required
        maxLength={120}
        placeholder="Ana Gómez o “Don Carlos, cortado”"
        value={values.name}
        onChange={(e) => set('name', e.target.value)}
      />
      <TextField
        label="Teléfono (opcional)"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="11 2233-4455"
        value={values.phone}
        onChange={(e) => set('phone', e.target.value)}
        error={phoneInvalid ? 'No reconocemos ese número. Ej: 11 2233-4455' : null}
        hint={
          normalizedPhone
            ? `Se guarda como ${formatPhone(normalizedPhone)}`
            : 'Sirve para WhatsApp.'
        }
      />
      <TextField
        label="Email (opcional)"
        type="email"
        autoComplete="off"
        value={values.email}
        onChange={(e) => set('email', e.target.value)}
        error={emailInvalid ? 'Revisá el email.' : null}
      />
      <TextField
        label="Notas (opcional)"
        maxLength={2000}
        placeholder="Toma cortado sin azúcar"
        value={values.notes}
        onChange={(e) => set('notes', e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" loading={submitting} disabled={!canSubmit}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
