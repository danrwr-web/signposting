import 'server-only'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

export async function POST() {
  try {
    // Get all users without passwords
    const usersWithoutPasswords = await prisma.user.findMany({
      where: {
        password: null
      }
    })

    const updates = []
    
    for (const user of usersWithoutPasswords) {
      // Generate a simple password based on email
      const password = user.email.split('@')[0] + '123' // e.g., "admin123", "user123"
      const hashedPassword = await bcrypt.hash(password, 12)
      
      updates.push(
        prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword }
        })
      )
    }

    await Promise.all(updates)

    return NextResponse.json({
      success: true,
      message: `Added database passwords for ${updates.length} users`,
      users: usersWithoutPasswords.map(u => ({
        email: u.email,
        password: u.email.split('@')[0] + '123'
      }))
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
