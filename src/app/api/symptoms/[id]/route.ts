import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSymptomById } from '@/server/effectiveSymptoms'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const surgerySlug = searchParams.get('surgery') || undefined
    const { id } = await params

    const symptom = await getEffectiveSymptomById(id, surgerySlug)

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
