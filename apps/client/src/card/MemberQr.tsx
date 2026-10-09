import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** QR con el código de socio, para que el cajero lo escanee. */
export function MemberQr({ code }: { code: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(code, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <div className="flex flex-col items-center gap-2">
      {src ? (
        <img src={src} alt={`Código QR de socio ${code}`} className="h-48 w-48" />
      ) : (
        <div className="h-48 w-48 rounded-lg bg-slate-100" aria-hidden />
      )}
      <p className="font-mono text-lg tracking-[0.3em]" data-testid="member-code">
        {code}
      </p>
      <p className="text-xs text-slate-500">Mostralo en la caja para sumar puntos o canjear.</p>
    </div>
  )
}
