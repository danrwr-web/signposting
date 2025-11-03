import 'server-only'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface SessionUser {
  id: string
  email: string
  name?: string
  globalRole: string
  defaultSurgeryId?: string
  // For PRACTICE_ADMIN users, expose their primary surgery for admin actions
  surgeryId?: string
  isTestUser: boolean
  symptomUsageLimit?: number | null
  symptomsUsed: number
  memberships: Array<{
    surgeryId: string
    role: string
  }>
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return null
    }

    // Get fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        memberships: {
          include: {
            surgery: {
              select: {
                id: true,
                name: true,
                slug: true,
              }
            }
          }
        },
        defaultSurgery: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        }
      }
    })

    if (!user) {
      return null
    }

    // Derive admin surgeryId for PRACTICE_ADMINs
    const isPracticeAdmin = user.globalRole === 'PRACTICE_ADMIN'
    const adminMembership = user.memberships.find(m => m.role === 'ADMIN')
    const derivedSurgeryId = isPracticeAdmin
      ? (adminMembership?.surgeryId || user.defaultSurgeryId || undefined)
      : undefined

    return {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      globalRole: user.globalRole,
      defaultSurgeryId: user.defaultSurgeryId || undefined,
      surgeryId: derivedSurgeryId,
      isTestUser: user.isTestUser,
      symptomUsageLimit: user.symptomUsageLimit,
      symptomsUsed: user.symptomsUsed,
      memberships: user.memberships.map(m => ({
        surgeryId: m.surgeryId,
        role: m.role
      }))
    }
  } catch (error) {
    console.error('Error getting session user:', error)
    return null
  }
}

export class PermissionChecker {
  constructor(private user: SessionUser) {}

  manageGlobal(): boolean {
    return this.user.globalRole === 'SUPERUSER'
  }

  manageSurgery(surgeryId: string): boolean {
    if (this.user.globalRole === 'SUPERUSER') {
      return true
    }

    const membership = this.user.memberships.find(m => m.surgeryId === surgeryId)
    return membership?.role === 'ADMIN'
  }

  viewSurgery(surgeryId: string): boolean {
    if (this.user.globalRole === 'SUPERUSER') {
      return true
    }

    return this.user.memberships.some(m => m.surgeryId === surgeryId)
  }

  isSuperuser(): boolean {
    return this.user.globalRole === 'SUPERUSER'
  }

  isAdminOfSurgery(surgeryId: string): boolean {
    if (this.user.globalRole === 'SUPERUSER') {
      return true
    }

    const membership = this.user.memberships.find(m => m.surgeryId === surgeryId)
    return membership?.role === 'ADMIN'
  }

  getSurgeryRole(surgeryId: string): string | null {
    if (this.user.globalRole === 'SUPERUSER') {
      return 'SUPERUSER'
    }

    const membership = this.user.memberships.find(m => m.surgeryId === surgeryId)
    return membership?.role || null
  }

  getSurgeryIds(): string[] {
    return this.user.memberships.map(m => m.surgeryId)
  }

  getAdminSurgeryIds(): string[] {
    return this.user.memberships
      .filter(m => m.role === 'ADMIN')
      .map(m => m.surgeryId)
  }
}

export function can(user: SessionUser): PermissionChecker {
  return new PermissionChecker(user)
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser()
  
  if (!user) {
    throw new Error('Authentication required')
  }
  
  return user
}

export async function requireSuperuser(): Promise<SessionUser> {
  const user = await requireAuth()
  
  if (!can(user).isSuperuser()) {
    throw new Error('Superuser access required')
  }
  
  return user
}

export async function requireSurgeryAdmin(surgeryId: string): Promise<SessionUser> {
  const user = await requireAuth()
  
  if (!can(user).manageSurgery(surgeryId)) {
    throw new Error('Surgery admin access required')
  }
  
  return user
}

export async function requireSurgeryAccess(surgeryId: string): Promise<SessionUser> {
  const user = await requireAuth()
  
  if (!can(user).viewSurgery(surgeryId)) {
    throw new Error('Surgery access required')
  }
  
  return user
}
