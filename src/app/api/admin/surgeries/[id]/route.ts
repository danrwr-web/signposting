/**
 * Individual surgery management API route
 * Handles PATCH and DELETE operations for surgeries (superuser only)
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuserAuth } from '@/server/auth'
import { prisma } from '@/lib/prisma'
import { UpdateSurgeryReqZ } from '@/lib/api-contracts'
import { hashPassword } from '@/server/auth'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuserAuth()
    const { id } = await params

    const body = await request.json()
    const updateData = UpdateSurgeryReqZ.parse(body)

    // Prepare update data
    const data: any = {}
    if (updateData.name) data.name = updateData.name
    if (updateData.adminEmail) data.adminEmail = updateData.adminEmail
    if (updateData.adminPassword) {
      data.adminPassHash = await hashPassword(updateData.adminPassword)
    }

    const surgery = await prisma.surgery.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        adminEmail: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ surgery })
  } catch (error) {
    console.error('Error updating surgery:', error)
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to update surgery' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuserAuth()
    const { id } = await params

    await prisma.surgery.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting surgery:', error)
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to delete surgery' },
      { status: 500 }
    )
  }
}
