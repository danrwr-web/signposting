import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      globalRole: string
      defaultSurgeryId?: string | null
      isTestUser: boolean
      symptomUsageLimit?: number | null
      symptomsUsed: number
      memberships: Array<{
        surgeryId: string
        role: string
      }>
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    globalRole: string
    defaultSurgeryId?: string | null
    isTestUser: boolean
    symptomUsageLimit?: number | null
    symptomsUsed: number
    memberships: Array<{
      surgeryId: string
      role: string
    }>
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    globalRole: string
    defaultSurgeryId?: string | null
    isTestUser: boolean
    symptomUsageLimit?: number | null
    symptomsUsed: number
    memberships: Array<{
      surgeryId: string
      role: string
    }>
  }
}
