// BarcodeDetector todavía no está en los tipos de TypeScript.
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>
}
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike

export function getDetectorClass(): BarcodeDetectorConstructor | null {
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
