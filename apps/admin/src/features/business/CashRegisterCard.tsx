import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  errorMessage,
  formatMoney,
  integrations,
  normalizePhone,
  parseAmountToMinor,
  readPublicEnv,
  type IntegrationKey,
} from '@plataforma/sdk'
import { Alert, Button, Card, Spinner, TextField, useToast } from '@plataforma/ui'
import { formatDateTime } from '../../lib/format'
import { useActiveBusiness } from './ActiveBusinessContext'

/** Conexión con la caja (D-033): las ventas entran solas como visitas. */
export function CashRegisterCard() {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const queryClient = useQueryClient()
  const queryKey = ['customers', business.id, 'integration-keys']
  const keys = useQuery({ queryKey, queryFn: () => integrations.listKeys(business.id) })
  const [name, setName] = useState('Caja')
  const [newKey, setNewKey] = useState<string | null>(null)
  const url = integrations.ingestUrl(readPublicEnv(import.meta.env).supabaseUrl)

  const create = useMutation({
    mutationFn: () => integrations.createKey(business.id, name.trim()),
    onSuccess: async (key) => {
      setNewKey(key)
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Conexión con la caja</h2>
        <p className="text-sm text-slate-600">
          Si tu caja o sistema de gestión puede avisar cada venta, las visitas entran solas, sin
          escanear nada. Pasale esta dirección y una clave a quien te instala el sistema.
        </p>
      </div>
      <p className="break-all rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{url}</p>
      {newKey && (
        <Alert tone="success">
          <p className="font-medium">Copiá la clave ahora: no se vuelve a mostrar.</p>
          <p className="mt-1 break-all font-mono">{newKey}</p>
        </Alert>
      )}
      <div className="flex items-end gap-2">
        <TextField
          label="Nombre de la clave"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          loading={create.isPending}
          disabled={name.trim() === ''}
          onClick={() => create.mutate()}
        >
          Generar clave
        </Button>
      </div>
      {keys.isPending && <Spinner />}
      {keys.error && <p className="text-sm text-slate-500">Todavía no está disponible.</p>}
      {keys.data && keys.data.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {keys.data.map((key) => (
            <KeyRow
              key={key.id}
              item={key}
              onChanged={() => queryClient.invalidateQueries({ queryKey })}
            />
          ))}
        </ul>
      )}
      <SaleSimulator />
    </Card>
  )
}

function KeyRow({ item, onChanged }: { item: IntegrationKey; onChanged: () => Promise<void> }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const revoke = useMutation({
    mutationFn: () => integrations.revokeKey(item.id),
    onSuccess: onChanged,
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const used = item.lastUsedAt
    ? `último uso ${formatDateTime(item.lastUsedAt, business.timezone)}`
    : 'sin uso todavía'

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-medium">{item.name}</p>
        <p className="text-xs text-slate-500">
          {item.prefix}… · {item.revokedAt ? 'revocada' : used}
        </p>
      </div>
      {!item.revokedAt && (
        <Button variant="ghost" loading={revoke.isPending} onClick={() => revoke.mutate()}>
          Revocar
        </Button>
      )}
    </li>
  )
}

/** Probar sin caja: manda una venta de prueba y muestra qué pasó. */
function SaleSimulator() {
  const { business } = useActiveBusiness()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const amountMinor = parseAmountToMinor(amount)
  const normalized = normalizePhone(phone)
  const phoneInvalid = phone.trim() !== '' && normalized === null

  const simulate = useMutation({
    mutationFn: () => integrations.simulateSale(business.id, amountMinor ?? 0, normalized),
    onSuccess: async (sale) => {
      setResult(
        sale.status === 'invalid'
          ? `No se pudo registrar: ${sale.message ?? ''}`
          : sale.identified
            ? `Venta de ${formatMoney(amountMinor, business.currency)} registrada para el cliente de ese celular.`
            : `Venta de ${formatMoney(amountMinor, business.currency)} registrada sin identificar.`,
      )
      await queryClient.invalidateQueries({ queryKey: ['customers', business.id] })
    },
    onError: (err) => setResult(errorMessage(err)),
  })

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-3">
      <h3 className="text-sm font-semibold">Probar con una venta de prueba</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Monto"
          inputMode="decimal"
          placeholder="8.500"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextField
          label="Celular del cliente (opcional)"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={phoneInvalid ? 'No reconocemos ese número.' : null}
        />
      </div>
      <Button
        variant="secondary"
        loading={simulate.isPending}
        disabled={amountMinor === null || phoneInvalid}
        onClick={() => simulate.mutate()}
      >
        Mandar venta de prueba
      </Button>
      {result && <p className="text-sm text-slate-700">{result}</p>}
    </div>
  )
}
