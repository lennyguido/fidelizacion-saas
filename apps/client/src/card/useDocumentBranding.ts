import { useEffect } from 'react'

const DEFAULT_TITLE = 'Mi tarjeta'
const DEFAULT_THEME = '#0f172a'
const DEFAULT_ICON = '/favicon.svg'

function headElement<T extends HTMLElement>(selector: string, create: () => T): T {
  let element = document.querySelector<T>(selector)
  if (!element) {
    element = create()
    document.head.appendChild(element)
  }
  return element
}

function themeMeta(): HTMLMetaElement {
  return headElement('meta[name="theme-color"]', () => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    return meta
  })
}

function iconLink(): HTMLLinkElement {
  return headElement('link[rel="icon"]', () => {
    const link = document.createElement('link')
    link.rel = 'icon'
    return link
  })
}

/**
 * Marca del negocio en el navegador: título de la pestaña, color de la barra del
 * teléfono y, si tiene logo, el ícono de la pestaña.
 */
export function useDocumentBranding(
  businessName: string,
  color: string,
  logoUrl: string | null,
): void {
  useEffect(() => {
    document.title = `${businessName} · Mi tarjeta`
    const meta = themeMeta()
    meta.content = color
    const icon = iconLink()
    if (logoUrl) {
      icon.removeAttribute('type')
      icon.href = logoUrl
    }
    return () => {
      document.title = DEFAULT_TITLE
      meta.content = DEFAULT_THEME
      icon.type = 'image/svg+xml'
      icon.href = DEFAULT_ICON
    }
  }, [businessName, color, logoUrl])
}
