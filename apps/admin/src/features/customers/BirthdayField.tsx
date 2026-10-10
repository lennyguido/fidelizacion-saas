import { useId } from 'react'
import { MONTH_NAMES } from '@plataforma/sdk'

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1)
const SELECT_CLASS =
  'h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 shadow-sm'

/** Cumpleaños sin año: día y mes. Vacíos los dos = no se sabe. */
export function BirthdayField({
  day,
  month,
  error,
  onChange,
}: {
  day: string
  month: string
  error: string | null
  onChange: (day: string, month: string) => void
}) {
  const id = useId()

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-slate-800">Cumpleaños (opcional)</legend>
      <div className="flex gap-2">
        <label htmlFor={`${id}-day`} className="sr-only">
          Día del cumpleaños
        </label>
        <select
          id={`${id}-day`}
          value={day}
          onChange={(e) => onChange(e.target.value, month)}
          className={SELECT_CLASS}
        >
          <option value="">Día</option>
          {DAYS.map((d) => (
            <option key={d} value={String(d)}>
              {d}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-month`} className="sr-only">
          Mes del cumpleaños
        </label>
        <select
          id={`${id}-month`}
          value={month}
          onChange={(e) => onChange(day, e.target.value)}
          className={`${SELECT_CLASS} flex-1`}
        >
          <option value="">Mes</option>
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={String(index + 1)}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <p className="text-sm text-slate-500">Sin año. Sirve para el saludo automático.</p>
      )}
    </fieldset>
  )
}
