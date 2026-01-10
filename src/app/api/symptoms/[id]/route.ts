import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSymptomById } from '@/server/effectiveSymptoms'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryParam = searchParams.get('surgery') || undefined
    const { id } = await params

    // Accept both canonical surgery id (matches `/s/[id]`) and legacy slug.
    let surgeryId: string | undefined
    if (surgeryParam) {
      const byId = await prisma.surgery.findUnique({ where: { id: surgeryParam }, select: { id: true } })
      if (byId) surgeryId = byId.id
      else {
        const bySlug = await prisma.surgery.findUnique({ where: { slug: surgeryParam }, select: { id: true } })
        surgeryId = bySlug?.id
      }
    }

    const symptom = await getEffectiveSymptomById(id, surgeryId)

    if (!symptom) {
      return NextResponse.json(
        { error: 'Symptom not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(symptom)
  } catch (error) {
    console.error('Error fetching symptom:', error)
    return NextResponse.json(
      { error: 'Failed to fetch symptom' },
      { status: 500 }
    )
  }
}
