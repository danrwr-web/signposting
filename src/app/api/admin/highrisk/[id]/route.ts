/**
 * Admin high-risk button individual operations API route
 * Handles DELETE operations for individual high-risk button configurations
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { orderIndex } = body

    if (typeof orderIndex !== 'number') {
      return NextResponse.json(
        { error: 'orderIndex must be a number' },
        { status: 400 }
      )
    }

    // Get surgery ID from the high-risk link first
    const existingLink = await prisma.highRiskLink.findUnique({
      where: { id },
      select: { surgeryId: true }
    })

    if (!existingLink) {
      return NextResponse.json(
        { error: 'High-risk button not found' },
        { status: 404 }
      )
    }

    const surgeryId = existingLink.surgeryId

    // Verify user has admin access to this surgery
    if (user.globalRole !== 'SUPERUSER') {
      await requireSurgeryAdmin(surgeryId)
    }

    // Update the order index
    await prisma.highRiskLink.update({
      where: { id },
      data: { orderIndex }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating high-risk link order:', error)
    return NextResponse.json(
      { error: 'Failed to update high-risk link order' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Get surgery ID from the high-risk link first
    const existingLink = await prisma.highRiskLink.findUnique({
      where: { id },
      select: { surgeryId: true }
    })

    if (!existingLink) {
      return NextResponse.json(
        { error: 'High-risk button not found' },
        { status: 404 }
      )
    }

    const surgeryId = existingLink.surgeryId

    // Verify user has admin access to this surgery
    if (user.globalRole !== 'SUPERUSER') {
      await requireSurgeryAdmin(surgeryId)
    }

    // Delete the high-risk link
    await prisma.highRiskLink.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting high-risk link:', error)
    return NextResponse.json(
      { error: 'Failed to delete high-risk link' },
      { status: 500 }
    )
  }
}

