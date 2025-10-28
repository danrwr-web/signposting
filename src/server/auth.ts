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
  const sessionData = JSON.stringify(session)
  
  cookieStore.set('session', sessionData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')
    
    if (!sessionCookie?.value) {
      return null
    }
    
    return JSON.parse(sessionCookie.value) as Session
  } catch (error) {
    console.error('Error parsing session:', error)
    return null
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

export async function requireAuth(redirectTo: string = '/admin-login'): Promise<Session> {
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
  const session = await requireAuth('/admin-login')
  
  if (session.type !== 'surgery' || !session.surgeryId) {
    redirect('/admin-login')
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

export async function authenticateSurgeryAdmin(email: string, password: string): Promise<Session | null> {
  try {
    const surgery = await prisma.surgery.findUnique({
      where: { adminEmail: email },
    })
    
    if (!surgery || !surgery.adminPassHash) {
      return null
    }
    
    const isValid = await verifyPassword(password, surgery.adminPassHash)
    
    if (!isValid) {
      return null
    }
    
    return {
      type: 'surgery',
      id: surgery.id,
      email: surgery.adminEmail!,
      surgeryId: surgery.id,
      surgerySlug: surgery.slug ?? undefined,
    }
  } catch (error) {
    console.error('Error authenticating surgery admin:', error)
    return null
  }
}

export async function authenticateSuperuser(email: string, password: string): Promise<Session | null> {
  try {
    console.log('Superuser auth attempt:', email, 'password length:', password.length)
    // Temporary hardcoded credentials for testing
    if (email === 'dan.rwr@gmail.com' && password === 'Lant0nyn!') {
      console.log('Superuser authenticated successfully')
      return {
        type: 'superuser',
        id: 'superuser',
        email: 'dan.rwr@gmail.com',
      }
    }
    console.log('Superuser auth failed - credentials mismatch')
    
    // Fallback to environment variables if they exist
    const superuserEmail = process.env.SUPERUSER_EMAIL
    const superuserPassHash = process.env.SUPERUSER_PASS_HASH
    
    if (!superuserEmail || !superuserPassHash) {
      return null
    }
    
    if (email !== superuserEmail) {
      return null
    }
    
    const isValid = await verifyPassword(password, superuserPassHash)
    
    if (!isValid) {
      return null
    }
    
    return {
      type: 'superuser',
      id: 'superuser',
      email: superuserEmail,
    }
  } catch (error) {
    console.error('Error authenticating superuser:', error)
    return null
  }
}

export async function setSurgeryAdminPassword(surgeryId: string, password: string): Promise<boolean> {
  try {
    const hashedPassword = await hashPassword(password)
    
    await prisma.surgery.update({
      where: { id: surgeryId },
      data: { adminPassHash: hashedPassword },
    })
    
    return true
  } catch (error) {
    console.error('Error setting surgery admin password:', error)
    return false
  }
}
