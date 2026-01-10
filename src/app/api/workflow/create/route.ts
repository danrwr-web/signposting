import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { inferWorkflowIconKey } from '@/components/workflow/icons/inferWorkflowIconKey'
import { isWorkflowIconKey } from '@/components/workflow/icons/workflowIconRegistry'

const querySchema = z.object({
  SurgeryId: z.string().min(1),
})

const formSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  colourHex: z.string().optional(),
  isActive: z.enum(['true', 'false']).default('true'),
  workflowType: z.enum(['PRIMARY', 'SUPPORTING', 'MODULE']).default('SUPPORTING'),
  iconKey: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const { SurgeryId: surgeryId } = querySchema.parse({ SurgeryId: searchParams.get('SurgeryId') })

    // Check admin access
    await requireSurgeryAdmin(surgeryId)

    const formData = await req.formData()
    const parsed = formSchema.parse({
      name: (formData.get('name') as string | null) ?? '',
      description: (formData.get('description') as string | null) ?? undefined,
      colourHex: (formData.get('colourHex') as string | null) ?? undefined,
      isActive: ((formData.get('isActive') as string | null) ?? 'true') as 'true' | 'false',
      workflowType: ((formData.get('workflowType') as string | null) ?? 'SUPPORTING') as
        | 'PRIMARY'
        | 'SUPPORTING'
        | 'MODULE',
      iconKey: (formData.get('iconKey') as string | null) ?? undefined,
    })

    const name = parsed.name.trim()
    const description = parsed.description?.trim() || null
    const colourHex = parsed.colourHex?.trim() || null
    const isActive = parsed.isActive === 'true'
    // Map MODULE to SUPPORTING for backwards compatibility
    const workflowType = parsed.workflowType === 'MODULE' ? 'SUPPORTING' : parsed.workflowType

    if (name.toLowerCase() === 'new workflow') {
      return NextResponse.json(
        { error: 'Please enter a specific workflow name', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }

    const iconKeyRaw = (parsed.iconKey ?? '').trim()
    if (iconKeyRaw && !isWorkflowIconKey(iconKeyRaw)) {
      return NextResponse.json({ error: 'Invalid icon key', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    // Create template
    const template = await prisma.workflowTemplate.create({
      data: {
        surgeryId,
        name,
        description,
        iconKey: iconKeyRaw ? iconKeyRaw : inferWorkflowIconKey({ name, description }),
        isActive,
        colourHex,
        workflowType: workflowType as 'PRIMARY' | 'SUPPORTING' | 'MODULE',
      },
    })

    return NextResponse.json({ templateId: template.id }, { status: 201 })
  } catch (error) {
    console.error('Error creating workflow template:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', code: 'VALIDATION_ERROR', details: error.issues },
        { status: 400 },
      )
    }

    if (error instanceof Error && error.message.includes('unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORISED' }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create workflow template', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

