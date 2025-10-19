import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const resetUsageSchema = z.object({
  userId: z.string().min(1, 'User ID is required')
})

// POST /api/admin/test-users/reset-usage - Reset test user usage
export async function POST(request: NextRequest) {
  try {
    await requireSuperuser()
    
    const body = await request.json()
    const { userId } = resetUsageSchema.parse(body)

    // Check if user exists and is a test user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isTestUser: true, email: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.isTestUser) {
      return NextResponse.json({ error: 'User is not a test user' }, { status: 400 })
    }

    // Reset usage count
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { symptomsUsed: 0 },
      select: {
        id: true,
        email: true,
        symptomsUsed: true,
        symptomUsageLimit: true
      }
    })

    return NextResponse.json({
      success: true,
      message: `Usage reset for test user ${user.email}`,
      user: updatedUser
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
