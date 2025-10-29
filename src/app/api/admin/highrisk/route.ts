/**
 * Admin high-risk buttons API route
 * Handles CRUD operations for high-risk button configurations
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSuperuser, requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { GetHighRiskResZ, CreateHighRiskReqZ } from '@/lib/api-contracts'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const surgerySlug = url.searchParams.get('surgery')
    
    // Determine surgery ID
    let surgeryId: string
    if (surgerySlug) {
      // Surgery ID provided via query param (superuser or admin accessing specific surgery)
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
      
      // Verify user has admin access to this surgery
      if (user.globalRole !== 'SUPERUSER') {
        await requireSurgeryAdmin(surgeryId)
      }
    } else {
      // No surgery param - use user's default surgery or first admin surgery
      if (user.globalRole === 'SUPERUSER') {
        return NextResponse.json(
          { error: 'Surgery parameter required for superuser' },
          { status: 400 }
        )
      }
      
      // For non-superusers, require admin access to their default surgery
      if (!user.defaultSurgeryId) {
        return NextResponse.json(
          { error: 'No default surgery assigned' },
          { status: 403 }
        )
      }
      
      surgeryId = user.defaultSurgeryId
      await requireSurgeryAdmin(surgeryId)
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

    const GLOBAL_SURGERY_ID = 'global-default-buttons'

    // Get individual default button configurations for this surgery AND global defaults
    const [defaultButtonConfigs, globalButtonConfigs] = await Promise.all([
      prisma.defaultHighRiskButtonConfig.findMany({
        where: { surgeryId },
        orderBy: { orderIndex: 'asc' }
      }),
      prisma.defaultHighRiskButtonConfig.findMany({
        where: { surgeryId: GLOBAL_SURGERY_ID },
        orderBy: { orderIndex: 'asc' }
      })
    ])

    // Define default buttons with their configurations
    const defaultButtons = [
      { buttonKey: 'anaphylaxis', label: 'Anaphylaxis', symptomSlug: 'anaphylaxis', orderIndex: 0 },
      { buttonKey: 'stroke', label: 'Stroke', symptomSlug: 'stroke', orderIndex: 1 },
      { buttonKey: 'chest-pain', label: 'Chest Pain', symptomSlug: 'chest-pain', orderIndex: 2 },
      { buttonKey: 'sepsis', label: 'Sepsis', symptomSlug: 'sepsis', orderIndex: 3 },
      { buttonKey: 'meningitis', label: 'Meningitis Rash', symptomSlug: 'meningitis', orderIndex: 4 }
    ]

    // Create a map of existing configs by buttonKey (global first, then surgery-specific overrides)
    const configMap = new Map()
    for (const config of globalButtonConfigs) {
      configMap.set(config.buttonKey, config)
    }
    for (const config of defaultButtonConfigs) {
      configMap.set(config.buttonKey, config) // Surgery-specific overrides global
    }

    // Build enabled default buttons based on individual configurations
    const hardcodedButtonKeys = new Set(defaultButtons.map(btn => btn.buttonKey))
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
          orderIndex: config?.orderIndex ?? defaultButton.orderIndex,
          isDefault: true
        }
      })
      .filter(Boolean)

    // Add user-created global buttons that aren't in hardcoded list
    const userCreatedGlobalButtons = globalButtonConfigs
      .filter(config => !hardcodedButtonKeys.has(config.buttonKey))
      .map(config => {
        // Check if there's a surgery-specific override
        const surgeryOverride = configMap.get(config.buttonKey)
        const isEnabled = surgeryOverride?.isEnabled ?? config.isEnabled
        
        if (!isEnabled) return null
        
        return {
          id: config.id,
          label: config.label,
          symptomSlug: config.symptomSlug,
          symptomId: null,
          orderIndex: config.orderIndex,
          isDefault: true
        }
      })
      .filter(Boolean)

    // Mark custom links as not default
    const markedCustomLinks = customLinks.map(link => ({
      ...link,
      isDefault: false
    }))

    // Combine enabled default buttons, user-created global buttons, and custom links
    const allLinks = [...enabledDefaultButtons, ...userCreatedGlobalButtons, ...markedCustomLinks]
      .sort((a, b) => (a?.orderIndex ?? 0) - (b?.orderIndex ?? 0)) // Sort by orderIndex

    return NextResponse.json(
      GetHighRiskResZ.parse({ links: allLinks }),
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    )
  } catch (error) {
    console.error('Error fetching high-risk links:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Failed to fetch high-risk links', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { label, symptomSlug, symptomId, orderIndex } = CreateHighRiskReqZ.parse(body)

    const url = new URL(request.url)
    const surgerySlug = url.searchParams.get('surgery')
    
    // Determine surgery ID
    let surgeryId: string
    if (surgerySlug) {
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
      
      // Verify user has admin access to this surgery
      if (user.globalRole !== 'SUPERUSER') {
        await requireSurgeryAdmin(surgeryId)
      }
    } else {
      if (user.globalRole === 'SUPERUSER') {
        return NextResponse.json(
          { error: 'Surgery parameter required for superuser' },
          { status: 400 }
        )
      }
      
      if (!user.defaultSurgeryId) {
        return NextResponse.json(
          { error: 'No default surgery assigned' },
          { status: 403 }
        )
      }
      
      surgeryId = user.defaultSurgeryId
      await requireSurgeryAdmin(surgeryId)
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
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { enableDefaultHighRisk } = body

    if (typeof enableDefaultHighRisk !== 'boolean') {
      return NextResponse.json(
        { error: 'enableDefaultHighRisk must be a boolean' },
        { status: 400 }
      )
    }

    const url = new URL(request.url)
    const surgerySlug = url.searchParams.get('surgery')
    
    // Determine surgery ID
    let surgeryId: string
    if (surgerySlug) {
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
      
      // Verify user has admin access to this surgery
      if (user.globalRole !== 'SUPERUSER') {
        await requireSurgeryAdmin(surgeryId)
      }
    } else {
      if (user.globalRole === 'SUPERUSER') {
        return NextResponse.json(
          { error: 'Surgery parameter required for superuser' },
          { status: 400 }
        )
      }
      
      if (!user.defaultSurgeryId) {
        return NextResponse.json(
          { error: 'No default surgery assigned' },
          { status: 403 }
        )
      }
      
      surgeryId = user.defaultSurgeryId
      await requireSurgeryAdmin(surgeryId)
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
