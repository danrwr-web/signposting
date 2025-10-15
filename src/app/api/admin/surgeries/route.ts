/**
 * Surgery management API route
 * Handles CRUD operations for surgeries (superuser only)
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuserAuth } from '@/server/auth'
import { prisma } from '@/lib/prisma'
import { CreateSurgeryReqZ, GetSurgeriesResZ } from '@/lib/api-contracts'
import { hashPassword } from '@/server/auth'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireSuperuserAuth()

    const surgeries = await prisma.surgery.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        adminEmail: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(
      GetSurgeriesResZ.parse({ surgeries }),
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    )
  } catch (error) {
    console.error('Error fetching surgeries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch surgeries' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperuserAuth()

    const body = await request.json()
    const { name, slug, adminEmail, adminPassword } = CreateSurgeryReqZ.parse(body)

    // Check if slug already exists
    const existingSurgery = await prisma.surgery.findUnique({
      where: { slug }
    })

    if (existingSurgery) {
      return NextResponse.json(
        { error: 'A surgery with this slug already exists' },
        { status: 409 }
      )
    }

    // Hash password if provided
    const adminPassHash = adminPassword ? await hashPassword(adminPassword) : null

    const surgery = await prisma.surgery.create({
      data: {
        name,
        slug,
        adminEmail: adminEmail || null,
        adminPassHash,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        adminEmail: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ surgery }, { status: 201 })
  } catch (error) {
    console.error('Error creating surgery:', error)
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create surgery' },
      { status: 500 }
    )
  }
}
