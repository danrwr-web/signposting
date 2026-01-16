import type { SessionUser } from '@/lib/rbac'

export function resolveSurgeryIdForUser(params: {
  requestedId?: string
  user: SessionUser
}): string | null {
  const { requestedId, user } = params
  if (requestedId) {
    const hasAccess =
      user.globalRole === 'SUPERUSER' ||
      user.memberships.some((membership) => membership.surgeryId === requestedId)
    return hasAccess ? requestedId : null
  }

  if (user.defaultSurgeryId) {
    return user.defaultSurgeryId
  }

  return user.memberships[0]?.surgeryId ?? null
}

export function isDailyDoseAdmin(user: SessionUser, surgeryId: string): boolean {
  if (user.globalRole === 'SUPERUSER') return true
  return user.memberships.some((membership) => membership.surgeryId === surgeryId && membership.role === 'ADMIN')
}
