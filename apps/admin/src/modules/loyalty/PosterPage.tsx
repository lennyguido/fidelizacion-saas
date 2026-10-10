import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import QRCode from 'qrcode'
import { businesses, isValidHexColor } from '@plataforma/sdk'
import { Alert, Button, Card, FullPageSpinner } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useProgram, useSelfSignupSettings, useTemplates } from './queries'
import { signupUrl } from './signupUrl'

type PaperSize = 'A4' | 'A5'

/** Cartel imprimible del alta por QR (D-032): logo, colores, titular y QR. */
export function PosterPage() {
  const { business } = useActiveBusiness()
  const settings = useSelfSignupSettings(business.id)
  const program = useProgram(business.id)
  const templates = useTemplates()
  const [size, setSize] = useState<PaperSize>('A4')
  const [qr, setQr] = useState<string | null>(null)
  const url = settings.data ? signupUrl(settings.data.code) : null

  useEffect(() => {
    if (!url) return
    let active = true
    void QRCode.toDataURL(url, { margin: 1, width: 600 }).then((data) => {
      if (active) setQr(data)
    })
    return () => {
      active = false
    }
  }, [url])

  if (settings.isPending) return <FullPageSpinner />
  if (!settings.data?.enabled || !url) {
    return (
      <Alert tone="error">
        Primero activá el alta por QR en{' '}
        <Link to={`/b/${business.slug}/fidelizacion`} className="underline">
          Fidelización
        </Link>
        .
      </Alert>
    )
  }

  const template = templates.data?.find((t) => t.kind === program.data?.template)
  const headline = template?.headline ?? 'Sumate al club y juntá puntos en cada visita'
  const color =
    business.primaryColor && isValidHexColor(business.primaryColor)
      ? business.primaryColor
      : '#0f172a'
  const logo = businesses.logoUrl(business.logoPath)

  return (
    <section className="flex flex-col gap-4">
      <style>{printCss(size)}</style>
      <Card className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link to={`/b/${business.slug}/fidelizacion`} className="text-sm text-slate-500">
          ← Fidelización
        </Link>
        <div className="flex gap-2">
          {(['A4', 'A5'] as const).map((option) => (
            <Button
              key={option}
              variant={size === option ? 'primary' : 'secondary'}
              onClick={() => setSize(option)}
            >
              {option}
            </Button>
          ))}
          <Button onClick={() => window.print()}>Imprimir / Guardar PDF</Button>
        </div>
      </Card>
      <div
        className="poster mx-auto flex w-full max-w-xl flex-col items-center gap-6 rounded-2xl bg-white p-10 text-center"
        style={{ borderTop: `16px solid ${color}` }}
      >
        {logo && <img src={logo} alt="" className="h-20 w-auto object-contain" />}
        <p className="text-lg font-semibold" style={{ color }}>
          {business.name}
        </p>
        <h1 className="text-3xl font-bold leading-tight text-slate-900">{headline}</h1>
        {qr && <img src={qr} alt="Código QR para anotarse" className="h-64 w-64" />}
        <p className="text-lg text-slate-700">
          Escaneá el código con la cámara del celular y anotate en un minuto.
        </p>
        <p className="text-xs text-slate-400">Tus datos solo los usa este negocio.</p>
      </div>
    </section>
  )
}

/** Al imprimir se ve solo el cartel, del tamaño de hoja elegido. */
function printCss(size: PaperSize): string {
  return `@media print {
  @page { size: ${size}; margin: 12mm; }
  body * { visibility: hidden; }
  .poster, .poster * { visibility: visible; }
  .poster { position: absolute; inset: 0; max-width: none; border-radius: 0; }
  .no-print { display: none; }
}`
}
