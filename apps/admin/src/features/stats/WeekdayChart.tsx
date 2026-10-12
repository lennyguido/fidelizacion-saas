import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { WEEKDAY_LABELS } from '@plataforma/sdk'
import { AXIS_STYLE, GRID, SERIES } from './chartTheme'

/** Qué días viene más gente. */
export function WeekdayChart({ data }: { data: Array<{ weekday: number; visits: number }> }) {
  const rows = data.map((d) => ({ day: WEEKDAY_LABELS[d.weekday - 1], visits: d.visits }))
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="day" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#f5f5f7' }} formatter={(value) => [value, 'Visitas']} />
          <Bar
            dataKey="visits"
            fill={SERIES[0]}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
