import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting minimal seeding...')

    // Step 1: Create surgery first (users need this)
    console.log('Creating surgery...')
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

    console.log('Surgery created:', surgery.id)

    // Step 2: Create users
    console.log('Creating users...')
    const superuser = await prisma.user.create({
      data: {
        email: 'dan.rwr@gmail.com',
        name: 'Dan Webber-Rookes',
        globalRole: 'SUPERUSER',
        defaultSurgeryId: surgery.id
      }
    })

    console.log('Superuser created:', superuser.id)

    return NextResponse.json({ 
      success: true, 
      message: 'Minimal seeding completed',
      surgery: {
        id: surgery.id,
        name: surgery.name
      },
      user: {
        id: superuser.id,
        email: superuser.email,
        name: superuser.name,
        role: superuser.globalRole
      }
    })

  } catch (error) {
    console.error('Minimal seeding error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to seed database',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
