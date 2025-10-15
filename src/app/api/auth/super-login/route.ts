/**
 * Superuser login API route
 * Handles authentication for superuser
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateSuperuser, createSession } from '@/server/auth'
import { LoginReqZ, LoginResZ } from '@/lib/api-contracts'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = LoginReqZ.parse(body)

    const session = await authenticateSuperuser(email, password)

    if (!session) {
      return NextResponse.json(
        LoginResZ.parse({ success: false, message: 'Invalid email or password' }),
        { status: 401 }
      )
    }

    await createSession(session)

    return NextResponse.json(
      LoginResZ.parse({ success: true, redirectTo: '/super' })
    )
  } catch (error) {
    console.error('Superuser login error:', error)
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        LoginResZ.parse({ success: false, message: 'Invalid request format' }),
        { status: 400 }
      )
    }
    return NextResponse.json(
      LoginResZ.parse({ success: false, message: 'Internal server error' }),
      { status: 500 }
    )
  }
}
