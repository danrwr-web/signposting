// DEV-ONLY: This route is disabled in production.
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/server/auth'
import { cookies } from 'next/headers'

export async function GET() {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Forbidden: This route is disabled in production' },
      { status: 403 }
    )
  }

  try {
    const session = await getSession()
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')
    
    return NextResponse.json({
      session,
      sessionCookie: sessionCookie ? {
        name: sessionCookie.name,
        value: sessionCookie.value ? JSON.parse(sessionCookie.value) : null,
        hasValue: !!sessionCookie.value
      } : null,
      type: session?.type
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

