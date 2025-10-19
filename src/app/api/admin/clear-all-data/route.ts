/**
 * API route to clear all symptoms and overrides
 * Superuser only - dangerous operation
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Require superuser authentication
    await requireSuperuser()
    
    const body = await request.json()
    const { confirmText } = body
    
    // Require confirmation text to prevent accidental deletion
    if (confirmText !== 'DELETE ALL DATA') {
      return NextResponse.json(
        { error: 'Confirmation text must be exactly "DELETE ALL DATA"' },
        { status: 400 }
      )
    }
    
    console.log('Superuser initiated clear all data operation')
    
    // Use a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // Delete all surgery symptom overrides
      const deletedOverrides = await tx.surgerySymptomOverride.deleteMany({})
      console.log(`Deleted ${deletedOverrides.count} surgery symptom overrides`)
      
      // Delete all custom symptoms
      const deletedCustomSymptoms = await tx.surgeryCustomSymptom.deleteMany({})
      console.log(`Deleted ${deletedCustomSymptoms.count} custom symptoms`)
      
      // Delete all base symptoms
      const deletedBaseSymptoms = await tx.baseSymptom.deleteMany({})
      console.log(`Deleted ${deletedBaseSymptoms.count} base symptoms`)
      
      // Delete all highlight rules
      const deletedHighlightRules = await tx.highlightRule.deleteMany({})
      console.log(`Deleted ${deletedHighlightRules.count} highlight rules`)
      
      // Delete all high risk links
      const deletedHighRiskLinks = await tx.highRiskLink.deleteMany({})
      console.log(`Deleted ${deletedHighRiskLinks.count} high risk links`)
      
      // Delete all default high risk button configs
      const deletedDefaultButtons = await tx.defaultHighRiskButtonConfig.deleteMany({})
      console.log(`Deleted ${deletedDefaultButtons.count} default high risk button configs`)
    })
    
    console.log('Successfully cleared all symptoms and overrides')
    
    return NextResponse.json({ 
      success: true,
      message: 'All symptoms, overrides, and related data have been cleared successfully'
    })
    
  } catch (error) {
    console.error('Error clearing all data:', error)
    
    if (error instanceof Error && error.message.includes('Superuser access required')) {
      return NextResponse.json(
        { error: 'Superuser access required' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to clear data' },
      { status: 500 }
    )
  }
}
