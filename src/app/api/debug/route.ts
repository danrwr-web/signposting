// DEV-ONLY: This route is disabled in production.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Forbidden: This route is disabled in production' },
      { status: 403 }
    )
  }

  try {
    // Test database connection
    const dbTest = await prisma.$queryRaw`SELECT 1 as test`
    
    // Check if users exist
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        defaultSurgeryId: true
      }
    })
    
    // Check if surgeries exist
    const surgeries = await prisma.surgery.findMany({
      select: {
        id: true,
        name: true,
        slug: true
      }
    })
    
    // Check if base symptoms exist
    const symptoms = await prisma.baseSymptom.findMany({
      select: {
        id: true,
        name: true,
        slug: true
      }
    })
    
    return NextResponse.json({
      success: true,
      database: {
        connected: true,
        test: dbTest
      },
      data: {
        users: users,
        surgeries: surgeries,
        symptoms: symptoms
      },
      counts: {
        users: users.length,
        surgeries: surgeries.length,
        symptoms: symptoms.length
      }
    })
    
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      database: {
        connected: false
      }
    }, { status: 500 })
  }
}
