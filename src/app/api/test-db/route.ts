import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Simple test - just try to connect to database
    const result = await prisma.$queryRaw`SELECT 1 as test`
    
    return NextResponse.json({
      success: true,
      message: 'Database connection test successful',
      result: result
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    // Try to create a simple user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        globalRole: 'USER'
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
