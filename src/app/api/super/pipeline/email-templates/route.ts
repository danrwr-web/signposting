import { NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { DEFAULT_EMAIL_TEMPLATES } from '@/app/super/pipeline/emailTemplateDefaults'

// GET /api/super/pipeline/email-templates — List all templates, seeding defaults if needed
export async function GET() {
  try {
    await requireSuperuser()

    // Ensure all default templates exist (upsert by stage)
    for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
      await prisma.pipelineEmailTemplate.upsert({
        where: { stage: tpl.stage },
        create: {
          stage: tpl.stage,
          label: tpl.label,
          subject: tpl.subject,
          body: tpl.body,
        },
        update: {}, // don't overwrite existing customisations
      })
    }

    const templates = await prisma.pipelineEmailTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(templates)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
