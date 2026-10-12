import { useEffect, useState } from 'react'
import { installPlatform, type InstallPlatform } from './installPlatform'

// Evento de Chrome/Android (no está en los tipos de TypeScript del DOM).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'plataforma.install-dismissed'

// El navegador puede avisar antes de que se dibuje la tarjeta: se escucha desde que
// se carga el archivo y se guarda el aviso para usarlo después.
let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    listeners.forEach((notify) => notify())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((notify) => notify())
  })
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function rememberDismissed(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // modo privado: se vuelve a ofrecer la próxima vez, no pasa nada
  }
}

export interface InstallPrompt {
  /** `none` si no hay nada que ofrecer (ya instalada, "Ahora no", o sin soporte). */
  platform: InstallPlatform
  /** Abre el aviso del navegador (solo `prompt`). */
  install: () => Promise<void>
  dismiss: () => void
}

export function useInstallPrompt(): InstallPrompt {
  const [, setVersion] = useState(0)
  const [hidden, setHidden] = useState(() => isStandalone() || wasDismissed())

  useEffect(() => {
    const notify = () => setVersion((v) => v + 1)
    listeners.add(notify)
    return () => {
      listeners.delete(notify)
    }
  }, [])

  const platform = hidden
    ? 'none'
    : installPlatform(navigator.userAgent, {
        maxTouchPoints: navigator.maxTouchPoints,
        hasPrompt: deferredPrompt !== null,
      })

  return {
    platform,
    install: async () => {
      const event = deferredPrompt
      if (!event) return
      await event.prompt()
      const choice = await event.userChoice
      deferredPrompt = null
      if (choice.outcome === 'accepted') setHidden(true)
      setVersion((v) => v + 1)
    },
    dismiss: () => {
      rememberDismissed()
      setHidden(true)
    },
  }
}
