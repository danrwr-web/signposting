/**
 * Server-only authentication utilities
 * Handles surgery admin and superuser authentication
 */

import 'server-only'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { signLegacySession, verifyLegacySession } from '@/lib/legacySessionCookie'

export interface Session {
  type: 'surgery' | 'superuser'
  id: string
  email?: string
  surgeryId?: string
  surgerySlug?: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(session: Session): Promise<void> {
  const cookieStore = await cookies()
  // Signed, not plain JSON: an unsigned value could simply be presented by the
  // caller, and getSession() below trusts whatever it decodes.
  const sessionData = await signLegacySession(
    JSON.stringify(session),
    process.env.NEXTAUTH_SECRET ?? ''
  )

  const cookieDomain = process.env.COOKIE_DOMAIN

  cookieStore.set('session', sessionData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: cookieDomain || undefined,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')

    // Fails closed on a missing, unsigned or tampered value, so a forged cookie
    // falls through to the NextAuth check below rather than being trusted.
    const verifiedPayload = await verifyLegacySession(
      sessionCookie?.value,
      process.env.NEXTAUTH_SECRET
    )

    // A legacy cookie is only honoured for superusers now. /admin-login issued
    // `type: 'surgery'` cookies, and removing that login does not revoke the
    // ones already out there — they stay valid for the cookie's remaining life
    // and every route that trusts getSession() would keep authorising them.
    // Ignoring the payload here (rather than returning null outright) lets the
    // NextAuth check below still run, so a user who happens to hold a stale
    // cookie AND a real session is unaffected.
    const legacySession = verifiedPayload
      ? (JSON.parse(verifiedPayload) as Session)
      : null
    const usableLegacySession =
      legacySession && legacySession.type === 'superuser' ? legacySession : null

    if (!usableLegacySession) {
      // Fallback to NextAuth session if our cookie is missing
      try {
        const nextAuthSession = await getServerSession(authOptions)
        if (nextAuthSession?.user) {
          const isSuper = nextAuthSession.user.globalRole === 'SUPERUSER'
          if (isSuper) {
            return {
              type: 'superuser',
              id: nextAuthSession.user.id,
              email: nextAuthSession.user.email ?? '',
            }
          }
          const defaultSurgeryId = (nextAuthSession.user as any).defaultSurgeryId as string | undefined
          if (defaultSurgeryId) {
            return {
              type: 'surgery',
              id: nextAuthSession.user.id,
              email: nextAuthSession.user.email ?? '',
              surgeryId: defaultSurgeryId,
            }
          }
        }
      } catch {}
      return null
    }

    return usableLegacySession
  } catch (error) {
    console.error('Error parsing session:', error)
    return null
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

export async function requireAuth(redirectTo: string = '/login'): Promise<Session> {
  const session = await getSession()
  
  if (!session) {
    // Try falling back to NextAuth session (global user auth)
    const nextAuthSession = await getServerSession(authOptions)
    if (nextAuthSession?.user) {
      // Map NextAuth session to our Session shape
      const isSuper = nextAuthSession.user.globalRole === 'SUPERUSER'
      if (isSuper) {
        return {
          type: 'superuser',
          id: nextAuthSession.user.id,
          email: nextAuthSession.user.email ?? '',
        }
      }
      // For surgery admins, use their default surgery when available
      const defaultSurgeryId = (nextAuthSession.user as any).defaultSurgeryId as string | undefined
      if (defaultSurgeryId) {
        return {
          type: 'surgery',
          id: nextAuthSession.user.id,
          email: nextAuthSession.user.email ?? '',
          surgeryId: defaultSurgeryId,
        }
      }
      // If no default surgery, treat as unauthorized for surgery-only endpoints
    }

    // Distinguish between API/json requests and page requests.
    const { headers } = await import('next/headers')
    const headersList = await headers()
    const acceptHeader = headersList.get('accept') || ''

    const acceptsHtml = acceptHeader.includes('text/html')
    const acceptsJsonOnly = acceptHeader.includes('application/json') && !acceptsHtml

    if (acceptsJsonOnly) {
      // Likely an API request – surface a 401 via thrown error
      throw new Error('Unauthorized: No valid session found')
    }

    // For normal page requests (including prefetch), redirect to login
    redirect(redirectTo)
  }
  
  return session
}

export async function requireSurgeryAuth(): Promise<Session> {
  const session = await requireAuth('/login')
  
  if (session.type !== 'surgery' || !session.surgeryId) {
    redirect('/login')
  }
  
  return session
}

export async function requireSuperuserAuth(): Promise<Session> {
  const session = await requireAuth('/super-login')
  
  if (session.type !== 'superuser') {
    redirect('/super-login')
  }
  
  return session
}

export async function authenticateSuperuser(email: string, password: string): Promise<Session | null> {
  try {
    // Look up user in database by email and verify they are a superuser
    const user = await prisma.user.findUnique({
      where: { email },
      // Login needs the hash; it is omitted from queries by default (src/lib/prisma.ts).
      omit: { password: false },
      include: {
        memberships: {
          include: {
            surgery: {
              select: {
                id: true,
                name: true,
                slug: true,
              }
            }
          }
        },
        defaultSurgery: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        }
      }
    })

    if (!user) {
      return null
    }

    // Must be a superuser
    if (user.globalRole !== 'SUPERUSER') {
      return null
    }

    // Verify password against database hash
    if (!user.password) {
      return null
    }

    const isValid = await verifyPassword(password, user.password)
    
    if (!isValid) {
      return null
    }
    
    return {
      type: 'superuser',
      id: user.id,
      email: user.email,
    }
  } catch (error) {
    console.error('Error authenticating superuser:', error)
    return null
  }
}

