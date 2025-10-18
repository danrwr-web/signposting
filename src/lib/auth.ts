import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { NextAuthOptions } from 'next-auth'

// Simple custom password storage for demo purposes
// In production, you'd want to store hashed passwords in the database
const customPasswords: Record<string, string> = {}

async function checkCustomPassword(email: string, password: string): Promise<boolean> {
  return customPasswords[email] === password
}

export function setCustomPassword(email: string, password: string) {
  customPasswords[email] = password
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Find user by email
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: {
              memberships: {
                include: {
                  surgery: true
                }
              },
              defaultSurgery: true
            }
          })

          if (!user) {
            return null
          }

          // For now, we'll use a simple password check
          // In production, you'd want to store hashed passwords
          // For demo purposes, we'll use the email as password OR custom passwords
          const isValidPassword = 
            credentials.password === credentials.email || // Default demo password
            credentials.password === 'Lant0nyn!' || // Dan's custom password
            credentials.password === 'admin@idelane.com' || // Admin demo password
            credentials.password === 'user@idelane.com' || // User demo password
            await checkCustomPassword(credentials.email, credentials.password) // Check for custom passwords
          
          if (isValidPassword) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              globalRole: user.globalRole,
              defaultSurgeryId: user.defaultSurgeryId,
              memberships: user.memberships.map(m => ({
                surgeryId: m.surgeryId,
                role: m.role
              }))
            }
          }

          return null
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.globalRole = user.globalRole
        token.defaultSurgeryId = user.defaultSurgeryId
        token.memberships = user.memberships
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.globalRole = token.globalRole as string
        session.user.defaultSurgeryId = token.defaultSurgeryId as string
        session.user.memberships = token.memberships as Array<{ surgeryId: string; role: string }>
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  }
}

export default NextAuth(authOptions)
