/**
 * Admin high-risk buttons API route
 * Handles CRUD operations for high-risk button configurations
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { prisma } from '@/lib/prisma'
import { GetHighRiskResZ, CreateHighRiskReqZ } from '@/lib/api-contracts'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    
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
    
    // Get surgery config and custom links
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { enableDefaultHighRisk: true }
    })
    
    const customLinks = await prisma.highRiskLink.findMany({
      where: { surgeryId },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        label: true,
        symptomSlug: true,
        symptomId: true,
        orderIndex: true,
      },
    })

    // Get individual default button configurations
    const defaultButtonConfigs = await prisma.defaultHighRiskButtonConfig.findMany({
      where: { surgeryId },
      orderBy: { orderIndex: 'asc' }
    })

    // Define default buttons with their configurations
    const defaultButtons = [
      { buttonKey: 'anaphylaxis', label: 'Anaphylaxis', symptomSlug: 'anaphylaxis', orderIndex: 0 },
      { buttonKey: 'stroke', label: 'Stroke', symptomSlug: 'stroke', orderIndex: 1 },
      { buttonKey: 'chest-pain', label: 'Chest Pain', symptomSlug: 'chest-pain', orderIndex: 2 },
      { buttonKey: 'sepsis', label: 'Sepsis', symptomSlug: 'sepsis', orderIndex: 3 },
      { buttonKey: 'meningitis', label: 'Meningitis Rash', symptomSlug: 'meningitis', orderIndex: 4 }
    ]

    // Create a map of existing configs by buttonKey
    const configMap = new Map(defaultButtonConfigs.map(config => [config.buttonKey, config]))

    // Build enabled default buttons based on individual configurations
    const enabledDefaultButtons = defaultButtons
      .map(defaultButton => {
        const config = configMap.get(defaultButton.buttonKey)
        const isEnabled = config?.isEnabled ?? surgery?.enableDefaultHighRisk ?? true
        
        if (!isEnabled) return null
        
        return {
          id: `default-${defaultButton.buttonKey}`,
          label: config?.label || defaultButton.label,
          symptomSlug: config?.symptomSlug || defaultButton.symptomSlug,
          symptomId: null,
          orderIndex: config?.orderIndex ?? defaultButton.orderIndex
        }
      })
      .filter(Boolean)

    // Combine enabled default buttons and custom links
    const allLinks = [...enabledDefaultButtons, ...customLinks]

    return NextResponse.json(
      GetHighRiskResZ.parse({ links: allLinks }),
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    )
  } catch (error) {
    console.error('Error fetching high-risk links:', error)
    return NextResponse.json(
      { error: 'Failed to fetch high-risk links' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const { label, symptomSlug, symptomId, orderIndex } = CreateHighRiskReqZ.parse(body)

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

    // Check if label already exists for this surgery
    const existing = await prisma.highRiskLink.findUnique({
      where: {
        surgeryId_label: {
          surgeryId,
          label
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A high-risk button with this label already exists' },
        { status: 409 }
      )
    }

    const link = await prisma.highRiskLink.create({
      data: {
        surgeryId,
        label,
        symptomSlug,
        symptomId,
        orderIndex: orderIndex || 0
      },
      select: {
        id: true,
        label: true,
        symptomSlug: true,
        symptomId: true,
        orderIndex: true,
      },
    })

    return NextResponse.json({ link }, { status: 201 })
  } catch (error) {
    console.error('Error creating high-risk link:', error)
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create high-risk link' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const { enableDefaultHighRisk } = body

    if (typeof enableDefaultHighRisk !== 'boolean') {
      return NextResponse.json(
        { error: 'enableDefaultHighRisk must be a boolean' },
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

    await prisma.surgery.update({
      where: { id: surgeryId },
      data: { enableDefaultHighRisk }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating default high-risk setting:', error)
    return NextResponse.json(
      { error: 'Failed to update default high-risk setting' },
      { status: 500 }
    )
  }
}
