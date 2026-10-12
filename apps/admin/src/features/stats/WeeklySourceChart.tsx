import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SOURCE_GROUP_LABELS, SOURCE_GROUPS, type SourceGroup, type WeekRow } from '@plataforma/sdk'
import { AXIS_STYLE, GRID, SOURCE_COLORS, shortDate } from './chartTheme'

/** Visitas por semana, apiladas según de dónde vinieron. */
export function WeeklySourceChart({ rows }: { rows: WeekRow[] }) {
  const totals = SOURCE_GROUPS.map((group) => ({
    group,
    visits: rows.reduce((sum, row) => sum + row[group], 0),
  })).filter((t) => t.visits > 0)
  const shown = totals.map((t) => t.group)

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Todavía no hay visitas en este período.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Leyenda">
        {totals.map(({ group, visits }) => (
          <li key={group} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ backgroundColor: SOURCE_COLORS[group] }}
            />
            {SOURCE_GROUP_LABELS[group]} <span className="text-slate-500">{visits}</span>
          </li>
        ))}
      </ul>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="week"
              tickFormatter={shortDate}
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
            />
            <YAxis allowDecimals={false} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: '#f5f5f7' }}
              labelFormatter={(week) => `Semana del ${shortDate(String(week))}`}
              formatter={(value, name) => [value, SOURCE_GROUP_LABELS[name as SourceGroup]]}
            />
            {shown.map((group, index) => (
              <Bar
                key={group}
                dataKey={group}
                stackId="visits"
                fill={SOURCE_COLORS[group]}
                stroke="#ffffff"
                strokeWidth={1}
                radius={index === shown.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={36}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
