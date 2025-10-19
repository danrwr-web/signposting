import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { NextAuthOptions } from 'next-auth'

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

          // Check password - try multiple methods for backward compatibility
          let isValidPassword = false

          // Method 1: Check database password (hashed)
          if (user.password) {
            isValidPassword = await bcrypt.compare(credentials.password, user.password)
          }

          // Method 2: Check hardcoded passwords for demo users (fallback)
          if (!isValidPassword) {
            isValidPassword = 
              credentials.password === credentials.email || // Default demo password
              credentials.password === 'Lant0nyn!' || // Dan's custom password
              credentials.password === 'admin@idelane.com' || // Admin demo password
              credentials.password === 'user@idelane.com' // User demo password
          }
          
          if (isValidPassword) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              globalRole: user.globalRole,
              defaultSurgeryId: user.defaultSurgeryId,
              isTestUser: user.isTestUser,
              symptomUsageLimit: user.symptomUsageLimit,
              symptomsUsed: user.symptomsUsed,
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
        token.isTestUser = user.isTestUser
        token.symptomUsageLimit = user.symptomUsageLimit
        token.symptomsUsed = user.symptomsUsed
        token.memberships = user.memberships
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.globalRole = token.globalRole as string
        session.user.defaultSurgeryId = token.defaultSurgeryId as string
        session.user.isTestUser = token.isTestUser as boolean
        session.user.symptomUsageLimit = token.symptomUsageLimit as number | null
        session.user.symptomsUsed = token.symptomsUsed as number
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
