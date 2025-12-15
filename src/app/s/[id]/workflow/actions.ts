'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAdmin, requireSurgeryAccess, getSessionUser } from '@/lib/rbac'
import { WorkflowNodeType, WorkflowActionKey } from '@prisma/client'

export interface ActionResult {
  success: boolean
  error?: string
}

export async function createWorkflowTemplate(
  surgeryId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireSurgeryAdmin(surgeryId)

    const name = (formData.get('name') as string) || 'New workflow'

    const template = await prisma.workflowTemplate.create({
      data: {
        surgeryId,
        name,
        description: null,
        isActive: true,
        colourHex: null,
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates`)
    redirect(`/s/${surgeryId}/workflow/templates/${template.id}`)
  } catch (error) {
    console.error('Error creating workflow template:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create template',
    }
  }
}

export async function updateWorkflowTemplate(
  surgeryId: string,
  templateId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const existing = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!existing) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    const name = formData.get('name') as string
    const description = formData.get('description') as string | null
    const isActive = formData.get('isActive') === 'on' || formData.get('isActive') === 'true'
    const colourHex = (formData.get('colourHex') as string) || null

    await prisma.workflowTemplate.update({
      where: { id: templateId },
      data: {
        name,
        description: description || null,
        isActive,
        colourHex: colourHex || null,
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates`)
    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error updating workflow template:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update template',
    }
  }
}

