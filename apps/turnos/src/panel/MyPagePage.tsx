import { useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  booking,
  businesses,
  errorMessage,
  normalizePhone,
  type OpeningDay,
  type PageSettings,
  type PublicPage,
  type Service,
  type StaffMember,
} from '@plataforma/sdk'
import { Alert, Button, Card, Spinner, TextField, useToast } from '@plataforma/ui'
import { brandStyle } from '../brand'
import { DEFAULT_HEADLINE, PageHero, PageInfo, StaffAvatar } from '../PageSections'
import { shrinkImage } from '../lib/image'
import { usePanel } from './context'
import { bookingKeys, useHours, useServices, useStaff } from './queries'

const DEFAULT_COLOR = '#b0175a'
const SWATCHES = ['#b0175a', '#1e1b2e', '#0f766e', '#1d4ed8', '#b45309', '#7c3aed', '#be123c']

interface Draft {
  page: PageSettings
  color: string
  staff: Record<string, { bio: string; photoPath: string | null }>
  services: Record<string, string>
}

/** "Mi página" (D-057): el negocio arma su página de reservas y la ve al instante. */
export function MyPagePage() {
  const { business } = usePanel()
  const settings = useQuery({
    queryKey: [...bookingKeys.settings(business.id), 'page'],
    queryFn: () => booking.getPageSettings(business.id),
  })
  const staff = useStaff(business.id)
  const services = useServices(business.id)
  const hours = useHours(business.id)

  if (settings.isPending || staff.isPending || services.isPending || hours.isPending) {
    return <Spinner />
  }
  const error = settings.error ?? staff.error ?? services.error ?? hours.error
  if (error) return <Alert tone="error">{errorMessage(error)}</Alert>

  return (
    <Editor
      key={business.id}
      initial={{
        page: settings.data!,
        color: business.primaryColor ?? DEFAULT_COLOR,
        staff: Object.fromEntries(
          staff.data!.map((s) => [s.id, { bio: s.bio ?? '', photoPath: s.photoPath ?? null }]),
        ),
        services: Object.fromEntries(services.data!.map((s) => [s.id, s.description ?? ''])),
      }}
      staffList={staff.data!.filter((s) => s.active)}
      serviceList={services.data!.filter((s) => s.active)}
      openingDays={openingDays(
        hours.data!.filter((h) => staff.data!.some((s) => s.id === h.staffId && s.active)),
      )}
    />
  )
}

function openingDays(ranges: { weekday: number; startTime: string; endTime: string }[]) {
  const days: OpeningDay[] = []
  for (const r of ranges) {
    const day = days.find((d) => d.weekday === r.weekday)
    const opens = r.startTime.slice(0, 5)
    const closes = r.endTime.slice(0, 5)
    if (!day) days.push({ weekday: r.weekday, opens, closes })
    else {
      if (opens < day.opens) day.opens = opens
      if (closes > day.closes) day.closes = closes
    }
  }
  return days
}

