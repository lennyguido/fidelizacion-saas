import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { errorMessage, selfSignup, type SelfSignupNotice } from '@plataforma/sdk'
import { Button, Card, Spinner, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { formatDateTime } from '../../lib/format'
import { useInvalidateLoyalty, useSelfSignupSettings, useSignupNotices } from './queries'
import { signupUrl } from './signupUrl'

/** Alta por QR (D-032): el cliente se anota solo desde un cartel en el mostrador. */
export function SelfSignupCard() {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const settings = useSelfSignupSettings(business.id)
  const canManage = business.role !== 'staff'
  const enabled = settings.data?.enabled ?? false

  const toggle = useMutation({
    mutationFn: () => selfSignup.setEnabled(business.id, !enabled),
    onSuccess: invalidate,
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const rotate = useMutation({
    mutationFn: () => selfSignup.rotateCode(business.id),
    onSuccess: async () => {
      toast.show('Código nuevo: imprimí el cartel otra vez', 'success')
      await invalidate()
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Alta por QR</h2>
          <p className="text-sm text-slate-600">
            Ponés un cartel en el mostrador: el cliente lo escanea, se anota solo y recibe su
            tarjeta. Vos no cargás nada.
          </p>
        </div>
        {canManage && (
          <Button
            variant={enabled ? 'secondary' : 'primary'}
            loading={toggle.isPending}
            onClick={() => toggle.mutate()}
          >
            {enabled ? 'Apagar' : 'Activar'}
          </Button>
        )}
      </div>
      {settings.isPending && <Spinner />}
      {settings.error && <p className="text-sm text-slate-500">Todavía no está disponible.</p>}
      {settings.data && enabled && (
        <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-sm">
          <p className="break-all text-slate-600">{signupUrl(settings.data.code)}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/b/${business.slug}/fidelizacion/cartel`}
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700"
            >
              Imprimir cartel
            </Link>
            {canManage && (
              <Button variant="ghost" loading={rotate.isPending} onClick={() => rotate.mutate()}>
                Cambiar código
              </Button>
            )}
          </div>
        </div>
      )}
      <SignupNotices />
    </Card>
  )
}

/** "Avisos del alta": gente que ya era cliente y se quiso anotar otra vez. */
function SignupNotices() {
  const { business } = useActiveBusiness()
  const notices = useSignupNotices(business.id)
  if (!notices.data || notices.data.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Avisos del alta ({notices.data.length})</h3>
      <p className="text-xs text-slate-500">
        Ya eran clientes y se quisieron anotar otra vez. Reenviales la tarjeta desde su ficha.
      </p>
      <ul className="divide-y divide-slate-100">
        {notices.data.map((notice) => (
          <NoticeRow key={notice.id} notice={notice} />
        ))}
      </ul>
    </div>
  )
}

function NoticeRow({ notice }: { notice: SelfSignupNotice }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const resolve = useMutation({
    mutationFn: () => selfSignup.resolveNotice(notice.id),
    onSuccess: invalidate,
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-medium">{notice.customerName}</p>
        <p className="text-xs text-slate-500">
          Escribió “{notice.nameGiven}” · {formatDateTime(notice.createdAt, business.timezone)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          to={`/b/${business.slug}/clientes/${notice.customerId}`}
          className="rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
        >
          Reenviar tarjeta
        </Link>
        <Button variant="ghost" loading={resolve.isPending} onClick={() => resolve.mutate()}>
          Listo
        </Button>
      </div>
    </li>
  )
}
