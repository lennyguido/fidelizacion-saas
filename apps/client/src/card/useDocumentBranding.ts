import { useEffect } from 'react'

const DEFAULT_TITLE = 'Mi tarjeta'
const DEFAULT_THEME = '#0f172a'

function themeMeta(): HTMLMetaElement {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  return meta
}

/** Título de la pestaña y color de la barra del teléfono con la marca del negocio. */
export function useDocumentBranding(businessName: string, color: string): void {
  useEffect(() => {
    document.title = `${businessName} · Mi tarjeta`
    const meta = themeMeta()
    meta.content = color
    return () => {
      document.title = DEFAULT_TITLE
      meta.content = DEFAULT_THEME
    }
  }, [businessName, color])
}
