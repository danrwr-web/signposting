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
        adminToolkitWrite?: boolean
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
      adminToolkitWrite?: boolean
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
      adminToolkitWrite?: boolean
    }>
  }
}
