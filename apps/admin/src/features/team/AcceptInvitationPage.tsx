import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { auth, errorMessage, team } from '@plataforma/sdk'
import { Alert, Button, FullPageSpinner } from '@plataforma/ui'
import { AuthLayout } from '../auth/AuthLayout'
import { useSession } from '../auth/AuthContext'
import { businessKeys } from '../business/queries'
import { roleLabels } from './roles'

/** /invitacion/:token — la persona invitada ya inició sesión (RequireAuth). */
export function AcceptInvitationPage() {
  const { token = '' } = useParams()
  const session = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => team.getInvitation(token),
    retry: false,
  })

  const accept = useMutation({
    mutationFn: () => team.acceptInvitation(token),
    onSuccess: async (business) => {
      await queryClient.invalidateQueries({ queryKey: businessKeys.mine(session.user.id) })
      navigate(`/b/${business.slug}`, { replace: true })
    },
  })

  if (invitation.isPending) return <FullPageSpinner />

  const data = invitation.data
  const myEmail = session.user.email?.toLowerCase() ?? ''

  return (
    <AuthLayout title="Invitación">
      <div className="flex flex-col gap-4">
        {invitation.error && <Alert tone="error">{errorMessage(invitation.error)}</Alert>}
        {!invitation.error && !data && (
          <Alert tone="error">El link de invitación no es válido.</Alert>
        )}
        {data && data.status !== 'pending' && (
          <Alert tone="error">
            Esta invitación ya se usó, venció o fue cancelada. Pedí una nueva.
          </Alert>
        )}
        {data && data.status === 'pending' && (
          <>
            <p className="text-slate-700">
              Te invitaron a <strong>{data.businessName}</strong> como{' '}
              <strong>{roleLabels[data.role]}</strong>.
            </p>
            {data.email !== myEmail ? (
              <Alert tone="error">
                La invitación es para <strong>{data.email}</strong> y entraste como{' '}
                <strong>{myEmail}</strong>. Salí e ingresá con el email invitado.
              </Alert>
            ) : (
              <>
                {accept.error && <Alert tone="error">{errorMessage(accept.error)}</Alert>}
                <Button
                  size="lg"
                  fullWidth
                  loading={accept.isPending}
                  onClick={() => accept.mutate()}
                >
                  Aceptar y entrar
                </Button>
              </>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => void auth.signOut()}
          className="text-center text-sm text-slate-500 underline-offset-4 hover:underline"
        >
          Salir ({myEmail})
        </button>
      </div>
    </AuthLayout>
  )
}
