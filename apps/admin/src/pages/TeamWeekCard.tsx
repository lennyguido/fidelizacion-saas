import { useQuery } from '@tanstack/react-query'
import { smartCounter } from '@plataforma/sdk'
import { Card } from '@plataforma/ui'
import { useActiveBusiness } from '../features/business/ActiveBusinessContext'

/**
 * Ranking del equipo de esta semana (D-038): visitas registradas y clientes nuevos
 * por persona. Un empleado ve el orden y solo sus propios números.
 */
export function TeamWeekCard() {
  const { business } = useActiveBusiness()
  const team = useQuery({
    queryKey: ['customers', business.id, 'team-week'],
    queryFn: () => smartCounter.teamWeek(business.id),
  })
  if (!team.data || team.data.length < 2) return null // con una sola persona no hay ranking

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">El equipo esta semana</h2>
      <ol className="flex flex-col gap-1 text-sm">
        {team.data.map((member, index) => (
          <li
            key={member.userId}
            className={`flex justify-between gap-3 ${member.isMe ? 'font-semibold' : ''}`}
          >
            <span className="truncate">
              {index + 1}. {member.isMe ? 'Vos' : member.email}
            </span>
            {member.visits !== null && (
              <span className="shrink-0 text-slate-600">
                {member.visits} visitas · {member.newCustomers} nuevos
              </span>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}
