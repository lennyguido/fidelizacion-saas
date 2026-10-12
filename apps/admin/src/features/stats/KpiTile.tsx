import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'
import { SERIES, shortDate } from './chartTheme'

/** Número grande + variación contra el período anterior + mini gráfico de la tendencia. */
export function KpiTile({
  label,
  value,
  change,
  series,
  format,
}: {
  label: string
  value: string
  /** Variación % (null si no hay con qué comparar). */
  change: number | null
  series: Array<{ day: string; value: number | null }>
  format: (value: number) => string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-slate-500">
        {change === null ? (
          'Sin datos para comparar'
        ) : (
          <span className={change >= 0 ? 'text-green-700' : 'text-red-700'}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs. período anterior
          </span>
        )}
      </p>
      <div className="h-14">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <Tooltip
              cursor={{ stroke: '#d6d6d6' }}
              formatter={(v) => [typeof v === 'number' ? format(v) : '—', label]}
              labelFormatter={(_, payload) => {
                const day = payload?.[0]?.payload?.day
                return typeof day === 'string' ? shortDate(day) : ''
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={SERIES[0]}
              strokeWidth={2}
              fill={SERIES[0]}
              fillOpacity={0.12}
              connectNulls
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
