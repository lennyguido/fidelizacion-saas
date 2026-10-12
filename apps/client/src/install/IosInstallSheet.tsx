function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-text-bottom" fill="none" aria-hidden>
      <path d="M12 3v12M8 7l4-4 4 4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 10H5v11h14V10h-2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-text-bottom" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

/** Hoja con los pasos de Safari para poner la tarjeta en la pantalla de inicio. */
export function IosInstallSheet({
  needsSafari,
  onClose,
}: {
  needsSafari: boolean
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-sheet-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-10 text-left"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="install-sheet-title" className="mb-4 text-lg font-semibold">
          {needsSafari ? 'Abrí la tarjeta en Safari' : 'Ponela en tu pantalla de inicio'}
        </h2>
        {needsSafari ? (
          <p className="text-sm text-slate-700">
            En iPhone solo se puede desde Safari. Abrí el mismo link que te mandó el negocio en
            Safari y tocá otra vez “Poner en mi pantalla de inicio”.
          </p>
        ) : (
          <ol className="flex flex-col gap-4 text-sm text-slate-700">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                1
              </span>
              <span>
                Tocá <ShareIcon /> <strong>Compartir</strong> (abajo en el medio, o arriba en iPad).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                2
              </span>
              <span>
                Bajá y tocá <AddIcon /> <strong>Agregar a inicio</strong>. Listo: vas a ver el ícono
                con tus apps.
              </span>
            </li>
          </ol>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-slate-100 px-5 py-3 text-sm font-medium text-slate-900"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
