/** El bucket de imágenes acepta hasta 1 MB: dejamos margen. */
const MAX_BYTES = 900 * 1024

/**
 * Achica una foto del celular (que puede pesar 5 MB) a WebP: la portada a 1600 px de
 * ancho y las caras a 400 px. Si sigue pesada, baja la calidad.
 */
export async function shrinkImage(file: File, maxSide: number): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('not_image')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // Safari viejo no sabe hacer WebP: en ese caso, JPG.
  let type = 'image/webp'
  for (const quality of [0.85, 0.72, 0.6, 0.45]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
    if (blob && blob.type !== type) type = 'image/jpeg'
    else if (blob && blob.size <= MAX_BYTES) return blob
  }
  throw new Error('too_big')
}
