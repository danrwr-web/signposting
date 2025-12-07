// DEV-ONLY: This route is disabled in production.
import 'server-only'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

export async function POST() {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Forbidden: This route is disabled in production' },
      { status: 403 }
    )
  }

  try {
    // Get all users
    const users = await prisma.user.findMany()

    const passwordUpdates = []
    
    for (const user of users) {
      // Generate a simple password based on email
      const password = user.email.split('@')[0] + '123' // e.g., "admin123", "user123"
      
      // Hash and store password in database
      const hashedPassword = await bcrypt.hash(password, 12)
      
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      })
      
      passwordUpdates.push({
        email: user.email,
        password: password
      })
    }

    return NextResponse.json({
      success: true,
      message: `Added passwords for ${passwordUpdates.length} users`,
      passwords: passwordUpdates
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
