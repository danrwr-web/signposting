import 'server-only'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        memberships: {
          include: {
            surgery: true
          }
        },
        defaultSurgery: true
      }
    })

    return NextResponse.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        globalRole: user.globalRole,
        defaultSurgeryId: user.defaultSurgeryId,
        memberships: user.memberships,
        defaultSurgery: user.defaultSurgery,
        hasPassword: !!user.password
      }))
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
