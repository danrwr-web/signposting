import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const surgeryId = searchParams.get('SurgeryId')
    const templateId = searchParams.get('TemplateId')
    
    if (!surgeryId || !templateId) {
      return NextResponse.json({ error: 'SurgeryId and TemplateId are required' }, { status: 400 })
    }

    // Check admin access
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
      include: {
        nodes: {
          include: {
            answerOptions: true,
          },
        },
        instances: true,
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Delete in transaction to ensure all related data is removed
    await prisma.$transaction(async (tx) => {
      // 1. Delete all answer records that reference nodes or answer options from this template
      const nodeIds = template.nodes.map(n => n.id)
      const answerOptionIds = template.nodes.flatMap(n => n.answerOptions.map(o => o.id))
      
      if (answerOptionIds.length > 0 || nodeIds.length > 0) {
        await tx.workflowAnswerRecord.deleteMany({
          where: {
            OR: [
              { nodeTemplateId: { in: nodeIds } },
              { answerOptionId: { in: answerOptionIds } },
              { instance: { templateId } },
            ],
          },
        })
      }

      // 2. Delete all answer options
      if (answerOptionIds.length > 0) {
        await tx.workflowAnswerOptionTemplate.deleteMany({
          where: { id: { in: answerOptionIds } },
        })
      }

      // 3. Delete all node links (both links FROM nodes in this template, and links TO this template)
      await tx.workflowNodeLink.deleteMany({
        where: {
          OR: [
            { nodeId: { in: nodeIds } },
            { templateId },
          ],
        },
      })

      // 4. Delete all nodes
      if (nodeIds.length > 0) {
        await tx.workflowNodeTemplate.deleteMany({
          where: { id: { in: nodeIds } },
        })
      }

      // 5. Delete all instances
      if (template.instances.length > 0) {
        await tx.workflowInstance.deleteMany({
          where: { templateId },
        })
      }

      // 6. Delete the template itself
      await tx.workflowTemplate.delete({
        where: { id: templateId },
      })
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting workflow template:', error)
    
    if (error instanceof Error && error.message.includes('unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete workflow template' },
      { status: 500 }
    )
  }
}

