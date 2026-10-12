import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { SERIES } from './chartTheme'

/** Clientes nuevos contra los que ya venían (de los que vinieron en el período). */
export function NewReturningChart({ data }: { data: { new: number; returning: number } }) {
  const total = data.new + data.returning
  const slices = [
    { name: 'Nuevos', value: data.new, color: SERIES[0] },
    { name: 'Volvieron', value: data.returning, color: SERIES[1] },
  ]
  if (total === 0) {
    return <p className="text-sm text-slate-500">Todavía no hay clientes identificados.</p>
  }
  return (
    <div className="flex items-center gap-6">
      <div className="h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip formatter={(value, name) => [`${value} clientes`, name]} />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              stroke="#ffffff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <dl className="flex flex-col gap-3 text-sm">
        {slices.map((slice) => (
          <div key={slice.name}>
            <dt className="flex items-center gap-1.5 text-slate-500">
              <span
                className="inline-block size-2.5 rounded-sm"
                style={{ backgroundColor: slice.color }}
              />
              {slice.name}
            </dt>
            <dd className="text-xl font-semibold">
              {slice.value}{' '}
              <span className="text-sm font-normal text-slate-500">
                ({Math.round((slice.value / total) * 100)}%)
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
