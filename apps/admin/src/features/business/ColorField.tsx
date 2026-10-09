import { normalizeHexColor, textColorOn } from '@plataforma/sdk'
import { TextField } from '@plataforma/ui'

/** Selector de color + campo hexadecimal, con una vista previa de cómo se lee el texto. */
export function ColorField({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (value: string) => void
  error: string | null
}) {
  const valid = normalizeHexColor(value)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
          Color
          <input
            type="color"
            aria-label="Elegir color de marca"
            value={valid ?? '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
          />
        </label>
        <TextField
          label="Color de marca (hex)"
          className="flex-1"
          value={value}
          maxLength={7}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => onChange(e.target.value.trim())}
          error={error}
        />
      </div>
      {valid && (
        <p
          className="rounded-lg px-3 py-2 text-sm font-medium"
          style={{ backgroundColor: valid, color: textColorOn(valid) }}
        >
          Así se ve la tarjeta de tus clientes
        </p>
      )}
    </div>
  )
}
