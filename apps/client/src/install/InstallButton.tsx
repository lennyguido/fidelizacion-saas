import { useState } from 'react'
import { useInstallPrompt } from './useInstallPrompt'
import { IosInstallSheet } from './IosInstallSheet'

/**
 * "Poner en mi pantalla de inicio". En Android usa el aviso del navegador; en iPhone
 * explica los pasos de Safari. No aparece si ya está instalada o si eligieron "Ahora no".
 */
export function InstallButton({ token }: { token: string }) {
  const { platform, install, dismiss } = useInstallPrompt()
  const [sheetOpen, setSheetOpen] = useState(false)

  if (platform === 'none') return null

  const onInstall = () => {
    if (platform === 'prompt') void install()
    else setSheetOpen(true)
  }

  return (
    <section
      className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-center"
      data-testid="install-card"
    >
      <p className="text-sm text-slate-600">
        Tené tu tarjeta a un toque, como una app, sin buscar el link.
      </p>
      <button
        type="button"
        onClick={onInstall}
        className="w-full max-w-xs rounded-full bg-action px-5 py-3 text-sm font-medium text-white"
      >
        Poner en mi pantalla de inicio
      </button>
      <button type="button" onClick={dismiss} className="text-xs text-slate-500 underline">
        Ahora no
      </button>
      {sheetOpen && (
        <IosInstallSheet
          token={token}
          needsSafari={platform === 'ios-other'}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </section>
  )
}
