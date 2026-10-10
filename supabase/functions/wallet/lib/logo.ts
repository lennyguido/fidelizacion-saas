// Baja el logo PNG del negocio (bucket público `logos`, D-024) con límite de tiempo y tamaño.
import { isPng, publicLogoUrl } from './text.ts'

export const MAX_LOGO_BYTES = 1024 * 1024

export async function fetchLogoPng(
  fetchFn: typeof fetch,
  supabaseUrl: string,
  logoPath: string | null,
  log: (message: string) => void,
): Promise<Uint8Array | null> {
  const url = isPng(logoPath) ? publicLogoUrl(supabaseUrl, logoPath) : null
  if (!url) return null
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      await res.body?.cancel()
      return null
    }
    const bytes = new Uint8Array(await res.arrayBuffer())
    return bytes.length > 0 && bytes.length <= MAX_LOGO_BYTES ? bytes : null
  } catch (error) {
    log(`logo fetch failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}
