import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default withAuth(
  function middleware(req) {
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
    if (pathname.match(/^\/s\/[^\/]+\/admin/)) {
      const surgeryIdMatch = pathname.match(/^\/s\/([^\/]+)\/admin/)
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

export const config = {
  matcher: [
    '/admin/:path*',
    '/s/:path*'
  ]
}
