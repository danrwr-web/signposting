// DEV-ONLY: This route is disabled in production.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Forbidden: This route is disabled in production' },
      { status: 403 }
    )
  }

  try {
    // Check if this is a development/seeding request
    const { secret } = await request.json()
    
    // Temporarily disable secret check for immediate seeding
    // if (secret !== process.env.SEED_SECRET) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    // Clear existing data
    await prisma.userSurgery.deleteMany()
    await prisma.user.deleteMany()
    await prisma.surgery.deleteMany()
    await prisma.baseSymptom.deleteMany()

    // Create surgeries
    const ideLaneSurgery = await prisma.surgery.create({
      data: {
        name: 'Ide Lane Surgery',
        slug: 'ide-lane-surgery'
      }
    })

    // Create base symptoms
    const symptoms = [
      { name: 'Chest Pain', slug: 'chest-pain', ageGroup: 'Adult', description: 'Pain or discomfort in the chest area' },
      { name: 'Shortness of Breath', slug: 'shortness-of-breath', ageGroup: 'Adult', description: 'Difficulty breathing or feeling breathless' },
      { name: 'Headache', slug: 'headache', ageGroup: 'Adult', description: 'Pain in the head or neck area' },
      { name: 'Fever', slug: 'fever', ageGroup: 'Adult', description: 'Elevated body temperature' },
      { name: 'Cough', slug: 'cough', ageGroup: 'Adult', description: 'Persistent coughing' }
    ]

    for (const symptom of symptoms) {
      await prisma.baseSymptom.upsert({
        where: { slug: symptom.slug },
        update: symptom,
        create: symptom
      })
    }

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
      error: 'Failed to seed database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
