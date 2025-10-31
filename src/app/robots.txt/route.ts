import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  const body = `User-agent: *
Allow: /\n`
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}


