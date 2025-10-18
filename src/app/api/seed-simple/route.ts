import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting database seeding...')

    // Clear existing data
    console.log('Clearing existing data...')
    await prisma.userSurgery.deleteMany()
    await prisma.user.deleteMany()
    await prisma.surgery.deleteMany()
    await prisma.baseSymptom.deleteMany()

    console.log('Creating surgery...')
    // Create surgeries
    const ideLaneSurgery = await prisma.surgery.create({
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

    console.log('Creating base symptoms...')
    // Create base symptoms
    const symptoms = [
      { name: 'Chest Pain', slug: 'chest-pain', description: 'Pain or discomfort in the chest area' },
      { name: 'Shortness of Breath', slug: 'shortness-of-breath', description: 'Difficulty breathing or feeling breathless' },
      { name: 'Headache', slug: 'headache', description: 'Pain in the head or neck area' },
      { name: 'Fever', slug: 'fever', description: 'Elevated body temperature' },
      { name: 'Cough', slug: 'cough', description: 'Persistent coughing' }
    ]

    for (const symptom of symptoms) {
      await prisma.baseSymptom.upsert({
        where: { slug: symptom.slug },
        update: symptom,
        create: symptom
      })
    }

    console.log('Creating users...')
    // Create users
    const superuser = await prisma.user.create({
      data: {
        email: 'dan.rwr@gmail.com',
        name: 'Dan Webber-Rookes',
        globalRole: 'SUPERUSER',
        defaultSurgeryId: ideLaneSurgery.id
      }
    })

    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@idelane.com',
        name: 'Admin User',
        globalRole: 'USER',
        defaultSurgeryId: ideLaneSurgery.id
      }
    })

    const standardUser = await prisma.user.create({
      data: {
        email: 'user@idelane.com',
        name: 'Standard User',
        globalRole: 'USER',
        defaultSurgeryId: ideLaneSurgery.id
      }
    })

    console.log('Creating user-surgery memberships...')
    // Create user-surgery memberships
    await prisma.userSurgery.create({
      data: {
        userId: adminUser.id,
        surgeryId: ideLaneSurgery.id,
        role: 'ADMIN'
      }
    })

    await prisma.userSurgery.create({
      data: {
        userId: standardUser.id,
        surgeryId: ideLaneSurgery.id,
        role: 'USER'
      }
    })

    console.log('Seeding completed successfully!')

    return NextResponse.json({ 
      success: true, 
      message: 'Database seeded successfully',
      users: {
        superuser: 'dan.rwr@gmail.com',
        admin: 'admin@idelane.com', 
        standard: 'user@idelane.com'
      }
    })

  } catch (error) {
    console.error('Seeding error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to seed database',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
