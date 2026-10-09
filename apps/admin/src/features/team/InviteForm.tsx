import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage, team, type CreatedInvitation } from '@plataforma/sdk'
import { Alert, Button, Card, TextField, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../business/ActiveBusinessContext'
import { formatDateTime } from '../../lib/format'
import { useInvalidateTeam } from './queries'
import { roleDescriptions } from './roles'

export function InviteForm() {
  const { business } = useActiveBusiness()
  const invalidate = useInvalidateTeam(business.id)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; invitation: CreatedInvitation } | null>(
    null,
  )

  const create = useMutation({
    mutationFn: () => team.createInvitation(business.id, email.trim(), role),
    onSuccess: async (invitation) => {
      setCreated({ email: email.trim().toLowerCase(), invitation })
      setEmail('')
      await invalidate()
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setCreated(null)
    create.mutate()
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">Invitar a alguien</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Email de la persona"
          type="email"
          autoComplete="off"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="Tiene que crear su cuenta o ingresar con este mismo email."
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-slate-800">Rol</legend>
          {(business.role === 'owner' ? (['staff', 'admin'] as const) : (['staff'] as const)).map(
            (value) => (
              <label key={value} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="mt-1"
                />
                <span>
                  <strong>{value === 'staff' ? 'Empleado' : 'Administrador'}</strong> —{' '}
                  {roleDescriptions[value]}
                </span>
              </label>
            ),
          )}
        </fieldset>
        <Button type="submit" loading={create.isPending} disabled={!email.trim()}>
          Crear invitación
        </Button>
      </form>
      {created && <InvitationLink email={created.email} invitation={created.invitation} />}
    </Card>
  )
}

function InvitationLink({ email, invitation }: { email: string; invitation: CreatedInvitation }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const link = team.invitationLink(window.location.origin, invitation.token)
  const whatsappText = `Te invito a sumarte a ${business.name}. Entrá con tu email ${email} acá: ${link}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast.show('Link copiado', 'success')
    } catch {
      toast.show('No se pudo copiar: seleccioná el link y copialo a mano', 'error')
    }
  }

  return (
    <Alert tone="success">
      <p className="font-medium">Invitación creada para {email}.</p>
      <p className="mt-1">
        Mandale este link. Solo se muestra ahora y vence el{' '}
        {formatDateTime(invitation.expiresAt, business.timezone)}.
      </p>
      <p
        className="mt-2 break-all rounded bg-white px-2 py-1 font-mono text-xs text-slate-800"
        data-testid="invitation-link"
      >
        {link}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void copy()}>
          Copiar link
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-white"
        >
          Enviar por WhatsApp
        </a>
      </div>
    </Alert>
  )
}
