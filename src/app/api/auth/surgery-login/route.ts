/**
 * Surgery admin login API route
 * Handles authentication for surgery administrators
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateSurgeryAdmin, createSession } from '@/server/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      )
    }

    const session = await authenticateSurgeryAdmin(email, password)

    if (!session) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    await createSession(session)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Surgery login error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
