import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Simple test endpoint to check if suggestions table exists and is accessible
export async function GET(request: NextRequest) {
  try {
    console.log('Suggestions test API: Starting test...')
    
    // Test basic database connection
    const suggestionCount = await prisma.suggestion.count()
    console.log('Suggestions test API: Total suggestions in database:', suggestionCount)
    
    // Test getting a few suggestions
    const suggestions = await prisma.suggestion.findMany({
      take: 3,
      include: {
        surgery: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    console.log('Suggestions test API: Sample suggestions:', suggestions.length)
    
    // Status field is not yet in the schema (see TODO in prisma/schema.prisma)
    const hasStatusField = false
    
    return NextResponse.json({
      success: true,
      totalSuggestions: suggestionCount,
      sampleSuggestions: suggestions.length,
      hasStatusField,
      message: 'Suggestions API is working'
    })
  } catch (error) {
    console.error('Suggestions test API: Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
