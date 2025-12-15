'use client'

import WorkflowDiagramClient from './WorkflowDiagramClient'
import { WorkflowNodeType, WorkflowActionKey } from '@prisma/client'

type WorkflowTemplate = {
  id: string
  name: string
  description: string | null
  nodes: Array<{
    id: string
    nodeType: WorkflowNodeType
    title: string
    body: string | null
    sortOrder: number
    positionX: number | null
    positionY: number | null
    actionKey: WorkflowActionKey | null
    workflowLinks: Array<{
      id: string
      templateId: string
      label: string
      template: { id: string; name: string }
    }>
    answerOptions: Array<{
      id: string
      label: string
      nextNodeId: string | null
      actionKey: WorkflowActionKey | null
      sourceHandle: string | null
      targetHandle: string | null
    }>
  }>
}

interface Props {
  template: WorkflowTemplate
  isAdmin: boolean
  allTemplates: Array<{ id: string; name: string }>
  surgeryId: string
  updatePositionAction?: (nodeId: string, positionX: number, positionY: number) => Promise<{ success: boolean; error?: string }>
  createNodeAction?: (nodeType: WorkflowNodeType, title?: string) => Promise<{ success: boolean; error?: string; node?: any }>
  createAnswerOptionAction?: (
    fromNodeId: string,
    toNodeId: string,
    label: string,
    sourceHandle?: string,
    targetHandle?: string
  ) => Promise<{ success: boolean; error?: string; option?: any }>
  updateAnswerOptionLabelAction?: (optionId: string, label: string) => Promise<{ success: boolean; error?: string }>
  deleteAnswerOptionAction?: (optionId: string) => Promise<{ success: boolean; error?: string }>
  deleteNodeAction?: (nodeId: string) => Promise<{ success: boolean; error?: string }>
  updateNodeAction?: (
    nodeId: string,
    title: string,
    body: string | null,
    actionKey: WorkflowActionKey | null,
    linkedWorkflows?: Array<{ id?: string; toTemplateId: string; label?: string; sortOrder?: number }>
  ) => Promise<{ success: boolean; error?: string }>
}

export default function WorkflowDiagramClientWrapper(props: Props) {
  return <WorkflowDiagramClient {...props} />
}

