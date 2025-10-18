import 'server-only'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { setCustomPassword } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST() {
  try {
    // Get all users
    const users = await prisma.user.findMany()

    const passwordUpdates = []
    
    for (const user of users) {
      // Skip superuser (already has hardcoded password)
      if (user.email === 'dan.rwr@gmail.com') {
        continue
      }

      // Generate a simple password based on email
      const password = user.email.split('@')[0] + '123' // e.g., "admin123", "user123"
      
      // Store password in customPasswords
      setCustomPassword(user.email, password)
      
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
