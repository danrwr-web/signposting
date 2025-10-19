import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    await requireSuperuser()
    
    // Find all test users without defaultSurgeryId
    const testUsersWithoutSurgery = await prisma.user.findMany({
      where: {
        isTestUser: true,
        defaultSurgeryId: null
      }
    })

    if (testUsersWithoutSurgery.length === 0) {
      return NextResponse.json({ message: 'No test users need fixing' })
    }

    // Get the first available surgery
    const firstSurgery = await prisma.surgery.findFirst({
      select: { id: true }
    })

    if (!firstSurgery) {
      return NextResponse.json({ error: 'No surgeries available' }, { status: 400 })
    }

    // Update all test users without surgery
    const updatedUsers = []
    for (const user of testUsersWithoutSurgery) {
      // Update user with defaultSurgeryId
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { defaultSurgeryId: firstSurgery.id }
      })

      // Create membership if it doesn't exist
      const existingMembership = await prisma.userSurgery.findUnique({
        where: {
          userId_surgeryId: {
            userId: user.id,
            surgeryId: firstSurgery.id
          }
        }
      })

      if (!existingMembership) {
        await prisma.userSurgery.create({
          data: {
            userId: user.id,
            surgeryId: firstSurgery.id,
            role: 'STANDARD'
          }
        })
      }

      updatedUsers.push(updatedUser)
    }

    return NextResponse.json({ 
      message: `Fixed ${updatedUsers.length} test users`,
      users: updatedUsers.map(u => ({ id: u.id, email: u.email }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
