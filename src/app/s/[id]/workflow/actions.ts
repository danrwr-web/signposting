'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAdmin } from '@/lib/rbac'
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

