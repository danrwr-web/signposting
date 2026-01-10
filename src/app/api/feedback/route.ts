import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Handle CORS preflight requests for feedback widget
// This prevents 400 errors when external feedback.js scripts make OPTIONS requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

// If feedback.js tries to POST feedback, handle it (optional - can return 404 if not needed)
export async function POST(request: NextRequest) {
  // Guard: Only process if feedback feature is actually needed
  // For now, return 404 to indicate endpoint doesn't exist
  // If you want to collect feedback, implement the handler here
  return NextResponse.json(
    { error: 'Feedback endpoint not implemented' },
    { status: 404 }
  )
}

// GET handler (if needed)
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Feedback endpoint not implemented' },
    { status: 404 }
  )
}
