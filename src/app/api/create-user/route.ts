import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Create surgery first
    const surgery = await prisma.surgery.create({
      data: {
        name: 'Ide Lane Surgery',
        slug: 'ide-lane-surgery',
        address: '123 Ide Lane, Example City, EC1 1AA',
        phone: '020 1234 5678',
        email: 'info@idelane.example',
        website: 'https://idelane.example',
        description: 'A modern GP practice serving the local community'
      }
    })

    // Create your user
    const user = await prisma.user.create({
      data: {
        email: 'dan.rwr@gmail.com',
        name: 'Dan Webber-Rookes',
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
