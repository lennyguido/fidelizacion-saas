import { useEffect, useRef, useState } from 'react'
import { Alert, Button } from '@plataforma/ui'
import { createQrReader } from './qrSupport'

/**
 * Abre la cámara de atrás y lee un QR (por ejemplo, el de la tarjeta del cliente).
 * Funciona en cualquier celular con cámara, siempre que la página esté en https.
 */
export function QrScanner({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false

    async function start() {
      try {
        const obtained = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        const video = videoRef.current
        if (!video || stopped) {
          // Se cerró la cámara mientras el navegador pedía permiso: apagarla igual.
          obtained.getTracks().forEach((track) => track.stop())
          return
        }
        stream = obtained
        video.srcObject = stream
        await video.play()
        const read = await createQrReader()
        if (stopped) return
        timer = window.setInterval(async () => {
          try {
            const value = await read(video)
            if (value && !stopped) {
              stopped = true
              onResult(value)
            }
          } catch {
            // un cuadro que no se pudo leer: se sigue intentando
          }
        }, 300)
      } catch {
        setError('No se pudo abrir la cámara. Revisá el permiso del navegador o escribí el código.')
      }
    }
    void start()

    return () => {
      stopped = true
      if (timer) window.clearInterval(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onResult])

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : (
        <video
          ref={videoRef}
          className="aspect-square w-full rounded-lg bg-black object-cover"
          muted
          playsInline
        />
      )}
      <Button variant="secondary" onClick={onClose}>
        Cerrar cámara
      </Button>
    </div>
  )
}
