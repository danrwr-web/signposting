/**
 * Public API route for high-risk button links
 * Returns high-risk links for the current surgery context
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GetHighRiskResZ } from '@/lib/api-contracts'

export const runtime = 'nodejs'

async function getSurgeryIdFromContext(req: NextRequest): Promise<string | null> {
  // Try to get surgery from URL search params
  const url = new URL(req.url)
  const surgeryParam = url.searchParams.get('surgery')
  
  if (surgeryParam) {
    // First try as ID
    const surgeryById = await prisma.surgery.findUnique({
      where: { id: surgeryParam },
      select: { id: true }
    })
    if (surgeryById) {
      return surgeryById.id
    }
    
    // Fallback to slug for backward compatibility
    const surgeryBySlug = await prisma.surgery.findUnique({
      where: { slug: surgeryParam },
      select: { id: true }
    })
    if (surgeryBySlug) {
      return surgeryBySlug.id
    }
  }
  
  // Fallback to default surgery
  const defaultSurgery = await prisma.surgery.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  })
  
  return defaultSurgery?.id || null
}

export async function GET(req: NextRequest) {
  try {
    const surgeryId = await getSurgeryIdFromContext(req)
    
    if (!surgeryId) {
      // No surgery context - return default buttons
      const defaultButtons = [
        { id: 'default-1', label: 'Anaphylaxis', symptomSlug: 'anaphylaxis', symptomId: null, orderIndex: 0 },
        { id: 'default-2', label: 'Stroke', symptomSlug: 'stroke', symptomId: null, orderIndex: 1 },
        { id: 'default-3', label: 'Chest Pain', symptomSlug: 'chest-pain', symptomId: null, orderIndex: 2 },
        { id: 'default-4', label: 'Sepsis', symptomSlug: 'sepsis', symptomId: null, orderIndex: 3 },
        { id: 'default-5', label: 'Meningitis Rash', symptomSlug: 'meningitis', symptomId: null, orderIndex: 4 }
      ]
      
      return NextResponse.json(
        GetHighRiskResZ.parse({ links: defaultButtons }),
        { 
          status: 200,
          headers: { 'Cache-Control': 'private, max-age=30' }
        }
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
        orderIndex: true 
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
      { 
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=30' }
      }
    )
  } catch (error) {
    console.error('Error fetching high-risk links:', error)
    return NextResponse.json(
      GetHighRiskResZ.parse({ links: [] }),
      { 
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=5' }
      }
    )
  }
}