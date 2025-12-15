'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  ConnectionLineType,
  MarkerType,
  Connection,
  Handle,
  Position,
  NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { WorkflowNodeType, WorkflowActionKey } from '@prisma/client'
import WorkflowDecisionNode from './WorkflowDecisionNode'
import WorkflowInstructionNode from './WorkflowInstructionNode'
import WorkflowOutcomeNode from './WorkflowOutcomeNode'
import WorkflowOrthogonalEdge from './WorkflowOrthogonalEdge'

interface WorkflowNode {
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
    template: {
      id: string
      name: string
    }
  }>
  answerOptions: Array<{
        id: string
        label: string
        nextNodeId: string | null
        actionKey: WorkflowActionKey | null
        sourceHandle: string | null
        targetHandle: string | null
      }>
}

interface WorkflowTemplate {
  id: string
  name: string
  description: string | null
  nodes: WorkflowNode[]
}

interface WorkflowDiagramClientProps {
  template: WorkflowTemplate
  isAdmin?: boolean
  allTemplates?: Array<{ id: string; name: string }>
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
  updateNodeAction?: (nodeId: string, title: string, body: string | null, actionKey: WorkflowActionKey | null) => Promise<{ success: boolean; error?: string }>
  createWorkflowLinkAction?: (nodeId: string, templateId: string, label: string) => Promise<{ success: boolean; error?: string; link?: any }>
  deleteWorkflowLinkAction?: (linkId: string) => Promise<{ success: boolean; error?: string }>
}

function formatActionKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function getActionKeyDescription(actionKey: WorkflowActionKey): string {
  const descriptions: Record<WorkflowActionKey, string> = {
    FORWARD_TO_GP: 'forward this document to the GP inbox',
    FORWARD_TO_PRESCRIBING_TEAM: 'forward to prescribing team',
    FORWARD_TO_PHARMACY_TEAM: 'forward to pharmacy team',
    FILE_WITHOUT_FORWARDING: 'file without forwarding to GP',
    ADD_TO_YELLOW_SLOT: 'add to yellow slot',
    SEND_STANDARD_LETTER: 'send standard letter',
    CODE_AND_FILE: 'code and file',
    OTHER: 'other action',
  }
  return descriptions[actionKey] || actionKey
}

