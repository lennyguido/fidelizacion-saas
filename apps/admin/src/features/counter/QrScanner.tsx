import { useEffect, useRef, useState } from 'react'
import { Alert, Button } from '@plataforma/ui'

// BarcodeDetector todavía no está en los tipos de TypeScript.
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>
}
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike

function getDetectorClass(): BarcodeDetectorConstructor | null {
  const candidate = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector
  return candidate ?? null
}

export function canScanQr(): boolean {
  return (
    typeof window !== 'undefined' &&
    getDetectorClass() !== null &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  )
}

/**
 * Abre la cámara de atrás y lee un QR (por ejemplo, el de la tarjeta del cliente).
 * Funciona en Chrome para Android; donde no está disponible, se escribe el código.
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
    const Detector = getDetectorClass()
    if (!Detector) return
    const detector = new Detector({ formats: ['qr_code'] })
    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        const video = videoRef.current
        if (!video || stopped) return
        video.srcObject = stream
        await video.play()
        timer = window.setInterval(async () => {
          try {
            const codes = await detector.detect(video)
            const value = codes[0]?.rawValue?.trim()
            if (value) {
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
