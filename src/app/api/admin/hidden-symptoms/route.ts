/**
 * Admin hidden symptoms API route
 * Lists symptoms that are hidden for specific surgeries (superuser only)
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuserAuth } from '@/server/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await requireSuperuserAuth()
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    // Get all hidden symptoms
    const hiddenOverrides = await prisma.surgerySymptomOverride.findMany({
      where: {
        isHidden: true,
        ...(surgeryId ? { surgeryId } : {})
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
