import { toBusiness } from './businesses.ts'
import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'
import type { Business, MemberRole } from './types.ts'

export interface TeamMember {
  membershipId: string
  userId: string
  email: string
  role: MemberRole
  status: 'active' | 'disabled'
  createdAt: string
}

export interface PendingInvitation {
  id: string
  email: string
  role: 'admin' | 'staff'
  createdAt: string
  expiresAt: string
}

export interface CreatedInvitation {
  invitationId: string
  token: string
  expiresAt: string
}

export interface InvitationPreview {
  businessName: string
  role: 'admin' | 'staff'
  email: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
}

export async function listMembers(businessId: string): Promise<TeamMember[]> {
  const { data, error } = await getSupabase().rpc('list_members', { p_business_id: businessId })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    membershipId: row.membership_id,
    userId: row.user_id,
    email: row.email,
    role: row.role as MemberRole,
    status: row.status as TeamMember['status'],
    createdAt: row.created_at,
  }))
}

export async function listPendingInvitations(businessId: string): Promise<PendingInvitation[]> {
  const { data, error } = await getSupabase()
    .from('invitations')
    .select('id, email, role, created_at, expires_at')
    .eq('business_id', businessId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role as PendingInvitation['role'],
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }))
}

/** Crea la invitación. El código se devuelve una sola vez: hay que compartir el link en el momento. */
export async function createInvitation(
  businessId: string,
  email: string,
  role: 'admin' | 'staff',
): Promise<CreatedInvitation> {
  const { data, error } = await getSupabase().rpc('create_invitation', {
    p_business_id: businessId,
    p_email: email,
    p_role: role,
  })
  if (error) throw fromPostgrestError(error)
  const row = data?.[0]
  if (!row) throw fromPostgrestError({ message: 'invitation was not created' })
  return { invitationId: row.invitation_id, token: row.token, expiresAt: row.expires_at }
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await getSupabase().rpc('revoke_invitation', { p_invitation_id: invitationId })
  if (error) throw fromPostgrestError(error)
}

export async function getInvitation(token: string): Promise<InvitationPreview | null> {
  const { data, error } = await getSupabase().rpc('get_invitation', { p_token: token })
  if (error) throw fromPostgrestError(error)
  const row = data?.[0]
  if (!row) return null
  return {
    businessName: row.business_name,
    role: row.role as InvitationPreview['role'],
    email: row.email,
    status: row.status as InvitationPreview['status'],
  }
}

export async function acceptInvitation(token: string): Promise<Business> {
  const { data, error } = await getSupabase().rpc('accept_invitation', { p_token: token })
  if (error) throw fromPostgrestError(error)
  return toBusiness(data)
}

export async function updateMember(
  membershipId: string,
  role: MemberRole,
  status: TeamMember['status'],
): Promise<void> {
  const { error } = await getSupabase().rpc('update_member', {
    p_membership_id: membershipId,
    p_role: role,
    p_status: status,
  })
  if (error) throw fromPostgrestError(error)
}

/** Link que se comparte con la persona invitada. */
export function invitationLink(origin: string, token: string): string {
  return `${origin}/invitacion/${token}`
}
