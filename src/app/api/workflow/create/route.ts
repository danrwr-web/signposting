import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const surgeryId = searchParams.get('SurgeryId')
    
    if (!surgeryId) {
      return NextResponse.json({ error: 'SurgeryId is required' }, { status: 400 })
    }

    // Check admin access
    await requireSurgeryAdmin(surgeryId)

    const formData = await req.formData()
    const name = (formData.get('name') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const colourHex = (formData.get('colourHex') as string)?.trim() || null
    const isActive = formData.get('isActive') === 'true'
    const workflowType = (formData.get('workflowType') as string) || 'SUPPORTING'

    // Validation
    if (!name || name.length === 0) {
      return NextResponse.json({ error: 'Workflow name is required' }, { status: 400 })
    }
    if (name.toLowerCase() === 'new workflow') {
      return NextResponse.json({ error: 'Please enter a specific workflow name' }, { status: 400 })
    }

    // Validate workflow type
    const validTypes = ['PRIMARY', 'SUPPORTING', 'MODULE']
    if (!validTypes.includes(workflowType)) {
      return NextResponse.json({ error: 'Invalid workflow type' }, { status: 400 })
    }

    // Create template
    const template = await prisma.workflowTemplate.create({
      data: {
        surgeryId,
        name,
        description,
        isActive,
        colourHex,
        workflowType: workflowType as 'PRIMARY' | 'SUPPORTING' | 'MODULE',
      },
    })

    return NextResponse.json({ templateId: template.id }, { status: 201 })
  } catch (error) {
    console.error('Error creating workflow template:', error)
    
    if (error instanceof Error && error.message.includes('unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create workflow template' },
      { status: 500 }
    )
  }
}