export async function createWorkflowNode(
  surgeryId: string,
  templateId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
      include: { nodes: true },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    // Get max sortOrder and add 1
    const maxSortOrder = template.nodes.length > 0
      ? Math.max(...template.nodes.map(n => n.sortOrder))
      : 0

    const nodeType = (formData.get('nodeType') as WorkflowNodeType) || 'INSTRUCTION'
    const title = (formData.get('title') as string) || 'New node'
    const body = (formData.get('body') as string) || null
    const isStart = formData.get('isStart') === 'on' || formData.get('isStart') === 'true'
    const actionKeyRaw = formData.get('actionKey') as string
    const actionKey = actionKeyRaw && actionKeyRaw !== 'NONE' ? (actionKeyRaw as WorkflowActionKey) : null
    const positionXRaw = formData.get('positionX') as string
    const positionX = positionXRaw ? parseInt(positionXRaw) : null
    const positionYRaw = formData.get('positionY') as string
    const positionY = positionYRaw ? parseInt(positionYRaw) : null

    // If this is the start node, clear isStart on all other nodes
    if (isStart) {
      await prisma.workflowNodeTemplate.updateMany({
        where: {
          templateId,
          isStart: true,
        },
        data: {
          isStart: false,
        },
      })
    }

    await prisma.workflowNodeTemplate.create({
      data: {
        templateId,
        nodeType,
        title,
        body: body || null,
        sortOrder: maxSortOrder + 1,
        isStart,
        actionKey,
        positionX,
        positionY,
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error creating workflow node:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create node',
    }
  }
}

export async function updateWorkflowNode(
  surgeryId: string,
  templateId: string,
  formData: FormData
): Promise<ActionResult> {
  const nodeId = formData.get('nodeId') as string
  if (!nodeId) {
    return { success: false, error: 'Node ID is required' }
  }
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template and node belong to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    const node = await prisma.workflowNodeTemplate.findFirst({
      where: { id: nodeId, templateId },
    })

    if (!node) {
      return {
        success: false,
        error: 'Node not found',
      }
    }

    const sortOrder = parseInt(formData.get('sortOrder') as string) || node.sortOrder
    const nodeType = (formData.get('nodeType') as WorkflowNodeType) || node.nodeType
    const title = formData.get('title') as string
    const body = (formData.get('body') as string) || null
    const isStart = formData.get('isStart') === 'on' || formData.get('isStart') === 'true'
    const actionKeyRaw = formData.get('actionKey') as string
    const actionKey = actionKeyRaw && actionKeyRaw !== 'NONE' ? (actionKeyRaw as WorkflowActionKey) : null
    const positionXRaw = formData.get('positionX') as string
    const positionX = positionXRaw ? parseInt(positionXRaw) : null
    const positionYRaw = formData.get('positionY') as string
    const positionY = positionYRaw ? parseInt(positionYRaw) : null

    // If this is being set as start node, clear isStart on all other nodes
    if (isStart && !node.isStart) {
      await prisma.workflowNodeTemplate.updateMany({
        where: {
          templateId,
          isStart: true,
        },
        data: {
          isStart: false,
        },
      })
    }

    await prisma.workflowNodeTemplate.update({
      where: { id: nodeId },
      data: {
        sortOrder,
        nodeType,
        title,
        body: body || null,
        isStart,
        actionKey,
        positionX,
        positionY,
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error updating workflow node:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update node',
    }
  }
}

export async function deleteWorkflowNode(
  surgeryId: string,
  templateId: string,
  formData: FormData
): Promise<ActionResult> {
  const nodeId = formData.get('nodeId') as string
  if (!nodeId) {
    return { success: false, error: 'Node ID is required' }
  }
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    // Delete node (cascade will handle answer options)
    await prisma.workflowNodeTemplate.delete({
      where: { id: nodeId },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting workflow node:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete node',
    }
  }
}

export async function createWorkflowAnswerOption(
  surgeryId: string,
  templateId: string,
  formData: FormData
): Promise<ActionResult> {
  const nodeId = formData.get('nodeId') as string
  if (!nodeId) {
    return { success: false, error: 'Node ID is required' }
  }
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template and node belong to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    const node = await prisma.workflowNodeTemplate.findFirst({
      where: { id: nodeId, templateId },
    })

    if (!node) {
      return {
        success: false,
        error: 'Node not found',
      }
    }

    const label = formData.get('label') as string
    const valueKey = formData.get('valueKey') as string
    const description = (formData.get('description') as string) || null
    const nextNodeIdRaw = formData.get('nextNodeId') as string
    const nextNodeId = nextNodeIdRaw && nextNodeIdRaw !== 'NONE' ? nextNodeIdRaw : null
    const actionKeyRaw = formData.get('actionKey') as string
    const actionKey = actionKeyRaw && actionKeyRaw !== 'NONE' ? (actionKeyRaw as WorkflowActionKey) : null

    // Check if valueKey is unique for this node
    const existing = await prisma.workflowAnswerOptionTemplate.findFirst({
      where: {
        nodeId,
        valueKey,
      },
    })

    if (existing) {
      return {
        success: false,
        error: `Value key "${valueKey}" already exists for this node`,
      }
    }

    await prisma.workflowAnswerOptionTemplate.create({
      data: {
        nodeId,
        label,
        valueKey,
        description: description || null,
        nextNodeId,
        actionKey,
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error creating workflow answer option:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create answer option',
    }
  }
}

export async function updateWorkflowAnswerOption(
  surgeryId: string,
  templateId: string,
  formData: FormData
): Promise<ActionResult> {
  const optionId = formData.get('optionId') as string
  if (!optionId) {
    return { success: false, error: 'Option ID is required' }
  }
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    const option = await prisma.workflowAnswerOptionTemplate.findFirst({
      where: { id: optionId },
      include: { node: true },
    })

    if (!option || option.node.templateId !== templateId) {
      return {
        success: false,
        error: 'Answer option not found',
      }
    }

    const label = formData.get('label') as string
    const valueKey = formData.get('valueKey') as string
    const description = (formData.get('description') as string) || null
    const nextNodeIdRaw = formData.get('nextNodeId') as string
    const nextNodeId = nextNodeIdRaw && nextNodeIdRaw !== 'NONE' ? nextNodeIdRaw : null
    const actionKeyRaw = formData.get('actionKey') as string
    const actionKey = actionKeyRaw && actionKeyRaw !== 'NONE' ? (actionKeyRaw as WorkflowActionKey) : null

    // Check if valueKey is unique for this node (excluding current option)
    if (valueKey !== option.valueKey) {
      const existing = await prisma.workflowAnswerOptionTemplate.findFirst({
        where: {
          nodeId: option.nodeId,
          valueKey,
          NOT: { id: optionId },
        },
      })

      if (existing) {
        return {
          success: false,
          error: `Value key "${valueKey}" already exists for this node`,
        }
      }
    }

    await prisma.workflowAnswerOptionTemplate.update({
      where: { id: optionId },
      data: {
        label,
        valueKey,
        description: description || null,
        nextNodeId,
        actionKey,
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error updating workflow answer option:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update answer option',
    }
  }
}

export interface CreateNodeResult {
  success: boolean
  error?: string
  node?: {
    id: string
    nodeType: WorkflowNodeType
    title: string
    body: string | null
    sortOrder: number
    positionX: number | null
    positionY: number | null
    actionKey: WorkflowActionKey | null
  }
}

export interface CreateAnswerOptionResult {
  success: boolean
  error?: string
  option?: {
    id: string
    label: string
    valueKey: string
    nextNodeId: string | null
    actionKey: WorkflowActionKey | null
  }
}

// Helper to slugify a label into a valueKey
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function createWorkflowNodeForTemplate(
  surgeryId: string,
  templateId: string,
  nodeType: WorkflowNodeType,
  title?: string
): Promise<CreateNodeResult> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
      include: { nodes: true },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    // Get max sortOrder and add 1
    const maxSortOrder = template.nodes.length > 0
      ? Math.max(...template.nodes.map(n => n.sortOrder))
      : 0

    // Default titles based on node type
    const defaultTitle = title || (
      nodeType === 'INSTRUCTION' ? 'New instruction' :
      nodeType === 'QUESTION' ? 'New question' :
      'New outcome'
    )

    const node = await prisma.workflowNodeTemplate.create({
      data: {
        templateId,
        nodeType,
        title: defaultTitle,
        body: null,
        sortOrder: maxSortOrder + 1,
        isStart: false,
        actionKey: null,
        positionX: null,
        positionY: null,
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    
    return {
      success: true,
      node: {
        id: node.id,
        nodeType: node.nodeType,
        title: node.title,
        body: node.body,
        sortOrder: node.sortOrder,
        positionX: node.positionX,
        positionY: node.positionY,
        actionKey: node.actionKey,
      },
    }
  } catch (error) {
    console.error('Error creating workflow node:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create node',
    }
  }
}

export async function createWorkflowAnswerOptionForDiagram(
  surgeryId: string,
  templateId: string,
  fromNodeId: string,
  toNodeId: string,
  label: string,
  sourceHandle: string = 'source-bottom',
  targetHandle: string = 'target-top'
): Promise<CreateAnswerOptionResult> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    // Verify fromNode belongs to template
    const fromNode = await prisma.workflowNodeTemplate.findFirst({
      where: { id: fromNodeId, templateId },
    })

    if (!fromNode) {
      return {
        success: false,
        error: 'Source node not found',
      }
    }

    // Verify toNode belongs to template
    const toNode = await prisma.workflowNodeTemplate.findFirst({
      where: { id: toNodeId, templateId },
    })

    if (!toNode) {
      return {
        success: false,
        error: 'Target node not found',
      }
    }

    // Generate valueKey from label, or use safe default if label is empty
    let valueKey: string
    if (!label || label.trim() === '') {
      // Use a safe default for empty labels - generate unique ID
      const { randomUUID } = await import('crypto')
      valueKey = `path_${randomUUID().substring(0, 8)}`
    } else {
      valueKey = slugify(label)
      // If slugify returns empty (e.g., only special chars), fall back to UUID
      if (!valueKey || valueKey.trim() === '') {
        const { randomUUID } = await import('crypto')
        valueKey = `path_${randomUUID().substring(0, 8)}`
      }
    }
    
    // Ensure uniqueness for this node
    let counter = 1
    const baseValueKey = valueKey
    while (true) {
      const existing = await prisma.workflowAnswerOptionTemplate.findFirst({
        where: {
          nodeId: fromNodeId,
          valueKey,
        },
      })
      if (!existing) break
      valueKey = `${baseValueKey}_${counter}`
      counter++
    }

    const option = await prisma.workflowAnswerOptionTemplate.create({
      data: {
        nodeId: fromNodeId,
        label,
        valueKey,
        description: null,
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
        nextNodeId: toNodeId,
        actionKey: null,
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    
    return {
      success: true,
      option: {
        id: option.id,
        label: option.label,
        valueKey: option.valueKey,
        nextNodeId: option.nextNodeId,
        actionKey: option.actionKey,
      },
    }
  } catch (error) {
    console.error('Error creating workflow answer option:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create answer option',
    }
  }
}

export async function updateWorkflowAnswerOptionLabel(
  surgeryId: string,
  templateId: string,
  optionId: string,
  label: string
): Promise<ActionResult> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    const option = await prisma.workflowAnswerOptionTemplate.findFirst({
      where: { id: optionId },
      include: { node: true },
    })

    if (!option || option.node.templateId !== templateId) {
      return {
        success: false,
        error: 'Answer option not found',
      }
    }

    // Generate new valueKey from label
    let valueKey = slugify(label)
    
    // Ensure uniqueness for this node (excluding current option)
    let counter = 1
    const baseValueKey = valueKey
    while (true) {
      const existing = await prisma.workflowAnswerOptionTemplate.findFirst({
        where: {
          nodeId: option.nodeId,
          valueKey,
          NOT: { id: optionId },
        },
      })
      if (!existing) break
      valueKey = `${baseValueKey}_${counter}`
      counter++
    }

    await prisma.workflowAnswerOptionTemplate.update({
      where: { id: optionId },
      data: {
        label,
        valueKey,
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    
    return { success: true }
  } catch (error) {
    console.error('Error updating workflow answer option label:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update answer option',
    }
  }
}

export async function deleteWorkflowAnswerOptionById(
  surgeryId: string,
  templateId: string,
  optionId: string
): Promise<ActionResult> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    const option = await prisma.workflowAnswerOptionTemplate.findFirst({
      where: { id: optionId },
      include: { node: true },
    })

    if (!option || option.node.templateId !== templateId) {
      return {
        success: false,
        error: 'Answer option not found',
      }
    }

    await prisma.workflowAnswerOptionTemplate.delete({
      where: { id: optionId },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting workflow answer option:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete answer option',
    }
  }
}

export async function deleteWorkflowNodeById(
  surgeryId: string,
  templateId: string,
  nodeId: string
): Promise<ActionResult> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    const node = await prisma.workflowNodeTemplate.findFirst({
      where: { id: nodeId, templateId },
    })

    if (!node) {
      return {
        success: false,
        error: 'Node not found',
      }
    }

    // Delete related records first (no cascade delete configured in schema)
    // 1. Delete answer records that reference this node's answer options
    const answerOptions = await prisma.workflowAnswerOptionTemplate.findMany({
      where: { nodeId },
      select: { id: true },
    })
    
    if (answerOptions.length > 0) {
      const answerOptionIds = answerOptions.map(opt => opt.id)
      await prisma.workflowAnswerRecord.deleteMany({
        where: {
          OR: [
            { answerOptionId: { in: answerOptionIds } },
            { nodeTemplateId: nodeId },
          ],
        },
      })
    } else {
      // Still delete answer records that reference the node directly
      await prisma.workflowAnswerRecord.deleteMany({
        where: { nodeTemplateId: nodeId },
      })
    }
    
    // 2. Delete answer options
    await prisma.workflowAnswerOptionTemplate.deleteMany({
      where: { nodeId },
    })
    
    // 3. Delete the node
    await prisma.workflowNodeTemplate.delete({
      where: { id: nodeId },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting workflow node:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete node',
    }
  }
}

export async function updateWorkflowNodeForDiagram(
  surgeryId: string,
  templateId: string,
  nodeId: string,
  title: string,
  body: string | null,
  actionKey: WorkflowActionKey | null,
  linkedWorkflows?: Array<{ id?: string; toTemplateId: string; label?: string; sortOrder?: number }>
): Promise<ActionResult> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template and node belong to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    const node = await prisma.workflowNodeTemplate.findFirst({
      where: { id: nodeId, templateId },
    })

    if (!node) {
      return {
        success: false,
        error: 'Node not found',
      }
    }

    // Validate linked workflows if provided
    if (linkedWorkflows !== undefined) {
      // Check all linked templates belong to same surgery and no self-links
      for (const link of linkedWorkflows) {
        const linkedTemplate = await prisma.workflowTemplate.findFirst({
          where: { id: link.toTemplateId, surgeryId },
        })

        if (!linkedTemplate) {
          return {
            success: false,
            error: `Linked template ${link.toTemplateId} not found or does not belong to this surgery`,
          }
        }

        if (link.toTemplateId === templateId) {
          return {
            success: false,
            error: 'Cannot link to the same workflow template',
          }
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // Update node fields
      await tx.workflowNodeTemplate.update({
        where: { id: nodeId },
        data: {
          title,
          body: body || null,
          actionKey,
        },
      })

      // Replace all linked workflows if provided
      if (linkedWorkflows !== undefined) {
        // Delete existing links
        await tx.workflowNodeLink.deleteMany({
          where: { nodeId },
        })

        // Insert new links with sortOrder
        if (linkedWorkflows.length > 0) {
          await tx.workflowNodeLink.createMany({
            data: linkedWorkflows.map((link, index) => ({
              nodeId,
              templateId: link.toTemplateId,
              label: link.label || 'Open linked workflow',
              sortOrder: link.sortOrder ?? index,
            })),
          })
        }
      }
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    
    return { success: true }
  } catch (error) {
    console.error('Error updating workflow node:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update node',
    }
  }
}

export async function createWorkflowNodeLink(
  surgeryId: string,
  templateId: string,
  nodeId: string,
  linkedTemplateId: string,
  label: string
): Promise<ActionResult & { link?: any }> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template and node belong to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    const node = await prisma.workflowNodeTemplate.findFirst({
      where: { id: nodeId, templateId },
    })

    if (!node) {
      return {
        success: false,
        error: 'Node not found',
      }
    }

    // Verify linked template belongs to same surgery
    const linkedTemplate = await prisma.workflowTemplate.findFirst({
      where: { id: linkedTemplateId, surgeryId },
    })

    if (!linkedTemplate) {
      return {
        success: false,
        error: 'Linked template not found or does not belong to this surgery',
      }
    }

    // Check if link already exists
    const existingLink = await prisma.workflowNodeLink.findFirst({
      where: {
        nodeId,
        templateId: linkedTemplateId,
      },
    })

    if (existingLink) {
      return {
        success: false,
        error: 'Link to this workflow already exists',
      }
    }

    // Get max sortOrder for this node
    const maxSortOrder = await prisma.workflowNodeLink.aggregate({
      where: { nodeId },
      _max: { sortOrder: true },
    })

    const link = await prisma.workflowNodeLink.create({
      data: {
        nodeId,
        templateId: linkedTemplateId,
        label: label || 'Open linked workflow',
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    
    return { success: true, link }
  } catch (error) {
    console.error('Error creating workflow node link:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create link',
    }
  }
}

export async function deleteWorkflowNodeLink(
  surgeryId: string,
  templateId: string,
  linkId: string
): Promise<ActionResult> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    // Verify link belongs to a node in this template
    const link = await prisma.workflowNodeLink.findFirst({
      where: { id: linkId },
      include: {
        node: true,
      },
    })

    if (!link || link.node.templateId !== templateId) {
      return {
        success: false,
        error: 'Link not found',
      }
    }

    await prisma.workflowNodeLink.delete({
      where: { id: linkId },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting workflow node link:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete link',
    }
  }
}

export async function updateWorkflowNodePosition(
  surgeryId: string,
  templateId: string,
  nodeId: string,
  positionX: number,
  positionY: number
): Promise<ActionResult> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template and node belong to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    const node = await prisma.workflowNodeTemplate.findFirst({
      where: { id: nodeId, templateId },
    })

    if (!node) {
      return {
        success: false,
        error: 'Node not found',
      }
    }

    await prisma.workflowNodeTemplate.update({
      where: { id: nodeId },
      data: {
        positionX: Math.round(positionX),
        positionY: Math.round(positionY),
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    
    return { success: true }
  } catch (error) {
    console.error('Error updating workflow node position:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update node position',
    }
  }
}

export async function bulkUpdateWorkflowNodePositions(
  surgeryId: string,
  templateId: string,
  updates: Array<{ nodeId: string; positionX: number; positionY: number }>
): Promise<ActionResult> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    // Verify all nodes belong to the template
    const nodeIds = updates.map(u => u.nodeId)
    const nodes = await prisma.workflowNodeTemplate.findMany({
      where: {
        id: { in: nodeIds },
        templateId,
      },
      select: { id: true },
    })

    const foundNodeIds = new Set(nodes.map(n => n.id))
    const missingNodeIds = nodeIds.filter(id => !foundNodeIds.has(id))

    if (missingNodeIds.length > 0) {
      console.error('Missing node IDs:', missingNodeIds)
      console.error('Requested node IDs:', nodeIds)
      console.error('Found node IDs:', Array.from(foundNodeIds))
      return {
        success: false,
        error: `Some nodes not found in template: ${missingNodeIds.join(', ')}`,
      }
    }

    // Only update nodes that were found (filter out any that don't exist)
    const validUpdates = updates.filter(u => foundNodeIds.has(u.nodeId))

    // Update all positions in a transaction
    await prisma.$transaction(
      validUpdates.map((update) =>
        prisma.workflowNodeTemplate.update({
          where: { id: update.nodeId },
          data: {
            positionX: Math.round(update.positionX),
            positionY: Math.round(update.positionY),
          },
        })
      )
    )

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    
    return { success: true }
  } catch (error) {
    console.error('Error bulk updating workflow node positions:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update node positions',
    }
  }
}

export async function deleteWorkflowAnswerOption(
      surgeryId: string,
      templateId: string,
      formData: FormData
    ): Promise<ActionResult> {
  const optionId = formData.get('optionId') as string
  if (!optionId) {
    return { success: false, error: 'Option ID is required' }
  }
  try {
    await requireSurgeryAdmin(surgeryId)

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      }
    }

    const option = await prisma.workflowAnswerOptionTemplate.findFirst({
      where: { id: optionId },
      include: { node: true },
    })

    if (!option || option.node.templateId !== templateId) {
      return {
        success: false,
        error: 'Answer option not found',
      }
    }

    await prisma.workflowAnswerOptionTemplate.delete({
      where: { id: optionId },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting workflow answer option:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete answer option',
    }
  }
}

// Workflow Runner Actions

export async function startWorkflowInstance(
  surgeryId: string,
  formData: FormData
): Promise<ActionResult & { instanceId?: string }> {
  try {
    const user = await requireSurgeryAccess(surgeryId)

    const templateId = formData.get('templateId') as string
    const reference = (formData.get('reference') as string) || null
    const category = (formData.get('category') as string) || null

    if (!templateId) {
      return {
        success: false,
        error: 'Template ID is required',
      }
    }

    // Verify template belongs to surgery and is active
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        id: templateId,
        surgeryId,
        isActive: true,
      },
      include: {
        nodes: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found or inactive',
      }
    }

    // Find start node or first node
    let startNode = template.nodes.find((n) => n.isStart)
    if (!startNode && template.nodes.length > 0) {
      startNode = template.nodes[0] // lowest sortOrder
    }

    if (!startNode) {
      return {
        success: false,
        error: 'Template has no nodes',
      }
    }

    // Create instance
    const instance = await prisma.workflowInstance.create({
      data: {
        surgeryId,
        templateId,
        startedById: user.id,
        status: 'ACTIVE',
        reference,
        category,
        currentNodeId: startNode.id,
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/instances`)
    
    return {
      success: true,
      instanceId: instance.id,
    }
  } catch (error) {
    console.error('Error starting workflow instance:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start workflow instance',
    }
  }
}

export async function continueFromInstructionNode(
  surgeryId: string,
  instanceId: string,
  formData: FormData
): Promise<ActionResult & { nextNodeId?: string }> {
  try {
    await requireSurgeryAccess(surgeryId)

    // Verify instance belongs to surgery
    const instance = await prisma.workflowInstance.findFirst({
      where: {
        id: instanceId,
        surgeryId,
      },
      include: {
        template: {
          include: {
            nodes: {
              orderBy: {
                sortOrder: 'asc',
              },
              include: {
                answerOptions: true,
              },
            },
          },
        },
      },
    })

    if (!instance || !instance.currentNodeId) {
      return {
        success: false,
        error: 'Instance or current node not found',
      }
    }

    const currentNode = instance.template.nodes.find((n) => n.id === instance.currentNodeId)
    if (!currentNode || currentNode.nodeType !== 'INSTRUCTION') {
      return {
        success: false,
        error: 'Current node is not an instruction node',
      }
    }

    // Find next node
    // First check if instruction node has an answer option with nextNodeId (edge case)
    let nextNodeId: string | null = null
    if (currentNode.answerOptions.length > 0 && currentNode.answerOptions[0].nextNodeId) {
      nextNodeId = currentNode.answerOptions[0].nextNodeId
    } else {
      // Move to next highest sortOrder node
      const currentNodeIndex = instance.template.nodes.findIndex((n) => n.id === currentNode.id)
      if (currentNodeIndex < instance.template.nodes.length - 1) {
        nextNodeId = instance.template.nodes[currentNodeIndex + 1].id
      }
    }

    if (!nextNodeId) {
      // No next node - mark as completed
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          currentNodeId: null,
        },
      })
    } else {
      // Update to next node
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          currentNodeId: nextNodeId,
        },
      })
    }

    revalidatePath(`/s/${surgeryId}/workflow/instances/${instanceId}`)

    return {
      success: true,
      nextNodeId: nextNodeId || undefined,
    }
  } catch (error) {
    console.error('Error continuing from instruction node:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to continue workflow',
    }
  }
}

export async function answerQuestionNode(
  surgeryId: string,
  instanceId: string,
  formData: FormData
): Promise<ActionResult & { completed?: boolean; actionKey?: string }> {
  try {
    await requireSurgeryAccess(surgeryId)

    const answerOptionId = formData.get('answerOptionId') as string
    const freeTextNote = (formData.get('freeTextNote') as string) || null

    if (!answerOptionId) {
      return {
        success: false,
        error: 'Answer option ID is required',
      }
    }

    // Verify instance belongs to surgery
    const instance = await prisma.workflowInstance.findFirst({
      where: {
        id: instanceId,
        surgeryId,
      },
      include: {
        template: {
          include: {
            nodes: {
              include: {
                answerOptions: true,
              },
            },
          },
        },
      },
    })

    if (!instance || !instance.currentNodeId) {
      return {
        success: false,
        error: 'Instance or current node not found',
      }
    }

    const currentNode = instance.template.nodes.find((n) => n.id === instance.currentNodeId)
    if (!currentNode || currentNode.nodeType !== 'QUESTION') {
      return {
        success: false,
        error: 'Current node is not a question node',
      }
    }

    const answerOption = currentNode.answerOptions.find((o) => o.id === answerOptionId)
    if (!answerOption) {
      return {
        success: false,
        error: 'Answer option not found',
      }
    }

    // Create answer record
    await prisma.workflowAnswerRecord.create({
      data: {
        instanceId,
        nodeTemplateId: currentNode.id,
        answerOptionId: answerOption.id,
        answerValueKey: answerOption.valueKey,
        freeTextNote,
      },
    })

    // Determine next action
    let nextNodeId: string | null = answerOption.nextNodeId
    const actionKey = answerOption.actionKey

    // Update instance
    if (nextNodeId) {
      // Move to next node
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          currentNodeId: nextNodeId,
        },
      })
    } else if (actionKey) {
      // No next node but has action - complete
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          currentNodeId: null,
        },
      })
    } else {
      // No next node and no action - mark completed anyway
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          currentNodeId: null,
        },
      })
    }

    revalidatePath(`/s/${surgeryId}/workflow/instances/${instanceId}`)

    return {
      success: true,
      completed: !nextNodeId,
      actionKey: actionKey || undefined,
    }
  } catch (error) {
    console.error('Error answering question node:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record answer',
    }
  }
}

