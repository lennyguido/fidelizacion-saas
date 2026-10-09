import { useId } from 'react'
import { COMMON_TIMEZONES } from '@plataforma/sdk'

/** Zona horaria del negocio: define qué cuenta como "hoy" en las estadísticas. */
export function TimezoneSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  const known = COMMON_TIMEZONES.some((tz) => tz.id === value)
  const options = known ? COMMON_TIMEZONES : [{ id: value, label: value }, ...COMMON_TIMEZONES]

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        Zona horaria
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 shadow-sm"
      >
        {options.map((tz) => (
          <option key={tz.id} value={tz.id}>
            {tz.label}
          </option>
        ))}
      </select>
      <p className="text-sm text-slate-500">Se usa para saber qué visitas son de “hoy”.</p>
    </div>
  )
}
