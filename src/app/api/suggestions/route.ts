import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { surgeryId, baseId, symptom, userEmail, text } = body

    // Validate required fields
    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Suggestion text is required' },
        { status: 400 }
      )
    }

    const suggestion = await prisma.suggestion.create({
      data: {
        surgeryId: surgeryId || null,
        baseId: baseId || null,
        symptom: symptom || '',
        userEmail: userEmail || null,
        text: text.trim(),
      },
    })

    return NextResponse.json(suggestion, { status: 201 })
  } catch (error) {
    console.error('Error creating suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to create suggestion' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')
    const baseId = searchParams.get('baseId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {}
    if (surgeryId) where.surgeryId = surgeryId
    if (baseId) where.baseId = baseId

    const suggestions = await prisma.suggestion.findMany({
      where,
      include: {
        surgery: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    const total = await prisma.suggestion.count({ where })

    return NextResponse.json({
      suggestions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    )
  }
}
