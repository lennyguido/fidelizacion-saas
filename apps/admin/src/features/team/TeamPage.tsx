import { useMutation } from '@tanstack/react-query'
import { errorMessage, team, type MemberRole, type TeamMember } from '@plataforma/sdk'
import { Alert, Button, Card, EmptyState, Spinner, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../business/ActiveBusinessContext'
import { useSession } from '../auth/AuthContext'
import { formatDateTime } from '../../lib/format'
import { InviteForm } from './InviteForm'
import { useInvalidateTeam, usePendingInvitations, useTeamMembers } from './queries'
import { roleLabels } from './roles'

export function TeamPage() {
  const { business } = useActiveBusiness()

  if (business.role === 'staff') {
    return <EmptyState title="Solo el dueño o un administrador puede ver el equipo" />
  }

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Equipo</h1>
      <InviteForm />
      <PendingInvitations />
      <Members />
    </section>
  )
}

function PendingInvitations() {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateTeam(business.id)
  const invitations = usePendingInvitations(business.id)
  const revoke = useMutation({
    mutationFn: (id: string) => team.revokeInvitation(id),
    onSuccess: async () => {
      await invalidate()
      toast.show('Invitación cancelada', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  if (!invitations.data || invitations.data.length === 0) return null

  return (
    <Card>
      <h2 className="mb-2 text-base font-semibold">Invitaciones pendientes</h2>
      <ul className="divide-y divide-slate-100">
        {invitations.data.map((invitation) => (
          <li key={invitation.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{invitation.email}</p>
              <p className="text-xs text-slate-500">
                {roleLabels[invitation.role]} · vence{' '}
                {formatDateTime(invitation.expiresAt, business.timezone)}
              </p>
            </div>
            <Button
              variant="ghost"
              loading={revoke.isPending}
              onClick={() => revoke.mutate(invitation.id)}
            >
              Cancelar
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Members() {
  const { business } = useActiveBusiness()
  const members = useTeamMembers(business.id)

  return (
    <Card>
      <h2 className="mb-2 text-base font-semibold">Miembros</h2>
      {members.isPending && <Spinner />}
      {members.error && <Alert tone="error">{errorMessage(members.error)}</Alert>}
      <ul className="divide-y divide-slate-100">
        {members.data?.map((member) => (
          <MemberRow key={member.membershipId} member={member} />
        ))}
      </ul>
    </Card>
  )
}

function MemberRow({ member }: { member: TeamMember }) {
  const { business } = useActiveBusiness()
  const session = useSession()
  const toast = useToast()
  const invalidate = useInvalidateTeam(business.id)
  const isMe = member.userId === session.user.id
  const canManage = business.role === 'owner' && !isMe && member.role !== 'owner'

  const update = useMutation({
    mutationFn: (next: { role: MemberRole; status: TeamMember['status'] }) =>
      team.updateMember(member.membershipId, next.role, next.status),
    onSuccess: async () => {
      await invalidate()
      toast.show('Cambios guardados', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {member.email} {isMe && <span className="text-slate-400">(vos)</span>}
        </p>
        <p className="text-xs text-slate-500">
          {roleLabels[member.role]}
          {member.status === 'disabled' && ' · desactivado'}
        </p>
      </div>
      {canManage && (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={update.isPending}
            onClick={() =>
              update.mutate({
                role: member.role === 'admin' ? 'staff' : 'admin',
                status: member.status,
              })
            }
          >
            {member.role === 'admin' ? 'Pasar a empleado' : 'Hacer administrador'}
          </Button>
          <Button
            variant="ghost"
            disabled={update.isPending}
            onClick={() =>
              update.mutate({
                role: member.role,
                status: member.status === 'active' ? 'disabled' : 'active',
              })
            }
          >
            {member.status === 'active' ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      )}
    </li>
  )
}
