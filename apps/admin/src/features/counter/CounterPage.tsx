import { useCallback, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  customers,
  errorMessage,
  formatMoney,
  formatPhone,
  normalizePhone,
  parseAmountToMinor,
  visits,
  type CustomerListItem,
} from '@plataforma/sdk'
import { Alert, Button, Card, Spinner, TextField, useToast } from '@plataforma/ui'
import { useCustomerCodeMatch } from '../../modules/useCustomerCodeMatch'
import { useActiveBusiness } from '../business/ActiveBusinessContext'
import { QrScanner } from './QrScanner'
import { canScanQr } from './qrSupport'
import { StatusBadge } from '../customers/StatusBadge'
import { useCustomerSearch, useInvalidateCustomers } from '../customers/queries'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { formatDaysAgo } from '../../lib/format'

/**
 * Mostrador: registrar una visita en pocos segundos.
 * Buscar → tocar "+1" (monto opcional). Si no existe, se crea en el momento.
 */
export function CounterPage() {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateCustomers(business.id)
  const [query, setQuery] = useState('')
  const [amountText, setAmountText] = useState('')
  const [creating, setCreating] = useState(false)
  const [scanning, setScanning] = useState(false)
  const onScanned = useCallback((text: string) => {
    setScanning(false)
    setCreating(false)
    setQuery(text)
  }, [])
  const debouncedQuery = useDebouncedValue(query)
  const results = useCustomerSearch(business.id, debouncedQuery, null, 8)
  const codeMatch = useCustomerCodeMatch(debouncedQuery)

  const amountMinor = parseAmountToMinor(amountText)
  const amountInvalid = amountText.trim() !== '' && amountMinor === null

  function reset() {
    setQuery('')
    setAmountText('')
    setCreating(false)
  }

  const record = useMutation({
    mutationFn: (customer: { id: string; name: string } | null) =>
      visits.record({ businessId: business.id, customerId: customer?.id ?? null, amountMinor }),
    onSuccess: async (_visit, customer) => {
      const amount = amountMinor === null ? '' : ` (${formatMoney(amountMinor, business.currency)})`
      toast.show(
        customer ? `Visita de ${customer.name} registrada${amount}` : `Visita registrada${amount}`,
        'success',
      )
      reset()
      await invalidate()
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  const busy = record.isPending

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Mostrador</h1>

      <Card className="flex flex-col gap-4">
        <TextField
          label="Buscar cliente"
          type="search"
          autoFocus
          placeholder="Nombre, teléfono o código de socio"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCreating(false)
          }}
        />
        {scanning ? (
          <QrScanner onResult={onScanned} onClose={() => setScanning(false)} />
        ) : (
          canScanQr() && (
            <Button variant="secondary" onClick={() => setScanning(true)}>
              Escanear QR de la tarjeta
            </Button>
          )
        )}
        <TextField
          label="Monto (opcional)"
          inputMode="decimal"
          placeholder="8.500"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          error={amountInvalid ? 'Escribilo así: 8.500 o 8500,50' : null}
          hint={amountMinor !== null ? formatMoney(amountMinor, business.currency) : undefined}
        />
      </Card>

      {codeMatch.data && !creating && (
        <Card className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Socio encontrado por código</p>
            <p className="truncate font-medium">{codeMatch.data.name}</p>
          </div>
          <Button
            size="lg"
            disabled={busy || amountInvalid}
            onClick={() => codeMatch.data && record.mutate(codeMatch.data)}
          >
            +1
          </Button>
        </Card>
      )}

      {creating ? (
        <QuickCreate
          initialQuery={query}
          disabled={busy || amountInvalid}
          onCancel={() => setCreating(false)}
          onCreated={(customer) => record.mutate(customer)}
        />
      ) : (
        <Results
          items={results.data}
          loading={results.isPending}
          error={results.error ? errorMessage(results.error) : null}
          searching={debouncedQuery.trim() !== ''}
          disabled={busy || amountInvalid}
          onPick={(customer) => record.mutate(customer)}
          onCreate={() => setCreating(true)}
        />
      )}

      <Button
        variant="secondary"
        size="lg"
        fullWidth
        disabled={busy || amountInvalid}
        onClick={() => record.mutate(null)}
      >
        + Visita sin identificar
      </Button>
    </section>
  )
}

interface ResultsProps {
  items: CustomerListItem[] | undefined
  loading: boolean
  error: string | null
  searching: boolean
  disabled: boolean
  onPick: (customer: CustomerListItem) => void
  onCreate: () => void
}

function Results({ items, loading, error, searching, disabled, onPick, onCreate }: ResultsProps) {
  if (loading) return <Spinner />
  if (error) return <Alert tone="error">{error}</Alert>

  return (
    <Card className="flex flex-col gap-1 p-2">
      {!searching && (items?.length ?? 0) > 0 && (
        <p className="px-2 pt-1 text-xs font-medium text-slate-500">Vinieron hace poco</p>
      )}
      {items?.map((customer) => (
        <div
          key={customer.id}
          className="flex items-center justify-between gap-3 rounded-lg px-2 py-2"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{customer.name}</p>
            <p className="flex items-center gap-2 truncate text-xs text-slate-500">
              <StatusBadge status={customer.status} />
              {formatPhone(customer.phone)} · {formatDaysAgo(customer.lastVisitAt)}
            </p>
          </div>
          <Button
            size="lg"
            disabled={disabled}
            onClick={() => onPick(customer)}
            aria-label={`Registrar visita de ${customer.name}`}
          >
            +1
          </Button>
        </div>
      ))}
      {searching && items?.length === 0 && (
        <p className="px-2 py-3 text-sm text-slate-500">
          No hay clientes con ese nombre o teléfono.
        </p>
      )}
      <Button variant="ghost" fullWidth onClick={onCreate}>
        + Cliente nuevo
      </Button>
    </Card>
  )
}

interface QuickCreateProps {
  initialQuery: string
  disabled: boolean
  onCancel: () => void
  onCreated: (customer: { id: string; name: string }) => void
}

/** Alta rápida en el mostrador: nombre y (opcional) teléfono. */
function QuickCreate({ initialQuery, disabled, onCancel, onCreated }: QuickCreateProps) {
  const { business } = useActiveBusiness()
  const looksLikePhone = /^[\d\s()+-]{6,}$/.test(initialQuery.trim())
  const [name, setName] = useState(looksLikePhone ? '' : initialQuery.trim())
  const [phone, setPhone] = useState(looksLikePhone ? initialQuery.trim() : '')
  const [error, setError] = useState<string | null>(null)
  const normalized = normalizePhone(phone)
  const phoneInvalid = phone.trim() !== '' && normalized === null

  const create = useMutation({
    mutationFn: () =>
      customers.create(business.id, { name, phone: normalized, email: null, notes: null }),
    onSuccess: (customer) => onCreated({ id: customer.id, name: customer.name }),
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
        <h2 className="text-base font-semibold">Cliente nuevo</h2>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Nombre"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Teléfono (opcional)"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={phoneInvalid ? 'No reconocemos ese número. Ej: 11 2233-4455' : null}
          hint={normalized ? `Se guarda como ${formatPhone(normalized)}` : undefined}
        />
        <div className="flex gap-2">
          <Button
            type="submit"
            size="lg"
            loading={create.isPending}
            disabled={disabled || name.trim() === '' || phoneInvalid}
          >
            Guardar y registrar visita
          </Button>
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  )
}
