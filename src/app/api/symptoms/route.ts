/**
 * Public API route for symptoms
 * Returns effective symptoms for the current surgery context with optional filtering
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import type { EffectiveSymptom } from '@/lib/api-contracts'

export const runtime = 'nodejs'

async function getSurgeryIdFromContext(req: NextRequest): Promise<string | null> {
  // Try to get surgery from URL search params
  const url = new URL(req.url)
  const surgerySlug = url.searchParams.get('surgery')
  
  if (surgerySlug) {
    const surgery = await prisma.surgery.findUnique({
      where: { slug: surgerySlug },
      select: { id: true }
    })
    return surgery?.id || null
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
    const url = new URL(req.url)
    const letter = url.searchParams.get('letter')
    const searchQuery = url.searchParams.get('q')
    
    const surgeryId = await getSurgeryIdFromContext(req)
    
    let symptoms
    
    if (surgeryId) {
      symptoms = await getEffectiveSymptoms(surgeryId)
    } else {
      // Fallback to base symptoms if no surgery context
      symptoms = await prisma.baseSymptom.findMany({
        select: { 
          id: true, 
          slug: true, 
          name: true, 
          ageGroup: true,
          briefInstruction: true, 
          highlightedText: true, 
          instructions: true, 
          linkToPage: true 
        },
        orderBy: { name: 'asc' }
      }).then(results => 
        results.map(s => ({ ...s, source: 'base' as const }))
      )
    }
    
    // Apply filters
    let filteredSymptoms = symptoms as EffectiveSymptom[]
    
    if (letter && letter !== 'All') {
      filteredSymptoms = filteredSymptoms.filter(symptom => 
        symptom.name.trim().toUpperCase().startsWith(letter.toUpperCase())
      )
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filteredSymptoms = filteredSymptoms.filter(symptom => 
        symptom.name.toLowerCase().includes(query) ||
        (symptom.briefInstruction && symptom.briefInstruction.toLowerCase().includes(query)) ||
        (symptom.instructions && symptom.instructions.toLowerCase().includes(query))
      )
    }
    
    return NextResponse.json(
      { symptoms: filteredSymptoms },
      { 
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=30' }
      }
    )
  } catch (error) {
    console.error('Error fetching symptoms:', error)
    return NextResponse.json(
      { symptoms: [] },
      { 
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=5' }
      }
    )
  }
}