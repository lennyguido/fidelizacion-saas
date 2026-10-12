import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  access,
  errorMessage,
  SALES_PLANS,
  type AccessGrant,
  type GrantResult,
  type SalesPlan,
} from '@plataforma/sdk'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  FullPageSpinner,
  TextField,
  useToast,
} from '@plataforma/ui'

const RESULT_TEXT: Record<GrantResult, string> = {
  invited: 'Listo: le mandamos un mail para que elija su contraseña.',
  existing_user: 'Listo: ya tenía cuenta. Que entre con su contraseña y cree su negocio.',
  grant_without_email:
    'El acceso quedó creado, pero el mail no salió. Que entre a "Olvidé mi contraseña" con ese mail.',
}

const STATUS_TEXT = { pending: 'Esperando', used: 'Usado', revoked: 'Revocado' } as const

/** /admin/accesos — solo el administrador de la plataforma (D-043). */
export function AccessGrantsPage() {
  const admin = useQuery({ queryKey: ['platform-admin'], queryFn: () => access.isPlatformAdmin() })
  if (admin.isPending) return <FullPageSpinner />
  if (!admin.data) {
    return (
      <main className="mx-auto max-w-xl p-4">
        <EmptyState title="No tenés permiso" description="Esta pantalla es solo para Vueltita." />
      </main>
    )
  }
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Accesos</h1>
        <Link to="/" className="text-sm text-slate-500 hover:underline">
          Volver al panel
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        Cuando alguien te paga, cargá su mail y el plan. Le llega un mail para elegir su contraseña
        y crear su negocio. Sin acceso, nadie puede crear un negocio.
      </p>
      <GrantForm />
      <GrantList />
    </main>
  )
}

function GrantForm() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState<SalesPlan>('barrio')
  const [note, setNote] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())

  const give = useMutation({
    mutationFn: () => access.grant(email.trim(), plan, note.trim() || null),
    onSuccess: async (status) => {
      setResult(RESULT_TEXT[status])
      setEmail('')
      setNote('')
      await queryClient.invalidateQueries({ queryKey: ['access-grants'] })
    },
    onError: (err) => setResult(errorMessage(err)),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setResult(null)
    give.mutate()
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <h2 className="text-base font-semibold">Dar acceso</h2>
        {result && <Alert tone="info">{result}</Alert>}
        <TextField
          label="Mail del cliente"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <fieldset className="flex flex-wrap gap-3 text-sm">
          <legend className="mb-1 font-medium text-slate-800">Plan</legend>
          {SALES_PLANS.map((option) => (
            <label key={option.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="plan"
                checked={plan === option.id}
                onChange={() => setPlan(option.id)}
              />
              {option.name}
            </label>
          ))}
        </fieldset>
        <TextField
          label="Nota (opcional)"
          placeholder="Pagó por transferencia el 12/10"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button type="submit" loading={give.isPending} disabled={!emailValid}>
          Dar acceso
        </Button>
      </form>
    </Card>
  )
}

function GrantList() {
  const list = useQuery({ queryKey: ['access-grants'], queryFn: () => access.listGrants() })
  if (list.isPending) return null
  if (list.error) return <Alert tone="error">{errorMessage(list.error)}</Alert>
  if (list.data.length === 0) return null
  return (
    <Card className="flex flex-col gap-2 p-0">
      <h2 className="px-4 pt-4 text-base font-semibold">Accesos dados</h2>
      <ul className="divide-y divide-slate-100">
        {list.data.map((grant) => (
          <GrantRow key={grant.id} grant={grant} />
        ))}
      </ul>
    </Card>
  )
}

function GrantRow({ grant }: { grant: AccessGrant }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const revoke = useMutation({
    mutationFn: () => access.revoke(grant.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-grants'] }),
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const planName = SALES_PLANS.find((p) => p.id === grant.planId)?.name ?? grant.planId

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{grant.email}</p>
        <p className="text-xs text-slate-500">
          {planName} · {STATUS_TEXT[grant.status]}
          {grant.note ? ` · ${grant.note}` : ''}
        </p>
      </div>
      {grant.status === 'pending' && (
        <Button variant="ghost" loading={revoke.isPending} onClick={() => revoke.mutate()}>
          Revocar
        </Button>
      )}
    </li>
  )
}
