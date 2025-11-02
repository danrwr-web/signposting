import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/server/auth'
import { z } from 'zod'

export const runtime = 'nodejs'

const resetPasswordSchema = z.object({
  newPassword: z.string().min(1, 'Password is required')
})

// POST /api/s/[surgeryId]/members/[userId]/reset-password - Reset password for surgery member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ surgeryId: string; userId: string }> }
) {
  try {
    const { surgeryId, userId } = await params
    const user = await getSessionUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a surgery admin or superuser
    await requireSurgeryAdmin(surgeryId)
    
    // Verify the target user is a member of this surgery
    const membership = await prisma.userSurgery.findUnique({
      where: {
        userId_surgeryId: {
          userId,
          surgeryId
        }
      }
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'User is not a member of this surgery' },
        { status: 404 }
      )
    }

    // Verify the target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { newPassword } = resetPasswordSchema.parse(body)

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword)

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Password reset successfully' 
    })
  } catch (error) {
    console.error('Error resetting password:', error)
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}

