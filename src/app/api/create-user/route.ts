import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Create surgery first
    const surgery = await prisma.surgery.create({
      data: {
        name: 'Ide Lane Surgery',
        slug: 'ide-lane-surgery'
      }
    })

    // Create superuser
    const user = await prisma.user.create({
      data: {
        email: 'superuser@example.com',
        name: 'Super User',
        globalRole: 'SUPERUSER',
        defaultSurgeryId: surgery.id
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'User created successfully',
      user: {
        email: user.email,
        name: user.name,
        role: user.globalRole
      }
    })

  } catch (error) {
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
