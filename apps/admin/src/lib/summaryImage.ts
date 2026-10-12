// Resumen del mes como imagen para compartir (D-038). Solo dibuja números que ya
// calculó Postgres (core.dashboard_summary); no calcula nada nuevo.

export interface SummaryImageData {
  businessName: string
  monthLabel: string
  lines: Array<{ label: string; value: string }>
}

/** Dibuja la imagen (1080×1080, buena para WhatsApp e Instagram) y devuelve un PNG. */
export async function renderSummaryImage(data: SummaryImageData): Promise<Blob> {
  const size = 1080
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas not supported')

  ctx.fillStyle = '#f5f5f7'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#1d1d1f'
  ctx.font = '600 64px system-ui, -apple-system, sans-serif'
  ctx.fillText(data.businessName, 80, 160, size - 160)
  ctx.fillStyle = '#707070'
  ctx.font = '40px system-ui, -apple-system, sans-serif'
  ctx.fillText(data.monthLabel, 80, 230, size - 160)

  let y = 360
  for (const line of data.lines) {
    ctx.fillStyle = '#707070'
    ctx.font = '36px system-ui, -apple-system, sans-serif'
    ctx.fillText(line.label, 80, y, size - 160)
    ctx.fillStyle = '#1d1d1f'
    ctx.font = '600 72px system-ui, -apple-system, sans-serif'
    ctx.fillText(line.value, 80, y + 80, size - 160)
    y += 170
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no image'))), 'image/png'),
  )
}

/** Comparte la imagen (celular) o la descarga (computadora). */
export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch {
      // cancelado por la persona: no pasa nada
      return
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
