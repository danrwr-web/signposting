import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'

export const runtime = 'nodejs'

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      console.log('Suggestions API: No authenticated user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Suggestions API: User authenticated:', { 
      id: user.id, 
      email: user.email, 
      globalRole: user.globalRole,
      memberships: user.memberships?.length || 0
    })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'pending', 'actioned', 'discarded', or null for all
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log('Suggestions API: Requested status filter:', status)

    // Build where clause based on user role
    const where: any = {}
    
    if (user.globalRole === 'SUPERUSER') {
      // Superusers see all suggestions
      console.log('Suggestions API: Superuser access - showing all suggestions')
    } else {
      // Surgery admins see only their surgery's suggestions
      const surgeryIds = user.memberships
        .filter(m => m.role === 'ADMIN')
        .map(m => m.surgeryId)
      
      console.log('Suggestions API: Surgery admin access - surgery IDs:', surgeryIds)
      
      if (surgeryIds.length === 0) {
        console.log('Suggestions API: No admin surgeries found')
        return NextResponse.json({ suggestions: [], unreadCount: 0 })
      }
      
      where.surgeryId = { in: surgeryIds }
    }

    console.log('Suggestions API: Query where clause:', where)

    // Get suggestions with surgery details - we'll filter by status after parsing
    const suggestions = await prisma.suggestion.findMany({
      where,
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
      },
      take: limit
    })

    console.log('Suggestions API: Found suggestions:', suggestions.length)

    // Parse status information from text field (temporary workaround)
    const suggestionsWithStatus = suggestions.map(suggestion => {
      let status = 'pending'
      let originalText = suggestion.text
      let updatedAt = suggestion.createdAt
      let auditTrail = []
      
      // Check if the text contains status information
      try {
        const parsedText = JSON.parse(suggestion.text)
        if (parsedText.originalText && parsedText.status) {
          status = parsedText.status
          originalText = parsedText.originalText
          updatedAt = parsedText.updatedAt ? new Date(parsedText.updatedAt) : suggestion.createdAt
          auditTrail = parsedText.auditTrail || []
        }
      } catch {
        // Text is not JSON, so it's a regular suggestion with pending status
        status = 'pending'
        originalText = suggestion.text
        updatedAt = suggestion.createdAt
        auditTrail = []
      }
      
      return {
        ...suggestion,
        text: originalText, // Return the original text to frontend
        status: status,
        updatedAt: updatedAt.toISOString(),
        auditTrail: auditTrail
      }
    })

    // Apply status filter if requested
    let filteredSuggestions = suggestionsWithStatus
    if (status && status !== 'all') {
      filteredSuggestions = suggestionsWithStatus.filter(s => s.status === status)
      console.log(`Suggestions API: Filtered by status '${status}':`, filteredSuggestions.length)
    }

    // Count only pending suggestions as unread (from all suggestions, not filtered)
    const unreadCount = suggestionsWithStatus.filter(s => s.status === 'pending').length
    console.log('Suggestions API: Unread count (pending suggestions):', unreadCount)

    console.log('Suggestions API: Returning data:', { 
      suggestionsCount: filteredSuggestions.length, 
      unreadCount,
      statusFilter: status
    })

    return NextResponse.json({
      suggestions: filteredSuggestions,
      unreadCount
    })
  } catch (error) {
    console.error('Suggestions API: Error fetching suggestions:', error)
    console.error('Suggestions API: Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Failed to fetch suggestions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      console.log('Suggestions API: No authenticated user for POST')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { surgeryId, baseId, symptom, userEmail, text } = body

    // Validate required fields
    if (!symptom || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: symptom and text are required' },
        { status: 400 }
      )
    }

    console.log('Suggestions API: Creating suggestion:', { 
      surgeryId, 
      baseId, 
      symptom, 
      userEmail, 
      textLength: text.length,
      userId: user.id 
    })

    // Check if user has permission to create suggestions for this surgery
    if (surgeryId && user.globalRole !== 'SUPERUSER') {
      const hasPermission = user.memberships.some(
        m => m.surgeryId === surgeryId && (m.role === 'ADMIN' || m.role === 'STANDARD')
      )
      
      if (!hasPermission) {
        console.log('Suggestions API: User lacks permission for surgery:', surgeryId)
        return NextResponse.json(
          { error: 'Insufficient permissions for this surgery' },
          { status: 403 }
        )
      }
    }

    // Create the suggestion
    const suggestion = await prisma.suggestion.create({
      data: {
        surgeryId: surgeryId || null,
        baseId: baseId || null,
        symptom,
        userEmail: userEmail || user.email,
        text,
        // Note: status and updatedAt fields are commented out in schema
      },
      include: {
        surgery: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        }
      }
    })

    console.log('Suggestions API: Created suggestion:', suggestion.id)

    // Add default status for response compatibility
    const suggestionWithStatus = {
      ...suggestion,
      status: 'pending', // All suggestions are pending until status field is added
      updatedAt: suggestion.createdAt // Use createdAt as updatedAt until field is added
    }

    return NextResponse.json({ 
      suggestion: suggestionWithStatus,
      message: 'Suggestion created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Suggestions API: Error creating suggestion:', error)
    console.error('Suggestions API: Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Failed to create suggestion', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      console.log('Suggestions API: No authenticated user for DELETE')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const suggestionId = searchParams.get('id')

    if (suggestionId) {
      // Delete a single suggestion
      return await deleteSingleSuggestion(request, suggestionId, user)
    } else {
      // Clear all suggestions (existing functionality)
      return await clearAllSuggestions(request, user)
    }
  } catch (error) {
    console.error('Suggestions API: Error in DELETE:', error)
    return NextResponse.json(
      { error: 'Failed to delete suggestion', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function deleteSingleSuggestion(request: NextRequest, suggestionId: string, user: any) {
  try {
    console.log('Suggestions API: Deleting single suggestion:', suggestionId)

    // Check if user has permission to delete this suggestion
    const suggestion = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
      include: {
        surgery: true
      }
    })

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (user.globalRole !== 'SUPERUSER') {
      const hasPermission = user.memberships.some(
        m => m.surgeryId === suggestion.surgeryId && m.role === 'ADMIN'
      )
      
      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }
    }

    // Delete the suggestion
    await prisma.suggestion.delete({
      where: { id: suggestionId }
    })

    console.log('Suggestions API: Suggestion deleted successfully:', suggestionId)

    return NextResponse.json({ 
      message: 'Suggestion deleted successfully',
      deletedId: suggestionId
    })

  } catch (error) {
    console.error('Suggestions API: Error deleting single suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to delete suggestion', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function clearAllSuggestions(request: NextRequest, user: any) {
  try {
    console.log('Suggestions API: Clearing suggestions for user:', { 
      id: user.id, 
      email: user.email, 
      globalRole: user.globalRole 
    })

    // Build where clause based on user role
    const where: any = {}
    
    if (user.globalRole === 'SUPERUSER') {
      // Superusers can clear all suggestions
      console.log('Suggestions API: Superuser clearing all suggestions')
    } else {
      // Surgery admins can only clear their surgery's suggestions
      const surgeryIds = user.memberships
        .filter(m => m.role === 'ADMIN')
        .map(m => m.surgeryId)
      
      console.log('Suggestions API: Surgery admin clearing suggestions for surgery IDs:', surgeryIds)
      
      if (surgeryIds.length === 0) {
        console.log('Suggestions API: No admin surgeries found for clearing')
        return NextResponse.json({ suggestions: [], deletedCount: 0 })
      }
      
      where.surgeryId = { in: surgeryIds }
    }

    // Delete suggestions based on user permissions
    const deleteResult = await prisma.suggestion.deleteMany({
      where
    })

    console.log('Suggestions API: Deleted suggestions:', deleteResult.count)

    return NextResponse.json({ 
      message: 'Suggestions cleared successfully',
      deletedCount: deleteResult.count
    })

  } catch (error) {
    console.error('Suggestions API: Error clearing suggestions:', error)
    console.error('Suggestions API: Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Failed to clear suggestions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { suggestionId, status } = body

    if (!suggestionId || !status) {
      return NextResponse.json(
        { error: 'Missing suggestionId or status' },
        { status: 400 }
      )
    }

    if (!['pending', 'actioned', 'discarded'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be pending, actioned, or discarded' },
        { status: 400 }
      )
    }

    // Check if user has permission to update this suggestion
    const suggestion = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
      include: {
        surgery: true
      }
    })

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (user.globalRole !== 'SUPERUSER') {
      const hasPermission = user.memberships.some(
        m => m.surgeryId === suggestion.surgeryId && m.role === 'ADMIN'
      )
      
      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }
    }

    // Since the status field doesn't exist in the database yet, we'll use a workaround:
    // We'll store the status in the text field as a JSON object with the original text, status, and audit trail
    // This is a temporary solution until the database schema is updated
    
    let updatedText = suggestion.text
    
    // Check if the text already contains status information
    try {
      const parsedText = JSON.parse(suggestion.text)
      if (parsedText.originalText && parsedText.status) {
        // Update existing status with audit trail
        const auditTrail = parsedText.auditTrail || []
        auditTrail.push({
          action: status,
          userEmail: user.email,
          timestamp: new Date().toISOString()
        })
        
        updatedText = JSON.stringify({
          originalText: parsedText.originalText,
          status: status,
          updatedAt: new Date().toISOString(),
          auditTrail: auditTrail
        })
      } else {
        // Add status to original text with initial audit entry
        updatedText = JSON.stringify({
          originalText: suggestion.text,
          status: status,
          updatedAt: new Date().toISOString(),
          auditTrail: [{
            action: status,
            userEmail: user.email,
            timestamp: new Date().toISOString()
          }]
        })
      }
    } catch {
      // Text is not JSON, so add status information with initial audit entry
      updatedText = JSON.stringify({
        originalText: suggestion.text,
        status: status,
        updatedAt: new Date().toISOString(),
        auditTrail: [{
          action: status,
          userEmail: user.email,
          timestamp: new Date().toISOString()
        }]
      })
    }

    // Update the suggestion with the new text containing status information
    const updatedSuggestion = await prisma.suggestion.update({
      where: { id: suggestionId },
      data: {
        text: updatedText
      },
      include: {
        surgery: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        }
      }
    })

    console.log('Suggestions API: Status updated successfully:', { suggestionId, status })

    // Return the suggestion with the proper status for frontend compatibility
    const suggestionWithStatus = {
      ...updatedSuggestion,
      text: JSON.parse(updatedText).originalText, // Return original text to frontend
      status: status,
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json({ suggestion: suggestionWithStatus })
  } catch (error) {
    console.error('Error updating suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to update suggestion' },
      { status: 500 }
    )
  }
}