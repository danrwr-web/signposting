import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/server/auth'
import { GetDefaultHighRiskButtonsResZ, UpdateDefaultHighRiskButtonReqZ } from '@/lib/api-contracts'

export const runtime = 'nodejs'

// Default button definitions
const DEFAULT_BUTTONS = [
  { buttonKey: 'anaphylaxis', label: 'Anaphylaxis', symptomSlug: 'anaphylaxis', orderIndex: 0 },
  { buttonKey: 'stroke', label: 'Stroke', symptomSlug: 'stroke', orderIndex: 1 },
  { buttonKey: 'chest-pain', label: 'Chest Pain', symptomSlug: 'chest-pain', orderIndex: 2 },
  { buttonKey: 'sepsis', label: 'Sepsis', symptomSlug: 'sepsis', orderIndex: 3 },
  { buttonKey: 'meningitis', label: 'Meningitis Rash', symptomSlug: 'meningitis', orderIndex: 4 }
]

export async function GET(request: NextRequest) {
  try {
    let session
    try {
      session = await requireAuth()
      console.log('GET /api/admin/default-highrisk-buttons - Session type:', session.type)
    } catch (authError) {
      console.error('GET /api/admin/default-highrisk-buttons - Auth error:', authError)
      return NextResponse.json(
        { error: 'Unauthorized: No valid session found', details: authError instanceof Error ? authError.message : String(authError) },
        { status: 401 }
      )
    }
    
    // Determine surgery ID based on session type
    let surgeryId: string
    if (session.type === 'surgery') {
      surgeryId = session.surgeryId!
      console.log('GET /api/admin/default-highrisk-buttons - Surgery ID from session:', surgeryId)
    } else if (session.type === 'superuser') {
      // For superusers, get surgery ID from query params
      const url = new URL(request.url)
      const surgerySlug = url.searchParams.get('surgery')
      console.log('GET /api/admin/default-highrisk-buttons - Surgery slug from query:', surgerySlug)
      
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
        console.log('GET /api/admin/default-highrisk-buttons - Surgery not found for slug:', surgerySlug)
        return NextResponse.json(
          { error: 'Surgery not found' },
          { status: 404 }
        )
      }
      surgeryId = surgery.id
      console.log('GET /api/admin/default-highrisk-buttons - Surgery ID from slug:', surgeryId)
    } else {
      console.log('GET /api/admin/default-highrisk-buttons - Unauthorized session type:', session)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get existing configurations for this surgery
    const existingConfigs = await prisma.defaultHighRiskButtonConfig.findMany({
      where: { surgeryId },
      orderBy: { orderIndex: 'asc' }
    })
    
    // Create a map of existing configs by buttonKey
    const configMap = new Map(existingConfigs.map(config => [config.buttonKey, config]))
    
    // Build the response with all default buttons, using existing configs where available
    const buttons = DEFAULT_BUTTONS.map(defaultButton => {
      const existingConfig = configMap.get(defaultButton.buttonKey)
      return {
        id: existingConfig?.id || `default-${defaultButton.buttonKey}`,
        buttonKey: defaultButton.buttonKey,
        label: existingConfig?.label || defaultButton.label,
        symptomSlug: existingConfig?.symptomSlug || defaultButton.symptomSlug,
        isEnabled: existingConfig?.isEnabled ?? true,
        orderIndex: existingConfig?.orderIndex ?? defaultButton.orderIndex
      }
    })
    
    return NextResponse.json(
      { buttons },
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    )
  } catch (error) {
    console.error('Error fetching default high-risk buttons:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Failed to fetch default high-risk buttons', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    let session
    try {
      session = await requireAuth()
    } catch (authError) {
      return NextResponse.json(
        { error: 'Unauthorized: No valid session found' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { buttonKey, label, symptomSlug, isEnabled, orderIndex } = UpdateDefaultHighRiskButtonReqZ.parse(body)

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

    // Check if this is a valid default button key
    const defaultButton = DEFAULT_BUTTONS.find(btn => btn.buttonKey === buttonKey)
    if (!defaultButton) {
      return NextResponse.json(
        { error: 'Invalid default button key' },
        { status: 400 }
      )
    }

    // Find or create the configuration
    const existingConfig = await prisma.defaultHighRiskButtonConfig.findUnique({
      where: {
        surgeryId_buttonKey: {
          surgeryId,
          buttonKey
        }
      }
    })

    if (existingConfig) {
      // Update existing configuration
      const updatedConfig = await prisma.defaultHighRiskButtonConfig.update({
        where: { id: existingConfig.id },
        data: {
          ...(label !== undefined && { label }),
          ...(symptomSlug !== undefined && { symptomSlug }),
          ...(isEnabled !== undefined && { isEnabled }),
          ...(orderIndex !== undefined && { orderIndex })
        }
      })
      
      return NextResponse.json({ button: updatedConfig })
    } else {
      // Create new configuration
      const newConfig = await prisma.defaultHighRiskButtonConfig.create({
        data: {
          surgeryId,
          buttonKey,
          label: label || defaultButton.label,
          symptomSlug: symptomSlug || defaultButton.symptomSlug,
          isEnabled: isEnabled ?? true,
          orderIndex: orderIndex ?? defaultButton.orderIndex
        }
      })
      
      return NextResponse.json({ button: newConfig })
    }
  } catch (error) {
    console.error('Error updating default high-risk button:', error)
    return NextResponse.json(
      { error: 'Failed to update default high-risk button' },
      { status: 500 }
    )
  }
}
