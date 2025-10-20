import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSymptomByName } from '@/server/effectiveSymptoms'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')
    const surgeryId = searchParams.get('surgeryId')

    if (!name) {
      return NextResponse.json(
        { error: 'Name parameter is required' },
        { status: 400 }
      )
    }

    // Get surgery ID from context if not provided
    let resolvedSurgeryId = surgeryId
    if (!resolvedSurgeryId) {
      const user = await getSessionUser()
      if (user?.defaultSurgeryId) {
        resolvedSurgeryId = user.defaultSurgeryId
      } else {
        // Try to get default surgery
        const defaultSurgery = await prisma.surgery.findFirst({
          where: { name: 'Default Surgery' },
          select: { id: true }
        })
        resolvedSurgeryId = defaultSurgery?.id || null
      }
    }

    console.log('API: Looking up symptom by name:', name, 'surgeryId:', resolvedSurgeryId)

    const symptom = await getEffectiveSymptomByName(name, resolvedSurgeryId || undefined)

    if (!symptom) {
      return NextResponse.json(
        { error: 'Symptom not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { symptom },
      { 
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=30' }
      }
    )
  } catch (error) {
    console.error('Error looking up symptom by name:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
