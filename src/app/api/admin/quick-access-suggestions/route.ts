/**
 * Quick access suggestions API route
 * Returns the surgery's most-viewed symptoms (last 30 days) as candidate
 * quick access buttons. Surgery admin / superuser only, matching the auth
 * of the sibling surgery-settings route.
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { getTopViewedQuickAccessItems } from '@/server/quickAccessSuggestions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/quick-access-suggestions?surgeryId=...
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    let targetSurgeryId: string | null = null

    if (user.globalRole === 'SUPERUSER') {
      const url = new URL(request.url)
      const surgeryParam = url.searchParams.get('surgeryId')
      if (surgeryParam) {
        targetSurgeryId = surgeryParam
      } else {
        const firstSurgery = await prisma.surgery.findFirst()
        targetSurgeryId = firstSurgery?.id || null
      }
    } else {
      const adminMembership = user.memberships.find(m => m.role === 'ADMIN')
      targetSurgeryId = adminMembership?.surgeryId || null
    }

    if (!targetSurgeryId) {
      return NextResponse.json(
        { error: 'Unauthorized - surgery admin access required' },
        { status: 401 }
      )
    }

    const suggestions = await getTopViewedQuickAccessItems(targetSurgeryId)

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error fetching quick access suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quick access suggestions' },
      { status: 500 }
    )
  }
}
