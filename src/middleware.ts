import { withAuth } from 'next-auth/middleware'
import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyLegacySession } from '@/lib/legacySessionCookie'

const APP_HOST = 'app.signpostingtool.co.uk'
const MARKETING_HOSTS = new Set(['www.signpostingtool.co.uk', 'signpostingtool.co.uk'])

/**
 * API paths that must stay reachable with no session at all.
 *
 * Deliberately an allowlist: anything not named here needs a session before it
 * can be written to. Keep it short, and justify every entry.
 */
const PUBLIC_API_PREFIXES = [
  // NextAuth's own handler plus the legacy /super-login endpoint. These ARE
  // the sign-in mechanism — gating them locks everyone out.
  '/api/auth/',
  // Vercel Cron invokes this with no session; it authenticates itself with a
  // CRON_SECRET bearer token (see api/cron/refresh-practice-data/route.ts).
  '/api/cron/',
]

const PUBLIC_API_PATHS = new Set([
  // The public demo request form on signpostingtool.co.uk/demo-request, which
  // anonymous visitors submit.
  '/api/demo-request',
])

/** Methods that can change stored data. GET/HEAD/OPTIONS are unaffected. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function isPublicApiPath(pathname: string): boolean {
  return (
    PUBLIC_API_PATHS.has(pathname) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  )
}

/**
 * Whether the request carries *any* recognised session.
 *
 * Two session systems are live in parallel: NextAuth JWTs issued by /login, and
 * the legacy `session` cookie issued by /super-login and read
 * by routes such as /api/highlights and /api/image-icons. Accepting only the
 * first would lock superusers out of the pages that use the second.
 *
 * Both are verified cryptographically. Accepting the mere presence of the
 * legacy cookie would be worthless: it is set by the client, so any caller
 * could send `session=x` and walk straight through this gate.
 *
 * This is still authentication, not authorisation — every route runs its own
 * permission logic. The point is only that a caller with no valid session can
 * never reach a route that forgets to check.
 */
async function hasAnySession(req: NextRequest): Promise<boolean> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (token) return true

  const legacy = await verifyLegacySession(
    req.cookies.get('session')?.value,
    process.env.NEXTAUTH_SECRET
  )
  return legacy !== null
}

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
    if (pathname.startsWith('/admin')) {
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

  // Defence in depth for the API surface. Route handlers each do their own
  // authorisation, but this middleware previously only covered /admin and /s/,
  // so a handler that forgot to check was reachable by anyone on the internet.
  // Writes now require a session unless explicitly allowlisted above.
  //
  // Scoped to mutating methods on purpose: some pages (e.g. /symptom/[id]) are
  // currently readable without a session and fetch API data to render, so
  // gating GET here would change read behaviour as a side effect of a security
  // fix. Read access is a separate decision.
  if (
    pathname.startsWith('/api/') &&
    MUTATING_METHODS.has(req.method) &&
    !isPublicApiPath(pathname) &&
    !(await hasAnySession(req))
  ) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // In development or for other hosts, keep existing behaviour.
  const isProtectedPath = pathname.startsWith('/admin') || pathname.startsWith('/s/')
  if (isProtectedPath) {
    return (authMiddleware as any)(req)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
