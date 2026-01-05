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

    const name = (formData.get('name') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const colourHex = (formData.get('colourHex') as string)?.trim() || null
    const isActive = formData.get('isActive') === 'on' || formData.get('isActive') === 'true'
    const workflowType = (formData.get('workflowType') as string) || 'SUPPORTING'

    // Validation
    if (!name || name.length === 0) {
      return {
        success: false,
        error: 'Workflow name is required',
      }
    }
    if (name.toLowerCase() === 'new workflow') {
      return {
        success: false,
        error: 'Please enter a specific workflow name',
      }
    }

    // Validate workflow type
    const validTypes = ['PRIMARY', 'SUPPORTING', 'MODULE']
    if (!validTypes.includes(workflowType)) {
      return {
        success: false,
        error: 'Invalid workflow type',
      }
    }

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

    revalidatePath(`/s/${surgeryId}/workflow/templates`)
    revalidatePath(`/s/${surgeryId}/workflow`)
    redirect(`/s/${surgeryId}/workflow/templates/${template.id}/view`)
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

    const name = (formData.get('name') as string)?.trim()
    const description = ((formData.get('description') as string | null) ?? '')?.trim() || null
    const isActive = formData.get('isActive') === 'on' || formData.get('isActive') === 'true'
    const colourHex = (formData.get('colourHex') as string) || null
    const landingCategoryRaw = formData.get('landingCategory') as string
    const landingCategory = landingCategoryRaw && ['PRIMARY', 'SECONDARY', 'ADMIN'].includes(landingCategoryRaw) 
      ? landingCategoryRaw 
      : 'PRIMARY'
    const workflowTypeRaw = formData.get('workflowType') as string
    const workflowType = workflowTypeRaw && ['PRIMARY', 'SUPPORTING', 'MODULE'].includes(workflowTypeRaw)
      ? workflowTypeRaw
      : existing.workflowType || 'SUPPORTING'

    const user = await getSessionUser()
    if (!user) {
      return {
        success: false,
        error: 'Unauthorized',
      }
    }

    const editableFieldsChanged =
      name !== existing.name ||
      description !== existing.description ||
      isActive !== existing.isActive ||
      (colourHex || null) !== existing.colourHex ||
      landingCategory !== existing.landingCategory ||
      (workflowType as 'PRIMARY' | 'SUPPORTING' | 'MODULE') !== existing.workflowType

    // If workflow was approved and editable fields changed, revert to DRAFT and clear approval fields.
    const shouldRevertApproval = existing.approvalStatus === 'APPROVED' && editableFieldsChanged
    const nextApprovalStatus = shouldRevertApproval ? 'DRAFT' : existing.approvalStatus

    await prisma.workflowTemplate.update({
      where: { id: templateId },
      data: {
        name,
        description,
        isActive,
        colourHex: colourHex || null,
        landingCategory,
        workflowType: workflowType as 'PRIMARY' | 'SUPPORTING' | 'MODULE',
        approvalStatus: nextApprovalStatus,
        approvedBy: shouldRevertApproval ? null : existing.approvedBy,
        approvedAt: shouldRevertApproval ? null : existing.approvedAt,
        lastEditedBy: user.id,
        lastEditedAt: new Date(),
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates`)
    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}`)
    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    revalidatePath(`/s/${surgeryId}/workflow`)
    
    return { success: true }
  } catch (error) {
    console.error('Error updating workflow template:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update template',
    }
  }
}

// TODO(workflow-approval): Diagram edits (nodes/options/links) are saved by separate actions below.
// If an APPROVED workflow’s diagram is changed, we should also revert approvalStatus to DRAFT and clear
// approvedBy/approvedAt in those actions (without refactoring workflow engine behaviour here).

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
    badges: string[]
    style: {
      bgColor?: string
      textColor?: string
      borderColor?: string
      borderWidth?: number
      radius?: number
      fontWeight?: 'normal' | 'medium' | 'bold'
      theme?: 'default' | 'info' | 'warning' | 'success' | 'muted' | 'panel'
    } | null
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
      nodeType === 'PANEL' ? 'New panel' :
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
        badges: [],
        style: null,
        positionX: null,
        positionY: null,
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    
    // Parse badges from JSONB (Prisma returns it as JsonValue)
    const badges = Array.isArray(node.badges) ? node.badges as string[] : []
    
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
        badges,
        style: node.style as {
          bgColor?: string
          textColor?: string
          borderColor?: string
          borderWidth?: number
          radius?: number
          fontWeight?: 'normal' | 'medium' | 'bold'
          theme?: 'default' | 'info' | 'warning' | 'success' | 'muted' | 'panel'
        } | null,
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
  linkedWorkflows?: Array<{ id?: string; toTemplateId: string; label?: string; sortOrder?: number }>,
  badges?: string[],
  style?: {
    bgColor?: string
    textColor?: string
    borderColor?: string
    borderWidth?: number
    radius?: number
    fontWeight?: 'normal' | 'medium' | 'bold'
    theme?: 'default' | 'info' | 'warning' | 'success' | 'muted' | 'panel'
    width?: number
    height?: number
  } | null
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
      const updateData: {
        title: string
        body: string | null
        actionKey: WorkflowActionKey | null
        badges?: unknown
        style?: unknown
      } = {
        title,
        body: body || null,
        actionKey,
      }
      
      if (badges !== undefined) {
        updateData.badges = badges
      }
      
      if (style !== undefined) {
        // Fetch current node style from DB within transaction to ensure latest data
        // This prevents stale style writes from overwriting correct dimensions
        const currentNode = await tx.workflowNodeTemplate.findUnique({
          where: { id: nodeId },
          select: { style: true },
        })
        
        const existingStyle = (currentNode?.style as {
          bgColor?: string
          textColor?: string
          borderColor?: string
          borderWidth?: number
          radius?: number
          fontWeight?: 'normal' | 'medium' | 'bold'
          theme?: 'default' | 'info' | 'warning' | 'success' | 'muted' | 'panel'
          width?: number
          height?: number
        } | null) ?? null
        
        // Merge: existing style first, then incoming style (incoming overrides existing)
        const mergedStyle = {
          ...(existingStyle ?? {}),
          ...(style ?? {}),
        }
        
        // Process width/height: coerce to numbers, clamp to minimums, remove if NaN
        if (mergedStyle.width !== undefined) {
          const widthValue = typeof mergedStyle.width === 'number' ? mergedStyle.width : Number(mergedStyle.width)
          if (isNaN(widthValue)) {
            delete mergedStyle.width
          } else {
            // Clamp width to minimum 300
            mergedStyle.width = Math.max(widthValue, 300)
          }
        }
        if (mergedStyle.height !== undefined) {
          const heightValue = typeof mergedStyle.height === 'number' ? mergedStyle.height : Number(mergedStyle.height)
          if (isNaN(heightValue)) {
            delete mergedStyle.height
          } else {
            // Clamp height to minimum 200
            mergedStyle.height = Math.max(heightValue, 200)
          }
        }
        
        // If style is explicitly null, allow clearing it
        // Otherwise, use merged style with clamped dimensions
        updateData.style = style === null ? null : mergedStyle
      }
      
      await tx.workflowNodeTemplate.update({
        where: { id: nodeId },
        data: updateData,
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

export async function deleteWorkflowTemplate(
  surgeryId: string,
  templateId: string
): Promise<ActionResult> {
  try {
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
      return {
        success: false,
        error: 'Template not found',
      }
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

    revalidatePath(`/s/${surgeryId}/workflow/templates`)
    revalidatePath(`/s/${surgeryId}/workflow`)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting workflow template:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete workflow template',
    }
  }
}

/**
 * Approve a workflow template (sets approvalStatus to APPROVED)
 */
export async function approveWorkflowTemplate(
  surgeryId: string,
  templateId: string
): Promise<ActionResult> {
  try {
    const user = await requireSurgeryAdmin(surgeryId)

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

    await prisma.workflowTemplate.update({
      where: { id: templateId },
      data: {
        approvalStatus: 'APPROVED',
        approvedBy: user.id,
        approvedAt: new Date(),
      },
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}`)
    revalidatePath(`/s/${surgeryId}/workflow`)

    return { success: true }
  } catch (error) {
    console.error('Error approving workflow template:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve template',
    }
  }
}

/**
 * Create a surgery-specific override from a Global Default workflow template.
 * 
 * Safety: Only one override per (surgeryId, sourceTemplateId) is allowed.
 * If an override already exists, this function returns the existing override ID
 * instead of creating a duplicate, allowing the UI to redirect to it.
 * 
 * Copies the global template structure (nodes, options, links) to a new local template.
 * The new override starts as DRAFT and must be approved before staff can see it.
 * 
 * @param surgeryId - The surgery creating the override
 * @param globalTemplateId - The global template ID to override
 * @returns Success with templateId (existing or new)
 */
export async function createWorkflowOverride(
  surgeryId: string,
  globalTemplateId: string
): Promise<ActionResult & { templateId?: string }> {
  try {
    await requireSurgeryAdmin(surgeryId)

    // Global Default surgery ID - stores shared workflow templates
    // These are inherited by all surgeries and can be overridden per-surgery
    const GLOBAL_SURGERY_ID = 'global-default-buttons'

    // Verify global template exists and belongs to Global Default surgery
    const globalTemplate = await prisma.workflowTemplate.findFirst({
      where: {
        id: globalTemplateId,
        surgeryId: GLOBAL_SURGERY_ID,
      },
      include: {
        nodes: {
          include: {
            answerOptions: true,
            workflowLinks: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
    })

    if (!globalTemplate) {
      return {
        success: false,
        error: 'Global template not found',
      }
    }

    // Check if override already exists - if so, redirect to it instead of creating duplicate
    const existingOverride = await prisma.workflowTemplate.findFirst({
      where: {
        surgeryId,
        sourceTemplateId: globalTemplateId,
      },
    })

    if (existingOverride) {
      // Override already exists - return success with existing template ID to redirect
      revalidatePath(`/s/${surgeryId}/workflow/templates`)
      revalidatePath(`/s/${surgeryId}/workflow`)
      return {
        success: true,
        templateId: existingOverride.id,
      }
    }

    // Create override in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the override template
      const overrideTemplate = await tx.workflowTemplate.create({
        data: {
          surgeryId,
          name: globalTemplate.name,
          description: globalTemplate.description,
          colourHex: globalTemplate.colourHex,
          isActive: globalTemplate.isActive,
          landingCategory: globalTemplate.landingCategory,
          workflowType: globalTemplate.workflowType,
          sourceTemplateId: globalTemplateId,
          approvalStatus: 'DRAFT', // New override starts as draft
        },
      })

      // Create a map of old node IDs to new node IDs
      const nodeIdMap = new Map<string, string>()

      // Copy nodes first (two-pass) so nextNodeId mapping always works.
      for (const globalNode of globalTemplate.nodes) {
        const newNode = await tx.workflowNodeTemplate.create({
          data: {
            templateId: overrideTemplate.id,
            nodeType: globalNode.nodeType,
            title: globalNode.title,
            body: globalNode.body,
            sortOrder: globalNode.sortOrder,
            isStart: globalNode.isStart,
            positionX: globalNode.positionX,
            positionY: globalNode.positionY,
            actionKey: globalNode.actionKey,
          },
        })
        nodeIdMap.set(globalNode.id, newNode.id)
      }

      // Copy answer options and workflow links in a second pass.
      for (const globalNode of globalTemplate.nodes) {
        const newNodeId = nodeIdMap.get(globalNode.id)
        if (!newNodeId) {
          throw new Error('Failed to map node IDs during override creation')
        }

        for (const option of globalNode.answerOptions) {
          const nextNodeId = option.nextNodeId ? nodeIdMap.get(option.nextNodeId) || null : null

          await tx.workflowAnswerOptionTemplate.create({
            data: {
              nodeId: newNodeId,
              label: option.label,
              valueKey: option.valueKey,
              description: option.description,
              nextNodeId,
              actionKey: option.actionKey,
              sourceHandle: option.sourceHandle,
              targetHandle: option.targetHandle,
            },
          })
        }

        // WorkflowNodeLink points to another workflow template (NOT the current template).
        for (const link of globalNode.workflowLinks) {
          await tx.workflowNodeLink.create({
            data: {
              nodeId: newNodeId,
              templateId: link.templateId,
              label: link.label,
              sortOrder: link.sortOrder,
            },
          })
        }
      }

      return overrideTemplate
    })

    revalidatePath(`/s/${surgeryId}/workflow/templates`)
    revalidatePath(`/s/${surgeryId}/workflow`)

    return {
      success: true,
      templateId: result.id,
    }
  } catch (error) {
    console.error('Error creating workflow override:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create override',
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

