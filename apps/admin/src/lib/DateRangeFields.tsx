import { TextField } from '@plataforma/ui'

export interface DateRange {
  from: string
  to: string
}

/** Dos fechas "Desde" / "Hasta" (AAAA-MM-DD). La base valida que el rango sea correcto. */
export function DateRangeFields({
  value,
  onChange,
}: {
  value: DateRange
  onChange: (value: DateRange) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <TextField
        label="Desde"
        type="date"
        value={value.from}
        max={value.to}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
      />
      <TextField
        label="Hasta"
        type="date"
        value={value.to}
        min={value.from}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
      />
    </div>
  )
}
