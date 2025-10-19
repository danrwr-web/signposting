import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Try to create just a surgery first
    const surgery = await prisma.surgery.create({
      data: {
        name: 'Test Surgery',
        slug: 'test-surgery'
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Surgery created successfully',
      surgery: {
        id: surgery.id,
        name: surgery.name
      }
    })

  } catch (error) {
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
