import 'server-only'
import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/lib/rbac'

export interface ViewerSurgery {
  id: string
  slug: string | null
  name: string
  surgeryType?: 'LIVE' | 'TEST' | 'GLOBAL_DEFAULT'
}

/**
 * The surgeries a viewer is entitled to see in the surgery switcher.
 *
 * This list is passed to SurgeryProvider as a *client* prop, so every entry is
 * serialised into the HTML of every page — including error pages — and is
 * readable by anyone who views source. Fetching the whole table therefore
 * published the practice list, their internal ids and their LIVE/TEST status to
 * unauthenticated visitors. The ids are the same ones that appear in /s/[id]
 * routes, so it also handed out an accurate target list.
 *
 * Nothing is lost by scoping it. Every branch of SurgeryProvider's resolution is
 * already gated on `isSuperuser || memberships.some(...)`, so an entry the viewer
 * has no membership for could never have been selected anyway.
 */
export async function surgeriesForViewer(user: SessionUser | null): Promise<ViewerSurgery[]> {
  // Signed out: nothing to switch between, so nothing to publish.
  if (!user) return []

  if (user.globalRole === 'SUPERUSER') {
    return prisma.surgery.findMany({
      select: { id: true, slug: true, name: true, surgeryType: true },
      orderBy: { name: 'asc' },
    })
  }

  // Memberships only. defaultSurgeryId is deliberately NOT included: it can
  // outlive the membership it was set from (removing a membership does not
  // clear it, and setting a default only checks the surgery exists), and both
  // PermissionChecker.viewSurgery and SurgeryProvider's default branch require
  // a real membership. So a default without one can never be viewed or
  // selected — including it here would disclose a surgery for no benefit.
  const ids = Array.from(new Set(user.memberships.map(m => m.surgeryId)))

  if (ids.length === 0) return []

  return prisma.surgery.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, name: true, surgeryType: true },
    orderBy: { name: 'asc' },
  })
}
