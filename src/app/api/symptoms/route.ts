/**
 * Public API route for symptoms
 * Returns effective symptoms for the current surgery context with optional filtering
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import type { EffectiveSymptom } from '@/lib/api-contracts'
import { checkTestUserUsageLimit } from '@/lib/test-user-limits'
import { unstable_noStore as noStore } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getSurgeryIdFromContext(req: NextRequest): Promise<string | null> {
  // Try to get surgery from URL search params
  const url = new URL(req.url)
  const surgeryParam = url.searchParams.get('surgery')
  
  if (surgeryParam) {
    // Accept both the canonical surgery route id and the legacy human-readable slug.
    const surgeryById = await prisma.surgery.findUnique({
      where: { id: surgeryParam },
      select: { id: true },
    })
    if (surgeryById) return surgeryById.id

    const surgeryBySlug = await prisma.surgery.findUnique({
      where: { slug: surgeryParam },
      select: { id: true },
    })
    return surgeryBySlug?.id || null
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
    // Ensure this route is always fresh (no Next/Vercel caching).
    noStore()

    // Check test user usage limits
    await checkTestUserUsageLimit()
    
    const url = new URL(req.url)
    const letter = url.searchParams.get('letter')
    const searchQuery = url.searchParams.get('q')
    
    const surgeryId = await getSurgeryIdFromContext(req)
    
    let symptoms
    
    if (surgeryId) {
      // Always return fresh effective symptoms so changes (create/enable/delete) are visible immediately.
      symptoms = await getEffectiveSymptoms(surgeryId, false)
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
    
    const response = NextResponse.json({ symptoms: filteredSymptoms })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.error('Error fetching symptoms:', error)
    const response = NextResponse.json({ symptoms: [] })
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
}