function Editor({
  initial,
  staffList,
  serviceList,
  openingDays,
}: {
  initial: Draft
  staffList: StaffMember[]
  serviceList: Service[]
  openingDays: OpeningDay[]
}) {
  const { business } = usePanel()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(initial)
  const [saved, setSaved] = useState<Draft>(initial)
  const [logoPath, setLogoPath] = useState(business.logoPath)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const page = draft.page
  const setPage = (patch: Partial<PageSettings>) =>
    setDraft((d) => ({ ...d, page: { ...d.page, ...patch } }))
  const whatsappError =
    page.whatsapp && normalizePhone(page.whatsapp) === null ? 'Revisá el número.' : undefined
  const instagramError =
    page.instagram && booking.instagramHandle(page.instagram) === null
      ? 'Poné solo el usuario, por ejemplo barberia.sol'
      : undefined

  const preview: PublicPage = {
    name: business.name,
    logoPath,
    color: draft.color,
    timezone: business.timezone,
    message: page.message,
    maxDaysAhead: 30,
    headline: page.headline,
    about: page.about,
    coverPath: page.coverPath,
    address: page.address,
    instagram: page.instagram ? booking.instagramHandle(page.instagram) : null,
    whatsapp: page.whatsapp ? normalizePhone(page.whatsapp) : null,
    hours: page.showHours ? openingDays : [],
    services: serviceList.map((s) => ({ ...s, description: draft.services[s.id] || null })),
    staff: staffList.map((s) => ({
      id: s.id,
      name: s.name,
      bio: draft.staff[s.id]?.bio || null,
      photoPath: draft.staff[s.id]?.photoPath ?? null,
    })),
  }

  const save = useMutation({
    mutationFn: async () => {
      await booking.savePageSettings(business.id, {
        ...page,
        whatsapp: page.whatsapp ? normalizePhone(page.whatsapp) : null,
      })
      if (draft.color !== saved.color) {
        await businesses.updateBranding(business.id, {
          name: business.name,
          primaryColor: draft.color,
          timezone: business.timezone,
        })
      }
      for (const member of staffList) {
        const next = draft.staff[member.id]
        const before = saved.staff[member.id]
        if (next && JSON.stringify(next) !== JSON.stringify(before)) {
          await booking.saveStaff(business.id, {
            ...member,
            bio: next.bio,
            photoPath: next.photoPath,
          })
        }
      }
      for (const service of serviceList) {
        const next = draft.services[service.id] ?? ''
        if (next !== (saved.services[service.id] ?? '')) {
          await booking.saveService(business.id, { ...service, description: next })
        }
      }
    },
    onSuccess: async () => {
      setSaved(draft)
      await queryClient.invalidateQueries({ queryKey: bookingKeys.all(business.id) })
      await queryClient.invalidateQueries({ queryKey: ['panel', 'businesses'] })
      toast.show('Listo, tu página ya se ve así', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  async function uploadImage(file: File, kind: string, maxSide: number): Promise<string | null> {
    try {
      const image = await shrinkImage(file, maxSide)
      return await booking.uploadPageImage(business.id, kind, image)
    } catch (err) {
      toast.show(
        err instanceof Error && err.message === 'not_image'
          ? 'Elegí una foto (JPG, PNG o WebP).'
          : err instanceof Error && err.message === 'too_big'
            ? 'La foto es muy pesada. Probá con otra.'
            : errorMessage(err),
        'error',
      )
      return null
    }
  }

  const logo = useMutation({
    mutationFn: (file: File) => businesses.uploadLogo(business.id, file),
    onSuccess: async (path) => {
      setLogoPath(path)
      await queryClient.invalidateQueries({ queryKey: ['panel', 'businesses'] })
      toast.show('Logo actualizado', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  const publicUrl = booking.publicBookingUrl(business.slug)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-4 pb-28">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">Mi página</h1>
            <p className="text-sm text-slate-600">
              Así te ven tus clientes cuando sacan turno. Los cambios se ven a la derecha.
            </p>
          </div>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm underline">
            Abrir mi página
          </a>
        </div>

        <Section title="Portada" hint="Una foto del local, tu logo y tu color.">
          <ImagePicker
            label="Foto de portada"
            help="Una foto horizontal del local o de un trabajo. Se ve detrás del nombre."
            path={page.coverPath}
            shape="wide"
            onPick={async (file) => {
              const path = await uploadImage(file, 'cover', 1600)
              if (path) setPage({ coverPath: path })
            }}
            onRemove={() => setPage({ coverPath: null })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <ImagePicker
              label="Logo"
              help="Cuadrado, hasta 1 MB. Se guarda al elegirlo."
              path={logoPath}
              shape="square"
              busy={logo.isPending}
              onPick={async (file) => logo.mutate(file)}
            />
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-800">Color</span>
              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    aria-pressed={draft.color.toLowerCase() === c}
                    onClick={() => setDraft((d) => ({ ...d, color: c }))}
                    className="size-9 rounded-full ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-slate-900"
                    style={{ background: c }}
                  />
                ))}
                <label className="relative size-9 cursor-pointer overflow-hidden rounded-full ring-1 ring-slate-300">
                  <span className="sr-only">Otro color</span>
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                    className="absolute -inset-2 h-14 w-14 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Textos" hint="Lo primero que leen.">
          <TextField
            label="Frase de arriba"
            maxLength={60}
            placeholder={DEFAULT_HEADLINE}
            value={page.headline ?? ''}
            onChange={(e) => setPage({ headline: e.target.value })}
          />
          <TextField
            label="Mensaje corto (debajo del nombre)"
            maxLength={300}
            placeholder="Ej.: Te esperamos. ¡Llegá 5 minutos antes!"
            value={page.message ?? ''}
            onChange={(e) => setPage({ message: e.target.value })}
          />
          <TextArea
            label="Sobre el local"
            maxLength={600}
            placeholder="Contá quiénes son, qué los hace distintos, si hay estacionamiento…"
            value={page.about ?? ''}
            onChange={(about) => setPage({ about })}
          />
        </Section>

        <Section title="Dónde y cómo contactarte">
          <TextField
            label="Dirección"
            maxLength={120}
            placeholder="Av. Corrientes 1234, CABA"
            value={page.address ?? ''}
            onChange={(e) => setPage({ address: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Instagram"
              placeholder="barberia.sol"
              value={page.instagram ?? ''}
              error={instagramError}
              onChange={(e) => setPage({ instagram: e.target.value })}
            />
            <TextField
              label="WhatsApp"
              type="tel"
              inputMode="tel"
              placeholder="11 2345-6789"
              value={page.whatsapp ?? ''}
              error={whatsappError}
              onChange={(e) => setPage({ whatsapp: e.target.value })}
            />
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={page.showHours}
              onChange={(e) => setPage({ showHours: e.target.checked })}
            />
            Mostrar los horarios del local (salen de los horarios de cada profesional)
          </label>
        </Section>

        {staffList.length > 0 && (
          <Section title="Tu equipo" hint="Una foto y una frase ayudan a elegir con quién.">
            <ul className="flex flex-col gap-4">
              {staffList.map((member) => {
                const value = draft.staff[member.id] ?? { bio: '', photoPath: null }
                const setMember = (patch: Partial<typeof value>) =>
                  setDraft((d) => ({
                    ...d,
                    staff: { ...d.staff, [member.id]: { ...value, ...patch } },
                  }))
                return (
                  <li key={member.id} className="flex items-start gap-3">
                    <FacePicker
                      name={member.name}
                      path={value.photoPath}
                      onPick={async (file) => {
                        const path = await uploadImage(file, `staff-${member.id}`, 400)
                        if (path) setMember({ photoPath: path })
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <TextField
                        label={member.name}
                        maxLength={80}
                        placeholder="Ej.: Especialista en fade y barba"
                        value={value.bio}
                        onChange={(e) => setMember({ bio: e.target.value })}
                      />
                      {value.photoPath && (
                        <button
                          type="button"
                          className="mt-1 text-sm text-slate-500 underline"
                          onClick={() => setMember({ photoPath: null })}
                        >
                          Sacar foto
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Section>
        )}

        {serviceList.length > 0 && (
          <Section title="Servicios" hint="Qué incluye cada uno (opcional).">
            {serviceList.map((service) => (
              <TextField
                key={service.id}
                label={service.name}
                maxLength={140}
                placeholder="Ej.: Incluye lavado y peinado"
                value={draft.services[service.id] ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    services: { ...d.services, [service.id]: e.target.value },
                  }))
                }
              />
            ))}
          </Section>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-4">
          <p className="mb-2 text-center text-xs font-medium text-slate-500">Vista previa</p>
          <PhonePreview page={preview} />
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          <span className="mr-auto text-sm text-slate-500">
            {dirty ? 'Tenés cambios sin guardar' : 'Todo guardado'}
          </span>
          <MobilePreviewButton page={preview} />
          <Button
            loading={save.isPending}
            onClick={() => {
              if (whatsappError || instagramError) {
                toast.show('Revisá los campos marcados', 'error')
                return
              }
              save.mutate()
            }}
            disabled={!dirty}
          >
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {hint && <p className="text-sm text-slate-600">{hint}</p>}
        </div>
        {children}
      </div>
    </Card>
  )
}

function TextArea(props: {
  label: string
  value: string
  maxLength: number
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex justify-between font-medium text-slate-800">
        {props.label}
        <span className="font-normal text-slate-400 tabular-nums">
          {props.value.length}/{props.maxLength}
        </span>
      </span>
      <textarea
        rows={4}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
      />
    </label>
  )
}

function ImagePicker(props: {
  label: string
  help: string
  path: string | null
  shape: 'wide' | 'square'
  busy?: boolean
  onPick: (file: File) => Promise<void>
  onRemove?: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const url = businesses.logoUrl(props.path)
  const busy = loading || props.busy
  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-slate-800">{props.label}</span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-slate-400 ${
          props.shape === 'wide' ? 'aspect-[16/7] w-full' : 'size-24'
        }`}
      >
        {url ? (
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span>{busy ? 'Subiendo…' : 'Elegir foto'}</span>
        )}
        {busy && url && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            Subiendo…
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setLoading(true)
          await props.onPick(file)
          setLoading(false)
        }}
      />
      <span className="text-slate-500">{props.help}</span>
      {url && props.onRemove && (
        <button type="button" className="w-fit text-slate-500 underline" onClick={props.onRemove}>
          Sacar foto
        </button>
      )}
    </div>
  )
}

function FacePicker(props: {
  name: string
  path: string | null
  onPick: (file: File) => Promise<void>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={`Foto de ${props.name}`}
        onClick={() => input.current?.click()}
        className="book relative mt-6 shrink-0 rounded-full ring-1 ring-slate-200 hover:ring-slate-400"
      >
        <StaffAvatar name={props.name} photoPath={props.path} className="h-14 w-14 text-xl" />
        <span className="absolute -right-1 -bottom-1 rounded-full bg-white px-1.5 text-xs shadow ring-1 ring-slate-200">
          {loading ? '…' : '📷'}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setLoading(true)
          await props.onPick(file)
          setLoading(false)
        }}
      />
    </>
  )
}

/** La página como la ve el cliente, en un marco de celular. */
function PhonePreview({ page }: { page: PublicPage }) {
  return (
    <div className="mx-auto h-[720px] w-[360px] overflow-hidden rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 shadow-xl">
      <div className="h-full overflow-y-auto rounded-[1.8rem]">
        <PreviewPage page={page} />
      </div>
    </div>
  )
}

function PreviewPage({ page }: { page: PublicPage }) {
  return (
    <div className="book min-h-full pb-10 text-[15px]" style={brandStyle(page.color)}>
      <PageHero page={page} />
      <div className="flex flex-col gap-3 px-3 pt-4">
        <section className="flex flex-col gap-2 rounded-3xl bg-white p-4">
          <h2 className="display text-xl font-bold">¿Qué te querés hacer?</h2>
          {page.services.length === 0 && (
            <p className="text-sm opacity-60">Cargá tus servicios en Configuración.</p>
          )}
          {page.services.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 border-t border-[var(--line)] py-3 first:border-t-0"
            >
              <span className="min-w-0">
                <span className="block font-semibold">{s.name}</span>
                <span className="block text-xs opacity-60">{s.durationMinutes} min</span>
                {s.description && (
                  <span className="block text-xs leading-snug opacity-75">{s.description}</span>
                )}
              </span>
              <span className="flex h-8 shrink-0 items-center rounded-full bg-[var(--brand)] px-3 text-xs font-semibold text-[var(--on-brand)]">
                Elegir
              </span>
            </div>
          ))}
        </section>
        {page.staff.length > 1 && (
          <section className="flex flex-col gap-3 rounded-3xl bg-white p-4">
            <h2 className="display text-xl font-bold">¿Con quién?</h2>
            <div className="grid grid-cols-3 gap-2">
              {page.staff.map((s) => (
                <div key={s.id} className="flex flex-col items-center gap-1 text-center">
                  <StaffAvatar
                    name={s.name}
                    photoPath={s.photoPath}
                    className="h-14 w-14 text-xl"
                  />
                  <span className="text-xs font-semibold">{s.name}</span>
                  {s.bio && <span className="text-[11px] leading-snug opacity-60">{s.bio}</span>}
                </div>
              ))}
            </div>
          </section>
        )}
        <PageInfo page={page} />
      </div>
    </div>
  )
}

/** En el celular la vista previa se abre a pantalla completa. */
function MobilePreviewButton({ page }: { page: PublicPage }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" className="lg:hidden" onClick={() => setOpen(true)}>
        Ver cómo queda
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-30 flex flex-col bg-white lg:hidden"
          role="dialog"
          aria-label="Vista previa"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
            <span className="text-sm font-medium">Vista previa</span>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PreviewPage page={page} />
          </div>
        </div>
      )}
    </>
  )
}
