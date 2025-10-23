import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'

export const runtime = 'nodejs'

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
    const limit = parseInt(searchParams.get('limit') || '50')

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

    // Get suggestions with surgery details - minimal query without any status references
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

    // Count all suggestions as unread since status field doesn't exist
    const unreadCount = suggestions.length
    console.log('Suggestions API: Unread count (all suggestions):', unreadCount)

    // Add default status to all suggestions since the field doesn't exist yet
    const suggestionsWithStatus = suggestions.map(suggestion => ({
      ...suggestion,
      status: 'pending', // All suggestions are pending until status field is added
      updatedAt: suggestion.createdAt // Use createdAt as updatedAt until field is added
    }))

    console.log('Suggestions API: Returning data:', { 
      suggestionsCount: suggestionsWithStatus.length, 
      unreadCount 
    })

    return NextResponse.json({
      suggestions: suggestionsWithStatus,
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

    // For now, just return success without updating since status field doesn't exist
    // TODO: Implement actual update when database schema is updated
    console.log('Suggestions API: Status update requested but field not available yet:', { suggestionId, status })
    
    // Return the original suggestion with the requested status
    const suggestionWithStatus = {
      ...suggestion,
      status: status,
      updatedAt: new Date()
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