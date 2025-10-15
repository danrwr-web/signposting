/**
 * Admin high-risk button individual operations API route
 * Handles DELETE operations for individual high-risk button configurations
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const body = await request.json()
    const { orderIndex } = body

    if (typeof orderIndex !== 'number') {
      return NextResponse.json(
        { error: 'orderIndex must be a number' },
        { status: 400 }
      )
    }

    // Determine surgery ID based on session type
    let surgeryId: string
    if (session.type === 'surgery') {
      surgeryId = session.surgeryId!
    } else if (session.type === 'superuser') {
      // For superusers, get surgery ID from query params
      const url = new URL(request.url)
      const surgerySlug = url.searchParams.get('surgery')
      if (!surgerySlug) {
        return NextResponse.json(
          { error: 'Surgery parameter required for superuser' },
          { status: 400 }
        )
      }
      const surgery = await prisma.surgery.findUnique({
        where: { slug: surgerySlug },
        select: { id: true }
      })
      if (!surgery) {
        return NextResponse.json(
          { error: 'Surgery not found' },
          { status: 404 }
        )
      }
      surgeryId = surgery.id
    } else {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if the high-risk link exists and belongs to this surgery
    const existingLink = await prisma.highRiskLink.findFirst({
      where: {
        id,
        surgeryId
      }
    })

    if (!existingLink) {
      return NextResponse.json(
        { error: 'High-risk button not found' },
        { status: 404 }
      )
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
    const session = await requireAuth()
    const { id } = await params

    // Determine surgery ID based on session type
    let surgeryId: string
    if (session.type === 'surgery') {
      surgeryId = session.surgeryId!
    } else if (session.type === 'superuser') {
      // For superusers, get surgery ID from query params
      const url = new URL(request.url)
      const surgerySlug = url.searchParams.get('surgery')
      if (!surgerySlug) {
        return NextResponse.json(
          { error: 'Surgery parameter required for superuser' },
          { status: 400 }
        )
      }
      const surgery = await prisma.surgery.findUnique({
        where: { slug: surgerySlug },
        select: { id: true }
      })
      if (!surgery) {
        return NextResponse.json(
          { error: 'Surgery not found' },
          { status: 404 }
        )
      }
      surgeryId = surgery.id
    } else {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if the high-risk link exists and belongs to this surgery
    const existingLink = await prisma.highRiskLink.findFirst({
      where: {
        id,
        surgeryId
      }
    })

    if (!existingLink) {
      return NextResponse.json(
        { error: 'High-risk button not found' },
        { status: 404 }
      )
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

