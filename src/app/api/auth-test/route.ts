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
    const { email, password } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: {
            surgery: true
          }
        },
        defaultSurgery: true
      }
    })
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        debug: {
          email,
          userExists: false
        }
      })
    }
    
    // Test password validation logic
    const isValidPassword = 
      password === email || // Default demo password
      password === 'admin@example.com' || // Admin demo password
      password === 'user@example.com' // User demo password
    
    return NextResponse.json({
      success: isValidPassword,
      error: isValidPassword ? null : 'Invalid password',
      debug: {
        email,
        password,
        userExists: true,
        userRole: user.globalRole,
        userName: user.name,
        passwordChecks: {
          emailMatch: password === email,
          adminPassword: password === 'admin@example.com',
          userPassword: password === 'user@example.com'
        },
        isValidPassword
      }
    })
    
  } catch (error) {
    console.error('Auth test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
