/**
 * Logout API route
 * Destroys the current session
 */

import 'server-only'
import { NextResponse } from 'next/server'
import { destroySession } from '@/server/auth'

export const runtime = 'nodejs'

export async function POST() {
  try {
    await destroySession()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
