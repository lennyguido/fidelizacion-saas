// Lector de QR para el mostrador. Usa BarcodeDetector cuando el navegador lo trae
// (Chrome en Android); si no (iPhone, Chrome en Windows, Firefox), lee el cuadro de
// la cámara con jsQR, que se descarga solo cuando hace falta.

// BarcodeDetector todavía no está en los tipos de TypeScript.
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>
}
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike

/** Lee un cuadro del video y devuelve el texto del QR, o null si no hay uno. */
export type QrReader = (video: HTMLVideoElement) => Promise<string | null>

function nativeDetectorClass(): BarcodeDetectorConstructor | null {
  const candidate = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector
  return candidate ?? null
}

export async function createQrReader(): Promise<QrReader> {
  const Native = nativeDetectorClass()
  if (Native) {
    const detector = new Native({ formats: ['qr_code'] })
    return async (video) => (await detector.detect(video))[0]?.rawValue?.trim() || null
  }
  const { default: jsQR } = await import('jsqr')
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  return async (video) => {
    if (!context || video.videoWidth === 0) return null
    // Un cuadro más chico alcanza para leer el QR y es más rápido en celulares.
    const scale = Math.min(1, 640 / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const image = context.getImageData(0, 0, canvas.width, canvas.height)
    return jsQR(image.data, image.width, image.height)?.data.trim() || null
  }
}

/** La cámara solo se puede usar en https (o localhost) y con permiso del navegador. */
export function canScanQr(): boolean {
  return typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}
