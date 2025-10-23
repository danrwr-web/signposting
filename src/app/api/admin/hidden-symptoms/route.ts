/**
 * Admin hidden symptoms API route
 * Lists symptoms that are hidden for specific surgeries
 * Superusers can see all hidden symptoms, surgery admins can see hidden symptoms for their own surgeries
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSuperuser, requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    // Determine which surgeries the user can see hidden symptoms for
    let allowedSurgeryIds: string[] = []
    
    if (user.globalRole === 'SUPERUSER') {
      // Superusers can see all hidden symptoms
      allowedSurgeryIds = []
    } else {
      // Surgery admins can only see hidden symptoms for their own surgeries
      const adminSurgeryIds = user.memberships
        .filter(m => m.role === 'ADMIN')
        .map(m => m.surgeryId)
      
      if (adminSurgeryIds.length === 0) {
        return NextResponse.json({ error: 'No admin access' }, { status: 403 })
      }
      
      allowedSurgeryIds = adminSurgeryIds
    }

    // Get hidden symptoms
    const hiddenOverrides = await prisma.surgerySymptomOverride.findMany({
      where: {
        isHidden: true,
        ...(surgeryId ? { surgeryId } : {}),
        ...(allowedSurgeryIds.length > 0 ? { surgeryId: { in: allowedSurgeryIds } } : {})
      },
      include: {
        baseSymptom: {
          select: {
            id: true,
            slug: true,
            name: true,
            ageGroup: true,
            briefInstruction: true,
            highlightedText: true,
            instructions: true,
            linkToPage: true
          }
        },
        surgery: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: [
        { surgery: { name: 'asc' } },
        { baseSymptom: { name: 'asc' } }
      ]
    })

    // Group by surgery
    const groupedBySurgery = hiddenOverrides.reduce((acc, override) => {
      const surgeryId = override.surgeryId
      if (!acc[surgeryId]) {
        acc[surgeryId] = {
          surgery: override.surgery,
          symptoms: []
        }
      }
      acc[surgeryId].symptoms.push({
        id: override.baseSymptom.id,
        slug: override.baseSymptom.slug,
        name: override.baseSymptom.name,
        ageGroup: override.baseSymptom.ageGroup,
        briefInstruction: override.baseSymptom.briefInstruction,
        highlightedText: override.baseSymptom.highlightedText,
        instructions: override.baseSymptom.instructions,
        linkToPage: override.baseSymptom.linkToPage,
        overrideId: override.id
      })
      return acc
    }, {} as Record<string, { surgery: any, symptoms: any[] }>)

    return NextResponse.json({
      hiddenSymptoms: Object.values(groupedBySurgery)
    })
  } catch (error) {
    console.error('Error fetching hidden symptoms:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hidden symptoms' },
      { status: 500 }
    )
  }
}
