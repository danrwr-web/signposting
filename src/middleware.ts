import { withAuth } from 'next-auth/middleware'
import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const APP_HOST = 'app.signpostingtool.co.uk'
const MARKETING_HOSTS = new Set(['www.signpostingtool.co.uk', 'signpostingtool.co.uk'])

const authMiddleware = withAuth(
  function middleware(req) {
    // Handle OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Redirect unauthenticated users to login
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Admin routes - accessible by superusers or surgery admins
    if (
      pathname.startsWith('/admin') ||
      pathname.startsWith('/daily-dose/admin') ||
      pathname.startsWith('/daily-dose/insights') ||
      pathname.startsWith('/editorial')
    ) {
      const isSuperuser = token.globalRole === 'SUPERUSER'
      const isSurgeryAdmin = (token.memberships as Array<{ surgeryId: string; role: string }>)?.some(
        m => m.role === 'ADMIN'
      )
      
      if (!isSuperuser && !isSurgeryAdmin) {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
    }

    // Surgery admin routes - accessible by surgery admins or superusers
    // Match /s/[id]/admin (and /s/[id]/admin/*) but NOT /s/[id]/admin-toolkit
    // Also match /s/[id]/admin-toolkit/admin (admin dashboard for Admin Toolkit)
    const isSurgeryAdminRoute = pathname.match(/^\/s\/[^\/]+\/admin(\/|$)/)
    const isAdminToolkitAdminRoute = pathname.match(/^\/s\/[^\/]+\/admin-toolkit\/admin(\/|$)/)
    
    if (isSurgeryAdminRoute || isAdminToolkitAdminRoute) {
      const surgeryIdMatch = pathname.match(/^\/s\/([^\/]+)\//)
      if (surgeryIdMatch) {
        const surgeryId = surgeryIdMatch[1]
        
        // Check if user has admin access to this surgery
        const hasAccess = token.globalRole === 'SUPERUSER' || 
          (token.memberships as Array<{ surgeryId: string; role: string }>)?.some(
            m => m.surgeryId === surgeryId && m.role === 'ADMIN'
          )
        
        if (!hasAccess) {
          return NextResponse.redirect(new URL('/unauthorized', req.url))
        }
      }
    }

    // Surgery routes - accessible by surgery members or superusers
    //
    // Note: `/s/select` is a special authenticated entry route (not a surgery ID),
    // so it must bypass the surgeryId membership check.
    if (pathname === '/s/select') {
      return NextResponse.next()
    }

    if (pathname.match(/^\/s\/[^\/]+/)) {
      const surgeryIdMatch = pathname.match(/^\/s\/([^\/]+)/)
      if (surgeryIdMatch) {
        const surgeryId = surgeryIdMatch[1]
        
        // Check if user has access to this surgery
        const hasAccess = token.globalRole === 'SUPERUSER' || 
          (token.memberships as Array<{ surgeryId: string; role: string }>)?.some(
            m => m.surgeryId === surgeryId
          )
        
        if (!hasAccess) {
          return NextResponse.redirect(new URL('/unauthorized', req.url))
        }
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to public routes
        const publicRoutes = ['/', '/login', '/unauthorized']
        if (publicRoutes.includes(req.nextUrl.pathname)) {
          return true
        }

        // Require authentication for all other routes
        return !!token
      },
    },
  }
)

export default async function middleware(req: NextRequest) {
  const hostname = (req.headers.get('host') || '').toLowerCase().split(':')[0]
  const pathname = req.nextUrl.pathname
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
  const isMarketingHost = MARKETING_HOSTS.has(hostname)
  const isAppHost = hostname === APP_HOST

  // Production host routing:
  // - Marketing hosts should always serve the landing page and demo request page without auth redirects.
  if (isMarketingHost && (pathname === '/' || pathname === '/demo-request')) {
    return NextResponse.next()
  }

  // - App host root should take users into the app entry route (default surgery or login).
  if (isAppHost && pathname === '/') {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    const defaultSurgeryId = token?.defaultSurgeryId as string | undefined
    const targetPath = defaultSurgeryId ? `/s/${defaultSurgeryId}` : '/login'
    return NextResponse.redirect(new URL(targetPath, req.url))
  }

  // In development or for other hosts, keep existing behaviour.
  const isProtectedPath =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/s/') ||
    pathname.startsWith('/daily-dose') ||
    pathname.startsWith('/editorial')
  if (isProtectedPath) {
    return (authMiddleware as any)(req)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