function getNodeTypeColor(nodeType: WorkflowNodeType): string {
  switch (nodeType) {
    case 'INSTRUCTION':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'QUESTION':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'END':
      return 'bg-green-50 text-green-700 border-green-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

// Simple info icon SVG
function InfoIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function WorkflowDiagramClient({
  template,
  isAdmin = false,
  allTemplates = [],
  surgeryId,
  updatePositionAction,
  createNodeAction,
  createAnswerOptionAction,
  updateAnswerOptionLabelAction,
  deleteAnswerOptionAction,
  deleteNodeAction,
  updateNodeAction,
  createWorkflowLinkAction,
  deleteWorkflowLinkAction,
}: WorkflowDiagramClientProps) {
  const router = useRouter()
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  
  // Editing state for admin
  const [editingTitle, setEditingTitle] = useState('')
  const [editingBody, setEditingBody] = useState('')
  const [editingActionKey, setEditingActionKey] = useState<WorkflowActionKey | null>(null)
  const [editingEdgeLabel, setEditingEdgeLabel] = useState('')
  const [editingNewLinkTemplateId, setEditingNewLinkTemplateId] = useState<string>('NONE')
  const [editingNewLinkLabel, setEditingNewLinkLabel] = useState<string>('Open linked workflow')
  
  // Persist editingMode in localStorage so it survives page refreshes
  const [editingMode, setEditingMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`workflow-editing-mode-${template.id}`)
      return saved === 'true'
    }
    return false
  })
  
  // Save editingMode to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`workflow-editing-mode-${template.id}`, String(editingMode))
    }
  }, [editingMode, template.id])
  
  // Axis locking state for Shift-drag
  const dragStartPositionRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const lockedAxisRef = useRef<Map<string, 'x' | 'y' | null>>(new Map())
  
  // Debounce timer for position updates
  const positionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const ACTION_KEYS: WorkflowActionKey[] = [
    'FORWARD_TO_GP',
    'FORWARD_TO_PRESCRIBING_TEAM',
    'FORWARD_TO_PHARMACY_TEAM',
    'FILE_WITHOUT_FORWARDING',
    'ADD_TO_YELLOW_SLOT',
    'SEND_STANDARD_LETTER',
    'CODE_AND_FILE',
    'OTHER',
  ]

  // Effective admin mode (enabled only when editing mode is on)
  const effectiveAdmin = isAdmin && editingMode

  // Local state to track optimistically added/removed links
  const [localLinkUpdates, setLocalLinkUpdates] = useState<{
    added: Array<{ id: string; templateId: string; label: string; template: { id: string; name: string } }>
    removed: string[]
  }>({ added: [], removed: [] })

  // Track template version to detect when data actually refreshes
  // Create a hash of all workflowLink IDs across all nodes to detect changes
  const getTemplateLinksHash = useCallback((nodes: WorkflowNode[]) => {
    return nodes.map(n => n.workflowLinks.map(l => l.id).sort().join(',')).sort().join('|')
  }, [])
  
  const templateLinksHashRef = useRef(getTemplateLinksHash(template.nodes))
  
  // Clear optimistic updates when template workflowLinks actually change (after refresh)
  useEffect(() => {
    const currentHash = getTemplateLinksHash(template.nodes)
    if (currentHash !== templateLinksHashRef.current) {
      // Template workflowLinks have changed - clear optimistic updates
      setLocalLinkUpdates({ added: [], removed: [] })
      templateLinksHashRef.current = currentHash
    }
  }, [template.nodes, getTemplateLinksHash])

  // Find selected node data, including optimistic link updates
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    const node = template.nodes.find((n) => n.id === selectedNodeId) || null
    if (!node) return null

    // Apply optimistic updates to workflowLinks
    let links = [...node.workflowLinks]
    
    // Remove links that were deleted optimistically
    links = links.filter(link => !localLinkUpdates.removed.includes(link.id))
    
    // Add links that were added optimistically (avoid duplicates)
    localLinkUpdates.added.forEach(added => {
      if (!links.some(existing => existing.id === added.id || existing.templateId === added.templateId)) {
        links.push(added)
      }
    })

    const result = {
      ...node,
      workflowLinks: links,
    }
    return result
  }, [selectedNodeId, template.nodes, localLinkUpdates])

  // Initialize editing state when node is selected
  useEffect(() => {
    if (selectedNode && effectiveAdmin) {
      setEditingTitle(selectedNode.title)
      setEditingBody(selectedNode.body || '')
      setEditingActionKey(selectedNode.actionKey)
      setEditingNewLinkTemplateId('NONE')
      setEditingNewLinkLabel('Open linked workflow')
    }
  }, [selectedNode, effectiveAdmin])

  // Find selected edge data
  const selectedEdge = useMemo(() => {
    if (!selectedEdgeId) return null
    const edge = edges.find((e) => e.id === selectedEdgeId)
    if (!edge) return null
    
    // Find the answer option that corresponds to this edge
    for (const node of template.nodes) {
      const option = node.answerOptions.find((opt) => opt.id === edge.id)
      if (option) {
        return { edge, option, node }
      }
    }
    return null
  }, [selectedEdgeId, edges, template.nodes])

  // Initialize edge editing state
  useEffect(() => {
    if (selectedEdge && isAdmin) {
      setEditingEdgeLabel(selectedEdge.option.label || '')
    }
  }, [selectedEdge, isAdmin])

  // Toggle node selection
  const toggleNodeSelection = useCallback((nodeId: string) => {
    setSelectedNodeId((current) => (current === nodeId ? null : nodeId))
  }, [])

  // Check if node has outgoing edges
  const nodeHasOutgoingEdges = useCallback((nodeId: string) => {
    const node = template.nodes.find((n) => n.id === nodeId)
    if (!node) return false
    return node.answerOptions.some((option) => option.nextNodeId !== null)
  }, [template.nodes])

  // Convert template nodes to React Flow nodes
  const flowNodes = useMemo<Node[]>(() => {
    return template.nodes.map((node) => {
      // Calculate position
      let x = 0
      let y = 0
      
      if (node.positionX !== null && node.positionY !== null) {
        x = node.positionX
        y = node.positionY
      } else {
        // Simple vertical layout based on sortOrder
        x = 0
        y = node.sortOrder * 180
      }

      const hasBody = node.body && node.body.trim().length > 0
      const hasActionKey = node.actionKey !== null
      const isSelected = node.id === selectedNodeId
      const hasOutgoingEdges = nodeHasOutgoingEdges(node.id)
      const isOutcomeNode = hasActionKey && !hasOutgoingEdges

      // Determine node styling based on type
      const nodeTypeStyles = node.nodeType === 'QUESTION'
        ? 'bg-amber-50 border-amber-200'
        : 'bg-white border-gray-200'

      // Map node types to custom components
      let nodeType: string
      if (node.nodeType === 'QUESTION') {
        nodeType = 'decisionNode'
      } else if (node.nodeType === 'INSTRUCTION') {
        nodeType = 'instructionNode'
      } else if (node.nodeType === 'END') {
        nodeType = 'outcomeNode'
      } else {
        nodeType = 'default'
      }

      return {
        id: node.id,
        type: nodeType,
        position: { x, y },
        selected: isSelected,
        data: node.nodeType === 'QUESTION' ? {
          // For QUESTION nodes, pass data to custom component (diamond shape)
          nodeType: node.nodeType,
          title: node.title,
          body: node.body,
          hasBody,
          isSelected,
          isAdmin: effectiveAdmin,
          onNodeClick: () => toggleNodeSelection(node.id),
          onInfoClick: () => toggleNodeSelection(node.id),
        } : node.nodeType === 'INSTRUCTION' ? {
          // For INSTRUCTION nodes, pass data to custom component
          nodeType: node.nodeType,
          title: node.title,
          body: node.body,
          hasBody,
          isSelected,
          isAdmin: effectiveAdmin,
          onNodeClick: () => toggleNodeSelection(node.id),
          onInfoClick: () => toggleNodeSelection(node.id),
        } : node.nodeType === 'END' ? {
          // For END nodes, pass data to custom component (includes outcome footer logic)
          nodeType: node.nodeType,
          title: node.title,
          body: node.body,
          hasBody,
          actionKey: node.actionKey,
          hasOutgoingEdges,
          isSelected,
          isAdmin: effectiveAdmin,
          onNodeClick: () => toggleNodeSelection(node.id),
          onInfoClick: () => toggleNodeSelection(node.id),
          getActionKeyDescription,
        } : {
          // Fallback for any other node types (shouldn't happen)
          label: (
            <>
              {/* Target handle (top) - connections come IN */}
              {effectiveAdmin && (
                <Handle
                  id="in"
                  type="target"
                  position={Position.Top}
                  className="w-3 h-3 !bg-blue-500"
                />
              )}
              <div 
                className={`min-w-[280px] max-w-[320px] rounded-lg shadow-md overflow-hidden transition-all cursor-pointer ${
                  nodeTypeStyles
                } ${
                  isSelected 
                    ? 'border-2 border-blue-500 shadow-lg' 
                    : 'border'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleNodeSelection(node.id)
                }}
              >
                {/* Badge in top-left */}
                <div className="flex items-start justify-between px-4 pt-3 pb-2">
                  <div className={`text-xs font-semibold px-2.5 py-1 rounded border ${getNodeTypeColor(node.nodeType)}`}>
                    {node.nodeType}
                  </div>
                  {/* Info indicator - only if has body */}
                  {hasBody && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleNodeSelection(node.id)
                      }}
                      className="flex-shrink-0 ml-2 text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors"
                      title="Click for reference details"
                      aria-label="View details"
                    >
                      <InfoIcon />
                    </button>
                  )}
                </div>
                
                {/* Title - constrained with overflow protection */}
                <div className="px-4 pb-3 min-h-[2.5rem] overflow-hidden">
                  <div className="font-medium text-gray-900 break-words text-sm leading-snug">
                    {node.title}
                  </div>
                </div>

                {/* Outcome footer - only if actionKey and no outgoing edges */}
                {isOutcomeNode && (
                  <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
                    <div className="text-xs font-medium text-blue-900">
                      Outcome: {getActionKeyDescription(node.actionKey!)}
                    </div>
                  </div>
                )}
              </div>
              {/* Source handle (bottom) - connections go OUT */}
              {isAdmin && (
                <Handle
                  id="out"
                  type="source"
                  position={Position.Bottom}
                  className="w-3 h-3 !bg-blue-500"
                />
              )}
            </>
          ),
          nodeType: node.nodeType,
          title: node.title,
          body: node.body,
          actionKey: node.actionKey,
          hasBody,
        },
      }
    })
  }, [template.nodes, selectedNodeId, nodeHasOutgoingEdges, toggleNodeSelection, effectiveAdmin])

  const connectionCount = useMemo(
    () =>
      template.nodes.reduce(
        (count, node) => count + node.answerOptions.filter((option) => option.nextNodeId !== null).length,
        0
      ),
    [template.nodes]
  )

  const initialEdges = useMemo<Edge[]>(() => {
    const edgesFromTemplate: Edge[] = []

    template.nodes.forEach((node) => {
      node.answerOptions.forEach((option) => {
        if (option.nextNodeId) {
          const labelText = (option.label ?? '').trim()
          const hasLabel = labelText !== ''
          edgesFromTemplate.push({
            id: option.id,
            source: node.id,
            target: option.nextNodeId,
            sourceHandle: option.sourceHandle || 'source-bottom',
            targetHandle: option.targetHandle || 'target-top',
            label: hasLabel ? labelText : undefined,
            labelStyle: hasLabel
              ? { fontSize: 12, fontWeight: 600, color: '#0b4670', transform: 'translateY(-6px)' }
              : undefined,
            labelBgStyle: hasLabel ? { fill: '#ffffff', stroke: '#76a9fa', strokeWidth: 1 } : undefined,
            labelBgPadding: hasLabel ? [6, 4] : undefined,
            labelBgBorderRadius: hasLabel ? 8 : undefined,
            type: 'workflowOrthogonal',
            selected: false,
            style: {
              strokeWidth: 2.5,
              stroke: '#005EB8',
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#005EB8',
            },
            animated: false,
          })
        }
      })
    })

    return edgesFromTemplate
  }, [template.nodes])

  useEffect(() => {
    setNodes(flowNodes)
  }, [flowNodes, setNodes])

  useEffect(() => {
    setEdges(initialEdges)
    if (process.env.NODE_ENV !== 'production') {
      console.debug('WorkflowDiagramClient: initial edges count', initialEdges.length)
    }

    if (process.env.NODE_ENV !== 'production' && connectionCount > 0 && initialEdges.length === 0) {
      console.warn('WorkflowDiagramClient: edges missing despite connections', {
        templateId: template.id,
        connectionCount,
      })
    }
  }, [connectionCount, initialEdges, setEdges, template.id])

  // Update edge selection state when selectedEdgeId changes (without resetting all edges)
  useEffect(() => {
    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({
        ...edge,
        selected: edge.id === selectedEdgeId,
        style: {
          ...edge.style,
          strokeWidth: edge.id === selectedEdgeId ? 3.5 : 2.5,
        },
      }))
    )
  }, [selectedEdgeId, setEdges])

  // Handle node drag start - store initial position for axis locking
  const handleNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    if (!effectiveAdmin) return
    // Reset axis lock and store start position
    lockedAxisRef.current.set(node.id, null)
    dragStartPositionRef.current.set(node.id, { x: node.position.x, y: node.position.y })
  }, [effectiveAdmin])

  // Handle node drag - apply axis locking when Shift is held
  const handleNodeDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    if (!effectiveAdmin) return

    const isShiftHeld = _event.shiftKey
    const startPos = dragStartPositionRef.current.get(node.id)
    const currentLockedAxis = lockedAxisRef.current.get(node.id)

    if (!isShiftHeld || !startPos) {
      // No shift key or no start position - clear lock and allow free movement
      lockedAxisRef.current.set(node.id, null)
      return
    }

    // Calculate deltas from start position
    const dx = node.position.x - startPos.x
    const dy = node.position.y - startPos.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    // Determine axis lock if not already set
    let lockedAxis = currentLockedAxis
    if (!lockedAxis && (absDx > 6 || absDy > 6)) {
      // Lock to dominant axis after threshold
      lockedAxis = absDx > absDy ? 'x' : 'y'
      lockedAxisRef.current.set(node.id, lockedAxis)
    }

    // Apply axis constraint if locked
    if (lockedAxis === 'x') {
      // Lock to X - fix Y at start position
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, position: { x: node.position.x, y: startPos.y } } : n
        )
      )
    } else if (lockedAxis === 'y') {
      // Lock to Y - fix X at start position
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, position: { x: startPos.x, y: node.position.y } } : n
        )
      )
    }
  }, [effectiveAdmin, setNodes])

  // Handle node drag end - save position to database
  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    if (!effectiveAdmin || !updatePositionAction) return

    const position = node.position
    const nodeId = node.id

    // Clear any existing timeout
    if (positionUpdateTimeoutRef.current) {
      clearTimeout(positionUpdateTimeoutRef.current)
    }

    // Debounce position updates (400ms)
    positionUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await updatePositionAction(nodeId, position.x, position.y)
        if (!result.success) {
          console.error('Failed to update node position:', result.error)
          // Optionally show a toast here
        }
      } catch (error) {
        console.error('Error updating node position:', error)
      }
    }, 400)
  }, [effectiveAdmin, updatePositionAction])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current)
      }
    }
  }, [])

  // Handle node click (node selection is handled in the label onClick)
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    toggleNodeSelection(node.id)
    setSelectedEdgeId(null) // Clear edge selection when node is clicked
  }, [toggleNodeSelection])

  // Handle edge click
  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (!effectiveAdmin) return
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null) // Clear node selection
  }, [effectiveAdmin])

  // Validate connection - allow any source handle (source-*) to any target handle (target-*)
  const isValidConnection = useCallback((connection: Connection): boolean => {
    if (!effectiveAdmin) return false
    // Allow any source handle (source-*) to any target handle (target-*)
    const sourceHandle = connection.sourceHandle || ''
    const targetHandle = connection.targetHandle || ''
    return sourceHandle.startsWith('source-') && targetHandle.startsWith('target-')
  }, [effectiveAdmin])

  // Handle connection creation
  const onConnect = useCallback(async (connection: Connection) => {
    if (!effectiveAdmin || !createAnswerOptionAction || !connection.source || !connection.target) return
    if (!isValidConnection(connection)) {
      console.warn('Invalid connection: source handle must start with "source-" and target handle must start with "target-"')
      return
    }

    const labelInput = window.prompt('Label for this path (e.g. Yes / No). Leave blank for no label:', '')
    // If user cancels, labelInput is null - we'll treat this as empty string
    const label = labelInput === null ? '' : labelInput.trim()

    try {
      const result = await createAnswerOptionAction(connection.source, connection.target, label, connection.sourceHandle || 'source-bottom', connection.targetHandle || 'target-top')
      if (result.success && result.option) {
        // Add new edge to the edges state
        const edgeLabel = result.option.label && result.option.label.trim() !== '' ? result.option.label.trim() : undefined
        const newEdge: Edge = {
          id: result.option.id,
          source: connection.source!,
          target: connection.target!,
          sourceHandle: connection.sourceHandle || 'source-bottom',
          targetHandle: connection.targetHandle || 'target-top',
          label: edgeLabel,
          labelStyle: edgeLabel ? { fontSize: 12, fontWeight: 600, color: '#0b4670', transform: 'translateY(-6px)' } : undefined,
          labelBgStyle: edgeLabel ? { fill: '#ffffff', stroke: '#76a9fa', strokeWidth: 1 } : undefined,
          labelBgPadding: edgeLabel ? [6, 4] : undefined,
          labelBgBorderRadius: edgeLabel ? 8 : undefined,
          type: 'workflowOrthogonal',
          style: {
            strokeWidth: 2.5,
            stroke: '#005EB8',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#005EB8',
          },
          animated: false,
        }
        
        setEdges((eds) => {
          return [...eds, newEdge]
        })
      } else {
        console.error('Failed to create answer option:', result.error)
        alert(`Failed to create connection: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating connection:', error)
      alert('Failed to create connection')
    }
  }, [isAdmin, createAnswerOptionAction, setEdges, isValidConnection])

  // Handle creating new node from toolbar
  const handleCreateNode = useCallback(async (nodeType: WorkflowNodeType) => {
    if (!createNodeAction) return

    try {
      const result = await createNodeAction(nodeType)
      if (result.success && result.node) {
        // Calculate initial position (center of viewport or below last node)
        const maxY = nodes.length > 0 
          ? Math.max(...nodes.map(n => n.position.y))
          : 0
        const initialX = 0
        const initialY = maxY + 200

        const newNode: Node = {
          id: result.node.id,
          type: 'default',
          position: { x: initialX, y: initialY },
          selected: false,
          data: {
                  label: (
                    <>
                      {isAdmin && (
                        <Handle
                          id="in"
                          type="target"
                          position={Position.Top}
                          className="w-3 h-3 !bg-blue-500"
                        />
                      )}
                      <div className={`min-w-[280px] max-w-[320px] rounded-lg shadow-md overflow-hidden transition-all cursor-pointer ${
                        nodeType === 'QUESTION'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-white border-gray-200'
                      } border`}>
                        <div className="flex items-start justify-between px-4 pt-3 pb-2">
                          <div className={`text-xs font-semibold px-2.5 py-1 rounded border ${getNodeTypeColor(nodeType)}`}>
                            {nodeType}
                          </div>
                        </div>
                        <div className="px-4 pb-3 min-h-[2.5rem] overflow-hidden">
                          <div className="font-medium text-gray-900 break-words text-sm leading-snug">
                            {result.node.title}
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <Handle
                          id="out"
                          type="source"
                          position={Position.Bottom}
                          className="w-3 h-3 !bg-blue-500"
                        />
                      )}
                    </>
                  ),
            nodeType: result.node.nodeType,
            title: result.node.title,
            body: result.node.body,
            actionKey: result.node.actionKey,
            hasBody: false,
          },
        }
        setNodes((nds) => [...nds, newNode])
        setSelectedNodeId(result.node.id)
        
        // Refresh server data to get full node details, but preserve client state
        router.refresh()
      } else {
        console.error('Failed to create node:', result.error)
        alert(`Failed to create node: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating node:', error)
      alert('Failed to create node')
    }
  }, [createNodeAction, nodes, isAdmin, setNodes])

  // Handle saving node edits
  const handleSaveNode = useCallback(async () => {
    if (!selectedNode || !updateNodeAction) return

    try {
      const result = await updateNodeAction(
        selectedNode.id, 
        editingTitle, 
        editingBody || null, 
        editingActionKey
      )
      if (result.success) {
        router.refresh()
      } else {
        alert(`Failed to save: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving node:', error)
      alert('Failed to save changes')
    }
  }, [selectedNode, updateNodeAction, editingTitle, editingBody, editingActionKey])

  // Handle quick create of a new node connected from the selected node
  const handleQuickCreateConnectedNode = useCallback(async (nodeType: WorkflowNodeType) => {
    if (!effectiveAdmin || !createNodeAction || !createAnswerOptionAction || !selectedNode) return

    try {
      // 1) Create the new node on the server
      const result = await createNodeAction(nodeType)
      if (!result.success || !result.node) {
        alert(`Failed to create node: ${result.error || 'Unknown error'}`)
        return
      }

      // 2) Calculate position for new node (directly below selected node, snapped to grid)
      const baseNode = nodes.find((n) => n.id === selectedNode.id)
      const gridSize = 16
      const spacing = 180 // Vertical spacing between nodes
      const baseX = baseNode?.position.x || 0
      const baseY = baseNode?.position.y || 0
      const newX = Math.round(baseX / gridSize) * gridSize // Snap to grid
      const newY = Math.round((baseY + spacing) / gridSize) * gridSize // Snap to grid

      // 3) Add the node locally
      // Map node types to custom components
      let newNodeType: string
      if (nodeType === 'QUESTION') {
        newNodeType = 'decisionNode'
      } else if (nodeType === 'INSTRUCTION') {
        newNodeType = 'instructionNode'
      } else if (nodeType === 'END') {
        newNodeType = 'outcomeNode'
      } else {
        newNodeType = 'default'
      }
      
      const newNode: Node = {
        id: result.node.id,
        type: newNodeType,
        position: { x: newX, y: newY },
        selected: false,
        data: nodeType === 'QUESTION' ? {
          nodeType: result.node.nodeType,
          title: result.node.title,
          body: result.node.body,
          hasBody: false,
          isSelected: false,
          isAdmin,
          onNodeClick: () => {},
          onInfoClick: () => {},
        } : nodeType === 'INSTRUCTION' ? {
          nodeType: result.node.nodeType,
          title: result.node.title,
          body: result.node.body,
          hasBody: false,
          isSelected: false,
          isAdmin,
          onNodeClick: () => {},
          onInfoClick: () => {},
        } : nodeType === 'END' ? {
          nodeType: result.node.nodeType,
          title: result.node.title,
          body: result.node.body,
          hasBody: false,
          actionKey: result.node.actionKey,
          hasOutgoingEdges: false,
          isSelected: false,
          isAdmin,
          onNodeClick: () => {},
          onInfoClick: () => {},
          getActionKeyDescription,
        } : {
          // Fallback for any other node types (shouldn't happen)
          nodeType: result.node.nodeType,
          title: result.node.title,
          body: result.node.body,
          hasBody: false,
        },
      }

      setNodes((nds) => [...nds, newNode])

      // 4) Create connection with empty label (bottom to top)
      const edgeResult = await createAnswerOptionAction(selectedNode.id, result.node.id, '', 'source-bottom', 'target-top')
      if (!edgeResult.success || !edgeResult.option) {
        alert(`Node created, but failed to connect: ${edgeResult.error || 'Unknown error'}`)
        setSelectedNodeId(result.node.id)
        return
      }

        const newEdge: Edge = {
          id: edgeResult.option.id,
          source: selectedNode.id,
          target: result.node.id,
          sourceHandle: 'source-bottom',
          targetHandle: 'target-top',
        label: undefined,
          type: 'workflowOrthogonal',
        style: {
          strokeWidth: 2.5,
          stroke: '#005EB8',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#005EB8',
        },
        animated: false,
      }

      setEdges((eds) => [...eds, newEdge])

      // 5) Select the new node for immediate editing
      setSelectedNodeId(result.node.id)
      setSelectedEdgeId(null)
    } catch (error) {
      console.error('Error creating connected node:', error)
      alert('Failed to create connected node')
    }
  }, [isAdmin, createNodeAction, createAnswerOptionAction, selectedNode, nodes, setNodes, setEdges])

  // Handle deleting node
  const handleDeleteNode = useCallback(async () => {
    if (!selectedNode || !deleteNodeAction) return
    if (!confirm('Are you sure you want to delete this step? This will remove the node and its connections.')) return

    try {
      const result = await deleteNodeAction(selectedNode.id)
      if (result.success) {
        // Remove node and its edges from state
        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id))
        setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id))
        setSelectedNodeId(null)
        setSelectedEdgeId(null)
      } else {
        alert(`Failed to delete: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting node:', error)
      alert('Failed to delete node')
    }
  }, [selectedNode, deleteNodeAction, setNodes, setEdges])

  // Handle saving edge label
  const handleSaveEdgeLabel = useCallback(async () => {
    if (!selectedEdge || !updateAnswerOptionLabelAction) return

    const trimmedLabel = editingEdgeLabel.trim()

    try {
      const result = await updateAnswerOptionLabelAction(selectedEdge.option.id, trimmedLabel)
      if (result.success) {
        // Update edge label in state (hide if empty)
        setEdges((eds) =>
          eds.map((e) =>
            e.id === selectedEdge.edge.id
              ? {
                  ...e,
                  label: trimmedLabel && trimmedLabel !== '' ? trimmedLabel : undefined,
                  labelStyle: trimmedLabel && trimmedLabel !== '' ? { fontSize: 12, fontWeight: 600, color: '#0b4670' } : undefined,
                  labelBgStyle: trimmedLabel && trimmedLabel !== '' ? { fill: '#ffffff', stroke: '#76a9fa', strokeWidth: 1 } : undefined,
                  labelBgPadding: trimmedLabel && trimmedLabel !== '' ? [6, 4] : undefined,
                  labelBgBorderRadius: trimmedLabel && trimmedLabel !== '' ? 8 : undefined,
                }
              : e
          )
        )
        setSelectedEdgeId(null)
      } else {
        alert(`Failed to save: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving edge label:', error)
      alert('Failed to save label')
    }
  }, [selectedEdge, updateAnswerOptionLabelAction, editingEdgeLabel, setEdges])

  // Handle deleting edge
  const handleDeleteEdge = useCallback(async () => {
    if (!selectedEdge || !deleteAnswerOptionAction) return
    if (!confirm('Are you sure you want to delete this connection?')) return

    try {
      const result = await deleteAnswerOptionAction(selectedEdge.option.id)
      if (result.success) {
        setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.edge.id))
        setSelectedEdgeId(null)
      } else {
        alert(`Failed to delete: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting edge:', error)
      alert('Failed to delete connection')
    }
  }, [selectedEdge, deleteAnswerOptionAction, setEdges])

  // Register custom edge types
  const edgeTypes = useMemo(() => ({
    workflowOrthogonal: WorkflowOrthogonalEdge,
  }), [])

  // Register custom node types
  const nodeTypes: NodeTypes = useMemo(() => ({
    decisionNode: WorkflowDecisionNode,
    instructionNode: WorkflowInstructionNode,
    outcomeNode: WorkflowOutcomeNode,
  }), [])

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Legend</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className={`text-xs font-semibold px-2.5 py-1 rounded border ${getNodeTypeColor('INSTRUCTION')}`}>
              INSTRUCTION
            </div>
            <span className="text-sm text-gray-600">Information or checklist</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 bg-amber-50 border-2 border-amber-200"
              style={{ transform: 'rotate(45deg)' }}
            />
            <span className="text-sm text-gray-600">Decision point</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-xs font-semibold px-2.5 py-1 rounded border ${getNodeTypeColor('END')}`}>
              END
            </div>
            <span className="text-sm text-gray-600">Final outcome</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-5 h-5 text-blue-600">
              <InfoIcon />
            </div>
            <span className="text-sm text-gray-600">ⓘ Click for details</span>
          </div>
        </div>
      </div>

      {/* Admin editing mode toggle */}
      {isAdmin && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editingMode}
              onChange={(e) => setEditingMode(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Editing mode</span>
          </label>
          {!editingMode && (
            <p className="text-xs text-gray-500 mt-2">
              Enable editing mode to add, move, and connect nodes.
            </p>
          )}
        </div>
      )}

      {/* Admin toolbar */}
      {effectiveAdmin && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-medium text-gray-700">Add step:</span>
            <button
              onClick={() => handleCreateNode('INSTRUCTION')}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add instruction
            </button>
            <button
              onClick={() => handleCreateNode('QUESTION')}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              Add question
            </button>
            <button
              onClick={() => handleCreateNode('END')}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Add outcome
            </button>
          </div>
          <p className="text-xs text-gray-600">
            Drag nodes to reposition. Connect nodes by dragging from handle to handle. Positions are saved automatically. Tip: hold Shift while dragging to keep steps aligned.
          </p>
        </div>
      )}

      <div className="flex gap-6 h-[800px]">
        {/* Diagram Area */}
        <div className="relative flex-1 bg-white rounded-lg border border-gray-300 overflow-hidden">
          {process.env.NODE_ENV !== 'production' && (
            <div className="absolute top-2 left-2 z-10 rounded bg-white/90 px-2 py-1 text-xs text-gray-700 border border-gray-200 shadow-sm">
              Nodes {nodes.length} · Edges {edges.length}
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onConnect={effectiveAdmin ? onConnect : undefined}
            onNodeDragStart={handleNodeDragStart}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            nodesDraggable={effectiveAdmin}
            edgesFocusable
            snapToGrid={false}
            edgesUpdatable={false}
            selectNodesOnDrag={false}
            connectionMode={ConnectionMode.Strict}
            connectionLineType={ConnectionLineType.SmoothStep}
            isValidConnection={isValidConnection}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.3}
            maxZoom={1.5}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            proOptions={{ hideAttribution: true }}
          >
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

      {/* Side Panel */}
      <div className="w-96 flex-shrink-0">
        {selectedEdge && effectiveAdmin ? (
          // Edge editing panel for admins
          <div className="bg-blue-50 rounded-lg shadow-md p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Connection</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="edge-label" className="block text-sm font-medium text-gray-700 mb-1">
                  Label (leave blank for no label)
                </label>
                <input
                  id="edge-label"
                  type="text"
                  value={editingEdgeLabel}
                  onChange={(e) => setEditingEdgeLabel(e.target.value)}
                  placeholder="e.g. Yes, No, Continue"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdgeLabel}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Save
                </button>
                <button
                  onClick={handleDeleteEdge}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete connection
                </button>
                <button
                  onClick={() => setSelectedEdgeId(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : selectedNode ? (
          effectiveAdmin ? (
            // Admin edit form
            <div className="bg-yellow-50 rounded-lg shadow-md p-6 border border-yellow-200 space-y-4">
              <div>
                <div className={`text-xs font-semibold px-2.5 py-1 rounded border inline-block mb-3 ${getNodeTypeColor(selectedNode.nodeType)}`}>
                  {selectedNode.nodeType}
                </div>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="node-title" className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
                    <input
                      id="node-title"
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="node-body" className="block text-sm font-medium text-gray-700 mb-1">
                      Body
                    </label>
                    <textarea
                      id="node-body"
                      value={editingBody}
                      onChange={(e) => setEditingBody(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {(selectedNode.nodeType === 'END' || selectedNode.actionKey) && (
                    <div>
                      <label htmlFor="node-actionKey" className="block text-sm font-medium text-gray-700 mb-1">
                        Outcome
                      </label>
                      <select
                        id="node-actionKey"
                        value={editingActionKey || 'NONE'}
                        onChange={(e) => setEditingActionKey(e.target.value === 'NONE' ? null : e.target.value as WorkflowActionKey)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="NONE">None</option>
                        {ACTION_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {formatActionKey(key)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* Linked workflows section */}
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Linked workflows
                    </h3>
                    {/* Existing links */}
                    {selectedNode.workflowLinks.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {selectedNode.workflowLinks.map((link) => (
                          <div key={link.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{link.label}</div>
                              <div className="text-xs text-gray-600">{link.template.name}</div>
                            </div>
                            {deleteWorkflowLinkAction && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Remove link to "${link.template.name}"?`)) return
                                  try {
                                    const result = await deleteWorkflowLinkAction(link.id)
                                    if (result.success) {
                                      // Optimistically remove the link from local state for immediate UI feedback
                                      setLocalLinkUpdates(prev => ({
                                        ...prev,
                                        removed: [...prev.removed, link.id]
                                      }))
                                      
                                      // Refresh server data after optimistic update
                                      router.refresh()
                                    } else {
                                      alert(`Failed to remove link: ${result.error || 'Unknown error'}`)
                                    }
                                  } catch (error) {
                                    console.error('Error deleting workflow link:', error)
                                    alert('Failed to remove link')
                                  }
                                }}
                                className="ml-2 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Add new link */}
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="node-newLinkTemplateId" className="block text-sm font-medium text-gray-700 mb-1">
                          Add workflow template
                        </label>
                        <select
                          id="node-newLinkTemplateId"
                          value={editingNewLinkTemplateId}
                          onChange={(e) => setEditingNewLinkTemplateId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="NONE">Select workflow...</option>
                          {allTemplates.filter(t => t.id !== template.id && !selectedNode.workflowLinks.some(l => l.templateId === t.id)).map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {editingNewLinkTemplateId !== 'NONE' && (
                        <>
                          <div>
                            <label htmlFor="node-newLinkLabel" className="block text-sm font-medium text-gray-700 mb-1">
                              Link label
                            </label>
                            <input
                              type="text"
                              id="node-newLinkLabel"
                              value={editingNewLinkLabel}
                              onChange={(e) => setEditingNewLinkLabel(e.target.value)}
                              placeholder="Open linked workflow"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          {createWorkflowLinkAction && (
                            <button
                              onClick={async () => {
                                try {
                                  if (editingNewLinkTemplateId === 'NONE') {
                                    alert('Please select a workflow template first')
                                    return
                                  }
                                  
                                  const result = await createWorkflowLinkAction(selectedNode.id, editingNewLinkTemplateId, editingNewLinkLabel || 'Open linked workflow')
                                  if (result.success && result.link) {
                                    // Optimistically add the link to local state for immediate UI feedback
                                    setLocalLinkUpdates(prev => {
                                      return {
                                        ...prev,
                                        added: [...prev.added, result.link!]
                                      }
                                    })
                                    // Reset form
                                    setEditingNewLinkTemplateId('NONE')
                                    setEditingNewLinkLabel('Open linked workflow')
                                    
                                    // Refresh server data after optimistic update
                                    router.refresh()
                                  } else {
                                    alert(`Failed to add link: ${result.error || 'Unknown error'}`)
                                  }
                                } catch (error) {
                                  console.error('Error creating workflow link:', error)
                                  alert('Failed to add link')
                                }
                              }}
                              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              Add link
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {selectedNode.answerOptions.length > 0 && (
                    <div className="pt-4 border-t border-yellow-300">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        Connections
                      </h3>
                      <ul className="space-y-1">
                        {selectedNode.answerOptions.map((option) => (
                          <li key={option.id} className="text-sm text-gray-800">
                            <span className="font-medium">{option.label || '(no label)'}</span>
                            {option.nextNodeId && (
                              <span className="text-gray-600 ml-2">
                                → {template.nodes.find((n) => n.id === option.nextNodeId)?.title || 'Next node'}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick add next step */}
              <div className="pt-4 border-t border-yellow-300">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Add next step
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleQuickCreateConnectedNode('INSTRUCTION')}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Add instruction
                  </button>
                  <button
                    onClick={() => handleQuickCreateConnectedNode('QUESTION')}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    Add question
                  </button>
                  <button
                    onClick={() => handleQuickCreateConnectedNode('END')}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Add outcome
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-yellow-300">
                <button
                  onClick={handleSaveNode}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Save changes
                </button>
                <button
                  onClick={handleDeleteNode}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete node
                </button>
                <button
                  onClick={() => {
                    setSelectedNodeId(null)
                    setEditingTitle('')
                    setEditingBody('')
                    setEditingActionKey(null)
                    setEditingNewLinkTemplateId('NONE')
                    setEditingNewLinkLabel('Open linked workflow')
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // Read-only view for non-admins and preview mode
            <div className="bg-yellow-50 rounded-lg shadow-md p-6 border border-yellow-200">
              <div className="mb-4">
                <div className={`text-xs font-semibold px-2.5 py-1 rounded border inline-block mb-3 ${getNodeTypeColor(selectedNode.nodeType)}`}>
                  {selectedNode.nodeType}
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                  {selectedNode.title}
                </h2>
                {/* Linked workflows buttons */}
                {selectedNode.workflowLinks.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {selectedNode.workflowLinks.map((link) => (
                      <Link
                        key={link.id}
                        href={`/s/${surgeryId}/workflow/templates/${link.templateId}/view`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      >
                        ↗ {link.label}
                      </Link>
                    ))}
                  </div>
                )}
                {selectedNode.body && (
                  <div className="text-gray-800 whitespace-pre-wrap mb-4 text-sm leading-relaxed">
                    {selectedNode.body.split('\n').map((line, index) => (
                      <p key={index} className={index > 0 ? 'mt-2' : ''}>{line || '\u00A0'}</p>
                    ))}
                  </div>
                )}
              </div>

              {selectedNode.actionKey && (
                <div className="mt-4 pt-4 border-t border-yellow-300">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    Outcome
                  </h3>
                  <p className="text-sm text-gray-800">
                    {getActionKeyDescription(selectedNode.actionKey)}
                  </p>
                </div>
              )}

              {selectedNode.answerOptions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-yellow-300">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Answer Options
                  </h3>
                  <ul className="space-y-2">
                    {selectedNode.answerOptions.map((option) => (
                      <li key={option.id} className="text-sm text-gray-800">
                        <span className="font-medium">{option.label || '(no label)'}</span>
                        {option.nextNodeId && (
                          <span className="text-gray-600 ml-2">
                            → {template.nodes.find((n) => n.id === option.nextNodeId)?.title || 'Next node'}
                          </span>
                        )}
                        {option.actionKey && !option.nextNodeId && (
                          <span className="text-gray-600 ml-2">
                            → {getActionKeyDescription(option.actionKey)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={() => setSelectedNodeId(null)}
                className="mt-6 text-sm text-gray-700 hover:text-gray-900 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                Clear details
              </button>
            </div>
          )
        ) : (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <p className="text-sm text-gray-600 leading-relaxed">
              {isAdmin 
                ? 'Click a node to edit it, or click a connection to edit its label. Drag from node handles to create connections.'
                : (
                  <>
                    Click a node with the <span className="inline-flex items-center text-blue-600">ⓘ</span> icon in the diagram to view reference details.
                  </>
                )}
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

