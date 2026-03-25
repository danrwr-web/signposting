import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateTemplateSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
})

// PATCH /api/super/pipeline/email-templates/[stage] — Update a template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stage: string }> }
) {
  try {
    await requireSuperuser()
    const { stage } = await params

    const existing = await prisma.pipelineEmailTemplate.findUnique({
      where: { stage },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = updateTemplateSchema.parse(body)

    const updated = await prisma.pipelineEmailTemplate.update({
      where: { stage },
      data: {
        subject: data.subject,
        body: data.body,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
