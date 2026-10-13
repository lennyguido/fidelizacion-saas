import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { errorMessage, reputation, type ReviewTag } from '@plataforma/sdk'
import { Alert, Button, Card, EmptyState, Spinner, TextField, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useInvalidateReviewTags, useReviewTags } from './queries'

/**
 * Reseñas (D-048): carteles con chip NFC y QR que llevan a dejar la reseña.
 * Cada cartel tiene un link corto que cuenta los toques; el destino se cambia
 * acá sin regrabar el chip.
 */
export function ReviewTagsPage() {
  const { business } = useActiveBusiness()
  const tags = useReviewTags(business.id)
  const canManage = business.role !== 'staff'

  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Carteles de reseñas</h1>
        <p className="text-sm text-slate-600">
          El cliente apoya el celular en el cartel (o escanea el QR) y llega directo a dejar su
          reseña. Acá ves cuántas personas lo tocaron.
        </p>
      </div>

      <Alert tone="info">
        Google no permite dar premios a cambio de reseñas ni pedírselas solo a los clientes
        contentos. El cartel tiene que invitar a todos, sin regalo: &ldquo;¿Te gustó? Contalo en
        Google&rdquo;.
      </Alert>

      {canManage && <NewTagForm />}

      {tags.isPending && <Spinner />}
      {tags.error && <Alert tone="error">{errorMessage(tags.error)}</Alert>}
      {tags.data && tags.data.length === 0 && (
        <EmptyState title="Todavía no hay carteles" description="Creá el primero arriba." />
      )}
      {tags.data?.map((tag) => <TagCard key={tag.id} tag={tag} canManage={canManage} />)}
    </section>
  )
}

function NewTagForm() {
  const { business } = useActiveBusiness()
  const invalidate = useInvalidateReviewTags(business.id)
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [destination, setDestination] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => reputation.createTag(business.id, label.trim(), destination.trim() || null),
    onSuccess: async () => {
      setLabel('')
      setDestination('')
      await invalidate()
      toast.show('Cartel creado', 'success')
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
        <h2 className="text-base font-semibold">Nuevo cartel</h2>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Dónde va"
          placeholder="Mostrador"
          maxLength={60}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          hint="Para reconocerlo en la lista: mostrador, mesa 4, vidriera…"
        />
        <TextField
          label="A dónde lleva (opcional)"
          type="url"
          placeholder="https://…"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          hint={
            <>
              Vacío = tus reseñas de Google (el link de{' '}
              <Link to={`/b/${business.slug}/negocio`} className="underline">
                Mi negocio
              </Link>
              ).
            </>
          }
        />
        <Button type="submit" loading={create.isPending} disabled={!label.trim()}>
          Crear cartel
        </Button>
      </form>
    </Card>
  )
}

function TagCard({ tag, canManage }: { tag: ReviewTag; canManage: boolean }) {
  const { business } = useActiveBusiness()
  const invalidate = useInvalidateReviewTags(business.id)
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [destination, setDestination] = useState(tag.destination)
  const nfcLink = reputation.tagLink(tag.code, 'nfc')
  const qrLink = reputation.tagLink(tag.code, 'qr')

  const update = useMutation({
    mutationFn: (changes: { destination?: string; active?: boolean }) =>
      reputation.updateTag(tag.id, changes),
    onSuccess: async () => {
      setEditing(false)
      await invalidate()
      toast.show('Cartel actualizado', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  async function copy() {
    try {
      await navigator.clipboard.writeText(nfcLink)
      toast.show('Link copiado', 'success')
    } catch {
      toast.show('No se pudo copiar: seleccioná el link y copialo a mano', 'error')
    }
  }

  return (
    <Card className={`flex flex-col gap-4 ${tag.active ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{tag.label}</h2>
          <p className="truncate text-xs text-slate-500">Lleva a: {tag.destination}</p>
          {!tag.active && <p className="text-xs font-medium text-slate-700">Apagado</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{tag.tapsThisMonth}</p>
          <p className="text-xs text-slate-500">toques este mes</p>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Mes pasado: {tag.tapsLastMonth} · Desde que se creó: {tag.tapsTotal}
      </p>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">Link para grabar en el chip NFC</p>
          <p className="break-all rounded bg-slate-50 px-2 py-1 font-mono text-xs">{nfcLink}</p>
          <p className="text-xs text-slate-500">
            Con la app gratis NFC Tools: Escribir → Agregar registro → URL → pegar este link →
            Escribir, y apoyar el chip.
          </p>
          <Button variant="secondary" onClick={() => void copy()} className="w-fit">
            Copiar link
          </Button>
        </div>
        <TagQr link={qrLink} fileName={`resenas-${tag.code}.png`} />
      </div>

      {canManage &&
        (editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              update.mutate({ destination: destination.trim() })
            }}
          >
            <TextField
              label="A dónde lleva"
              type="url"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              hint="El chip y el QR no cambian: solo cambia a dónde llevan."
            />
            <div className="flex gap-2">
              <Button type="submit" loading={update.isPending} disabled={!destination.trim()}>
                Guardar destino
              </Button>
              <Button variant="ghost" type="button" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Cambiar destino
            </Button>
            <Button
              variant="ghost"
              loading={update.isPending}
              onClick={() => update.mutate({ active: !tag.active })}
            >
              {tag.active ? 'Apagar cartel' : 'Prender cartel'}
            </Button>
          </div>
        ))}
    </Card>
  )
}

/** QR para imprimir en el cartel (se cuenta aparte de los toques del chip). */
function TagQr({ link, fileName }: { link: string; fileName: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void QRCode.toDataURL(link, { margin: 1, width: 600 }).then((data) => {
      if (alive) setSrc(data)
    })
    return () => {
      alive = false
    }
  }, [link])
  if (!src) return null
  return (
    <div className="flex flex-col items-center gap-1">
      <img src={src} alt="QR del cartel" className="h-32 w-32" />
      <a href={src} download={fileName} className="text-xs font-medium text-slate-700 underline">
        Descargar QR
      </a>
    </div>
  )
}
