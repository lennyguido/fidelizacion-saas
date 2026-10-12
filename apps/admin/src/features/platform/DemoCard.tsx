import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { access, DEMO_TRADES, errorMessage } from '@plataforma/sdk'
import { Alert, Button, Card, TextField } from '@plataforma/ui'
import { useSession } from '../auth/AuthContext'
import { businessKeys } from '../business/queries'

/** "Armar demo" (D-045): el local que vas a visitar, listo para mostrar. */
export function DemoCard() {
  const session = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [trade, setTrade] = useState('cafeteria')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => access.createDemo(name.trim(), trade),
    onSuccess: async (slug) => {
      await queryClient.invalidateQueries({ queryKey: businessKeys.mine(session.user.id) })
      navigate(`/b/${slug}`)
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    create.mutate()
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div>
          <h2 className="text-base font-semibold">Armar demo para un local</h2>
          <p className="text-sm text-slate-600">
            Antes de entrar, poné el nombre del local: se crea con clientes de ejemplo, mensajes
            listos, estadísticas y el alta por QR prendida.
          </p>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Nombre del local"
          placeholder="Café La Esquina"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-800">Rubro</span>
          <select
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-base"
          >
            {DEMO_TRADES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" loading={create.isPending} disabled={name.trim().length < 2}>
          Armar demo
        </Button>
      </form>
    </Card>
  )
}
