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
  NodeChange,
  applyNodeChanges,
} from 'reactflow'
import 'reactflow/dist/style.css'
import './panel-styles.css'
import { WorkflowNodeType, WorkflowActionKey } from '@prisma/client'
import WorkflowDecisionNode from './WorkflowDecisionNode'
import WorkflowInstructionNode from './WorkflowInstructionNode'
import WorkflowOutcomeNode from './WorkflowOutcomeNode'
import WorkflowPanelNode from './WorkflowPanelNode'
import { renderBulletText } from './renderBulletText'

interface WorkflowNode {
  id: string
  nodeType: WorkflowNodeType
  title: string
  body: string | null
  sortOrder: number
  positionX: number | null
  positionY: number | null
  actionKey: WorkflowActionKey | null
  badges: string[] // Array of badge strings (e.g. ["STAMP"])
  style: {
    bgColor?: string
    textColor?: string
    borderColor?: string
    borderWidth?: number
    radius?: number
    fontWeight?: 'normal' | 'medium' | 'bold'
    theme?: 'default' | 'info' | 'warning' | 'success' | 'muted' | 'panel'
  } | null
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
  updateNodeAction?: (
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
    } | null
  ) => Promise<{ success: boolean; error?: string }>
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
}: WorkflowDiagramClientProps) {
  const router = useRouter()
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  
  // PANEL dimension constants
  const PANEL_MIN_W = 300
  const PANEL_MIN_H = 200

  // Track active panel resize sessions (user-driven resizes only)
  const activePanelResizeRef = useRef<Map<string, { lastWidth: number; lastHeight: number; lastSeenAt: number }>>(new Map())
  
  // Track resize-end timeouts per node
  const resizeEndTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  
  // Track nodes that are currently being resized to prevent overwriting from DB refresh
  const resizingNodesRef = useRef<Set<string>>(new Set())
  
  // Ref to track current nodes state for async operations
  const nodesRef = useRef<Node[]>([])
  
  // Editing state for admin
  const [editingTitle, setEditingTitle] = useState('')
  const [editingBody, setEditingBody] = useState('')
  const [editingActionKey, setEditingActionKey] = useState<WorkflowActionKey | null>(null)
  const [editingEdgeLabel, setEditingEdgeLabel] = useState('')
  const [editingLinkedWorkflows, setEditingLinkedWorkflows] = useState<Array<{ id?: string; toTemplateId: string; label: string; sortOrder: number }>>([])
  const [editingBadges, setEditingBadges] = useState<string[]>([])
  const [editingStyle, setEditingStyle] = useState<{
    bgColor?: string
    textColor?: string
    borderColor?: string
    borderWidth?: number
    radius?: number
    fontWeight?: 'normal' | 'medium' | 'bold'
    theme?: 'default' | 'info' | 'warning' | 'success' | 'muted' | 'panel'
    width?: number
    height?: number
  } | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')
  const [legendExpanded, setLegendExpanded] = useState(false)
  
  // Persist editingMode in localStorage so it survives page refreshes
  const [editingMode, setEditingMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`workflow-editing-mode-${template.id}`)
      return saved === 'true'
    }
    return false
  })
  const [mounted, setMounted] = useState(false)
  
  // Save editingMode to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`workflow-editing-mode-${template.id}`, String(editingMode))
    }
  }, [editingMode, template.id])

  useEffect(() => {
    setMounted(true)
  }, [])
  
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

  // Find selected node data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return template.nodes.find((n) => n.id === selectedNodeId) || null
  }, [selectedNodeId, template.nodes])

  // Initialize editing state when node is selected
  useEffect(() => {
    if (selectedNode && effectiveAdmin) {
      setEditingTitle(selectedNode.title)
      setEditingBody(selectedNode.body || '')
      setEditingActionKey(selectedNode.actionKey)
      setEditingBadges(selectedNode.badges || [])
      setEditingStyle(selectedNode.style)
      // Initialize linked workflows from node data
      const sortedLinks = [...selectedNode.workflowLinks].sort((a, b) => {
        // Links should already be sorted by sortOrder from query
        return 0
      })
      setEditingLinkedWorkflows(
        sortedLinks.map((link, index) => ({
          id: link.id,
          toTemplateId: link.templateId,
          label: link.label,
          sortOrder: index,
        }))
      )
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
      } else if (node.nodeType === 'PANEL') {
        nodeType = 'panelNode'
      } else {
        nodeType = 'default'
      }

      // For PANEL nodes, compute dimensions from DB style (source of truth)
      // Always set width/height from computed values, never fall back to measured/current values
      const nodeDimensions = node.nodeType === 'PANEL' 
        ? (() => {
            const styleWidth = (node.style as { width?: number } | null)?.width
            const styleHeight = (node.style as { height?: number } | null)?.height
            // Compute from DB style, clamp to minimums
            const width = Math.max(styleWidth ?? 500, PANEL_MIN_W)
            const height = Math.max(styleHeight ?? 400, PANEL_MIN_H)
            return { width, height }
          })()
        : {}
      
      return {
        id: node.id,
        type: nodeType,
        position: { x, y },
        ...nodeDimensions,
        className: node.nodeType === 'PANEL' ? 'panel' : undefined,
        selected: isSelected,
        data: node.nodeType === 'QUESTION' ? {
          // For QUESTION nodes, pass data to custom component (diamond shape)
          nodeType: node.nodeType,
          title: node.title,
          body: node.body,
          hasBody,
          badges: node.badges || [],
          style: node.style,
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
          badges: node.badges || [],
          style: node.style,
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
          badges: node.badges || [],
          style: node.style,
          isSelected,
          isAdmin: effectiveAdmin,
          onNodeClick: () => toggleNodeSelection(node.id),
          onInfoClick: () => toggleNodeSelection(node.id),
          getActionKeyDescription,
        } : node.nodeType === 'PANEL' ? {
          // For PANEL nodes, pass data to custom component
          nodeType: node.nodeType,
          title: node.title,
          badges: node.badges || [],
          style: node.style,
          isSelected,
          isAdmin: effectiveAdmin,
          onNodeClick: () => toggleNodeSelection(node.id),
        } : {
          // Fallback for any other node types (shouldn't happen)
          label: (
            <>
              {/* Target handle (top) - connections come IN */}
              <Handle
                id="target-top"
                type="target"
                position={Position.Top}
                className={effectiveAdmin ? 'w-3 h-3 !bg-blue-500' : 'w-3 h-3 opacity-0 pointer-events-none'}
              />
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
              <Handle
                id="source-bottom"
                type="source"
                position={Position.Bottom}
                className={effectiveAdmin ? 'w-3 h-3 !bg-blue-500' : 'w-3 h-3 opacity-0 pointer-events-none'}
              />
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
    const nodeIds = new Set(template.nodes.map((n) => n.id))

    template.nodes.forEach((node) => {
      node.answerOptions.forEach((option) => {
        if (option.nextNodeId) {
          if (process.env.NODE_ENV !== 'production' && !nodeIds.has(option.nextNodeId)) {
            console.warn('WorkflowDiagramClient: answer option references missing node', {
              templateId: template.id,
              fromNodeId: node.id,
              optionId: option.id,
              nextNodeId: option.nextNodeId,
            })
          }

          const labelText = (option.label ?? '').trim()
          const hasLabel = labelText !== ''
          edgesFromTemplate.push({
            id: option.id,
            source: node.id,
            target: option.nextNodeId,
            sourceHandle: option.sourceHandle ?? 'source-bottom',
            targetHandle: option.targetHandle ?? 'target-top',
            label: hasLabel ? labelText : undefined,
            labelStyle: hasLabel
              ? { fontSize: 12, fontWeight: 600, color: '#0b4670', transform: 'translateY(-6px)' }
              : undefined,
            labelBgStyle: hasLabel ? { fill: '#ffffff', stroke: '#76a9fa', strokeWidth: 1 } : undefined,
            labelBgPadding: hasLabel ? [6, 4] : undefined,
            labelBgBorderRadius: hasLabel ? 8 : undefined,
            type: 'step',
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

  // Update ref whenever nodes change
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  
  // Helper function to merge incoming nodes into current nodes, preserving PANEL dimensions during active resize only
  const mergeFlowNodes = useCallback((currentNodes: Node[], incomingNodes: Node[]): Node[] => {
    const currentById = new Map(currentNodes.map(n => [n.id, n]))
    
    // Merge: update existing, add new, preserve PANEL dimensions only during active resize
    const merged: Node[] = incomingNodes.map((incomingNode) => {
      const currentNode = currentById.get(incomingNode.id)
      
      if (!currentNode) {
        // New node - use as-is (dimensions already computed from DB in flowNodes)
        return incomingNode
      }
      
      // Existing node - merge properties
      const mergedNode = { ...incomingNode }
      
      // For PANEL nodes: check if user is actively resizing
      const isPanelNode = incomingNode.type === 'panelNode'
      if (isPanelNode) {
        const nodeId = incomingNode.id
        const isActivelyResizing = activePanelResizeRef.current.has(nodeId)
        
        if (isActivelyResizing) {
          // User is actively resizing - preserve current dimensions from React Flow state
          if (currentNode.width !== undefined && currentNode.height !== undefined) {
            mergedNode.width = Math.max(currentNode.width, PANEL_MIN_W)
            mergedNode.height = Math.max(currentNode.height, PANEL_MIN_H)
          }
        } else {
          // Not actively resizing - use incoming dimensions from DB (source of truth)
          // Clamp to minimums
          if (mergedNode.width !== undefined) {
            mergedNode.width = Math.max(mergedNode.width, PANEL_MIN_W)
          }
          if (mergedNode.height !== undefined) {
            mergedNode.height = Math.max(mergedNode.height, PANEL_MIN_H)
          }
        }
      }
      
      // Preserve selection state
      mergedNode.selected = currentNode.selected
      
      return mergedNode
    })
    
    return merged
  }, [])
  
  // Track if this is the initial load
  const isInitialLoadRef = useRef(true)
  const previousFlowNodesRef = useRef<Node[]>([])
  
  useEffect(() => {
    // On initial load, set nodes directly
    if (isInitialLoadRef.current) {
      setNodes(flowNodes)
      nodesRef.current = flowNodes
      previousFlowNodesRef.current = flowNodes
      isInitialLoadRef.current = false
      return
    }
    
    // Check if flowNodes actually changed (compare IDs and key properties including dimensions)
    const nodesChanged = flowNodes.length !== previousFlowNodesRef.current.length ||
      flowNodes.some((fn, idx) => {
        const prev = previousFlowNodesRef.current[idx]
        return !prev || 
          fn.id !== prev.id || 
          fn.type !== prev.type ||
          fn.position.x !== prev.position.x ||
          fn.position.y !== prev.position.y ||
          fn.width !== prev.width ||
          fn.height !== prev.height ||
          (fn.data as any)?.title !== (prev.data as any)?.title
      })
    
    if (!nodesChanged) {
      // Nothing changed, don't update
      return
    }
    
    previousFlowNodesRef.current = flowNodes
    
    // After initial load, merge incoming nodes with current nodes (preserves PANEL dimensions)
    setNodes((currentNodes) => {
      const merged = mergeFlowNodes(currentNodes, flowNodes)
      nodesRef.current = merged
      return merged
    })
  }, [flowNodes, setNodes, mergeFlowNodes])

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

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current)
      }
      // Clear all resize-end timeouts
      resizeEndTimeoutRef.current.forEach((timeout) => {
        clearTimeout(timeout)
      })
      resizeEndTimeoutRef.current.clear()
    }
  }, [])
  
  // Custom onNodesChange handler to intercept panel dimension changes
  // Only persists dimensions for user-driven resizes, ignoring React Flow measurement/reflow events
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // First, apply changes using React Flow's built-in handler
    onNodesChangeInternal(changes)
    
    // Then intercept dimension changes for PANEL nodes
    if (effectiveAdmin && updateNodeAction) {
      for (const change of changes) {
        if (change.type === 'dimensions' && change.dimensions) {
          const nodeId = change.id
          
          // Check if this is a panel node from template
          const originalNode = template.nodes.find((n) => n.id === nodeId)
          const isPanelNode = originalNode?.nodeType === 'PANEL'
          
          if (!isPanelNode || !originalNode) {
            continue
          }
          
          const { width, height } = change.dimensions
          const isResizing = change.resizing === true
          const resizingUndefined = change.resizing === undefined
          
          if (isResizing) {
            // User is actively resizing - track this as an active resize session
            activePanelResizeRef.current.set(nodeId, {
              lastWidth: width,
              lastHeight: height,
              lastSeenAt: Date.now()
            })
            
            // Clear any existing resize-end timeout for this node
            const existingTimeout = resizeEndTimeoutRef.current.get(nodeId)
            if (existingTimeout) {
              clearTimeout(existingTimeout)
              resizeEndTimeoutRef.current.delete(nodeId)
            }
            
            // Set a new timeout to save when resize ends (user stops dragging)
            const timeoutId = setTimeout(() => {
              const activeResize = activePanelResizeRef.current.get(nodeId)
              if (!activeResize || !originalNode) {
                return
              }
              
              // Apply minimum size constraints
              const minWidth = 300
              const minHeight = 200
              const finalWidth = Math.max(activeResize.lastWidth, minWidth)
              const finalHeight = Math.max(activeResize.lastHeight, minHeight)
              
              // Merge width/height into existing style
              const currentStyle = originalNode.style || {}
              const updatedStyle = {
                ...currentStyle,
                width: finalWidth,
                height: finalHeight,
              }
              
              // Save to DB - this is the ONLY save point for user resizes
              updateNodeAction(
                nodeId,
                originalNode.title,
                originalNode.body,
                originalNode.actionKey,
                undefined, // linkedWorkflows
                originalNode.badges || [],
                updatedStyle
              ).catch((error) => {
                console.error('Error updating panel dimensions:', error)
              })
              
              // Clean up: remove from active resize tracking and timeout map
              activePanelResizeRef.current.delete(nodeId)
              resizeEndTimeoutRef.current.delete(nodeId)
            }, 250) // Debounce: save 250ms after user stops resizing
            
            resizeEndTimeoutRef.current.set(nodeId, timeoutId)
            
          } else if (resizingUndefined || change.resizing === false) {
            // This is a measurement/reflow event (resizing === undefined) or explicit end (resizing === false)
            // Only persist if we're in an active resize session (user was resizing)
            const activeResize = activePanelResizeRef.current.get(nodeId)
            
            if (!activeResize) {
              // No active resize session - this is a React Flow measurement/reflow event
              // Ignore it completely to prevent overwriting correct dimensions
              continue
            }
            
            // We have an active session, but resizing is now undefined/false
            // This means the resize ended - use the tracked dimensions from the session
            // Clear any existing timeout and save immediately
            const existingTimeout = resizeEndTimeoutRef.current.get(nodeId)
            if (existingTimeout) {
              clearTimeout(existingTimeout)
              resizeEndTimeoutRef.current.delete(nodeId)
            }
            
            // Apply minimum size constraints
            const minWidth = 300
            const minHeight = 200
            const finalWidth = Math.max(activeResize.lastWidth, minWidth)
            const finalHeight = Math.max(activeResize.lastHeight, minHeight)
            
            // Merge width/height into existing style
            const currentStyle = originalNode.style || {}
            const updatedStyle = {
              ...currentStyle,
              width: finalWidth,
              height: finalHeight,
            }
            
            // Save to DB
            updateNodeAction(
              nodeId,
              originalNode.title,
              originalNode.body,
              originalNode.actionKey,
              undefined, // linkedWorkflows
              originalNode.badges || [],
              updatedStyle
            ).catch((error) => {
              console.error('Error updating panel dimensions:', error)
            })
            
            // Clean up: remove from active resize tracking
            activePanelResizeRef.current.delete(nodeId)
          }
        }
      }
    }
  }, [onNodesChangeInternal, effectiveAdmin, updateNodeAction, template.nodes])

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
      const result = await createAnswerOptionAction(
        connection.source,
        connection.target,
        label,
        connection.sourceHandle ?? 'source-bottom',
        connection.targetHandle ?? 'target-top'
      )
      if (result.success && result.option) {
        // Add new edge to the edges state
        const edgeLabel = result.option.label && result.option.label.trim() !== '' ? result.option.label.trim() : undefined
        const newEdge: Edge = {
          id: result.option.id,
          source: connection.source!,
          target: connection.target!,
          sourceHandle: connection.sourceHandle ?? 'source-bottom',
          targetHandle: connection.targetHandle ?? 'target-top',
          label: edgeLabel,
          labelStyle: edgeLabel ? { fontSize: 12, fontWeight: 600, color: '#0b4670', transform: 'translateY(-6px)' } : undefined,
          labelBgStyle: edgeLabel ? { fill: '#ffffff', stroke: '#76a9fa', strokeWidth: 1 } : undefined,
          labelBgPadding: edgeLabel ? [6, 4] : undefined,
          labelBgBorderRadius: edgeLabel ? 8 : undefined,
          type: 'step',
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

        // Map node types to custom components
        let newNodeType: string
        if (nodeType === 'QUESTION') {
          newNodeType = 'decisionNode'
        } else if (nodeType === 'INSTRUCTION') {
          newNodeType = 'instructionNode'
        } else if (nodeType === 'END') {
          newNodeType = 'outcomeNode'
        } else if (nodeType === 'PANEL') {
          newNodeType = 'panelNode'
        } else {
          newNodeType = 'default'
        }

        // For PANEL nodes, add initial dimensions
        const newNodeDimensions = nodeType === 'PANEL' 
          ? { width: 500, height: 400 } 
          : {}
        
        const newNode: Node = {
          id: result.node.id,
          type: newNodeType,
          position: { x: initialX, y: initialY },
          ...newNodeDimensions,
          className: nodeType === 'PANEL' ? 'panel' : undefined,
          selected: false,
          data: nodeType === 'QUESTION' ? {
            nodeType: result.node.nodeType,
            title: result.node.title,
            body: result.node.body,
            hasBody: false,
            badges: result.node.badges || [],
            style: result.node.style,
            isSelected: false,
            isAdmin,
            onNodeClick: () => {},
            onInfoClick: () => {},
          } : nodeType === 'INSTRUCTION' ? {
            nodeType: result.node.nodeType,
            title: result.node.title,
            body: result.node.body,
            hasBody: false,
            badges: result.node.badges || [],
            style: result.node.style,
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
            badges: result.node.badges || [],
            style: result.node.style,
            isSelected: false,
            isAdmin,
            onNodeClick: () => {},
            onInfoClick: () => {},
            getActionKeyDescription,
          } : nodeType === 'PANEL' ? {
            nodeType: result.node.nodeType,
            title: result.node.title,
            badges: result.node.badges || [],
            style: result.node.style,
            isSelected: false,
            isAdmin,
            onNodeClick: () => {},
          } : {
            nodeType: result.node.nodeType,
            title: result.node.title,
            body: result.node.body,
            actionKey: result.node.actionKey,
            hasBody: false,
            badges: result.node.badges || [],
            style: result.node.style,
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
      const linkedWorkflows = editingLinkedWorkflows.map((link, index) => ({
        id: link.id,
        toTemplateId: link.toTemplateId,
        label: link.label || 'Open linked workflow',
        sortOrder: index,
      }))
      
      const result = await updateNodeAction(
        selectedNode.id, 
        editingTitle, 
        editingBody || null, 
        editingActionKey,
        linkedWorkflows,
        editingBadges,
        editingStyle
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
  }, [selectedNode, updateNodeAction, editingTitle, editingBody, editingActionKey, editingLinkedWorkflows, editingBadges, editingStyle, router])

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
      } else if (nodeType === 'PANEL') {
        newNodeType = 'panelNode'
      } else {
        newNodeType = 'default'
      }
      
      // For PANEL nodes, add initial dimensions
      const newNodeDimensions = nodeType === 'PANEL' 
        ? { width: 500, height: 400 } 
        : {}
      
      const newNode: Node = {
        id: result.node.id,
        type: newNodeType,
        position: { x: newX, y: newY },
        ...newNodeDimensions,
        className: nodeType === 'PANEL' ? 'panel' : undefined,
        selected: false,
        data: nodeType === 'QUESTION' ? {
          nodeType: result.node.nodeType,
          title: result.node.title,
          body: result.node.body,
          hasBody: false,
          badges: result.node.badges || [],
          style: result.node.style,
          isSelected: false,
          isAdmin,
          onNodeClick: () => {},
          onInfoClick: () => {},
        } : nodeType === 'INSTRUCTION' ? {
          nodeType: result.node.nodeType,
          title: result.node.title,
          body: result.node.body,
          hasBody: false,
          badges: result.node.badges || [],
          style: result.node.style,
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
          badges: result.node.badges || [],
          style: result.node.style,
          isSelected: false,
          isAdmin,
          onNodeClick: () => {},
          onInfoClick: () => {},
          getActionKeyDescription,
        } : nodeType === 'PANEL' ? {
          nodeType: result.node.nodeType,
          title: result.node.title,
          badges: result.node.badges || [],
          style: result.node.style,
          isSelected: false,
          isAdmin,
          onNodeClick: () => {},
        } : {
          // Fallback for any other node types (shouldn't happen)
          nodeType: result.node.nodeType,
          title: result.node.title,
          body: result.node.body,
          hasBody: false,
          badges: result.node.badges || [],
          style: result.node.style,
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
        type: 'step',
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

  // Register custom node types
  const nodeTypes: NodeTypes = useMemo(() => ({
    decisionNode: WorkflowDecisionNode,
    instructionNode: WorkflowInstructionNode,
    outcomeNode: WorkflowOutcomeNode,
    panelNode: WorkflowPanelNode,
  }), [])


  if (!mounted) {
    return (
      <div className="min-h-[600px] bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-sm text-gray-600">
        Loading diagram…
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Admin toolbar */}
      {effectiveAdmin && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-medium text-gray-700">Add step:</span>
            <button
              onClick={() => handleCreateNode('INSTRUCTION')}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Add instruction
            </button>
            <button
              onClick={() => handleCreateNode('QUESTION')}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
            >
              Add question
            </button>
            <button
              onClick={() => handleCreateNode('END')}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
            >
              Add outcome
            </button>
            <button
              onClick={() => handleCreateNode('PANEL')}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-600 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              Add panel
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Drag nodes to reposition. Connect nodes by dragging from handle to handle. Positions are saved automatically. Tip: hold Shift while dragging to keep steps aligned.
          </p>
        </div>
      )}

      <div className="flex gap-8">
        {/* Diagram Area - More whitespace, softer borders */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Subtle editing mode banner */}
          {editingMode && isAdmin && (
            <div className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-md">
              <p className="text-xs text-blue-700 font-medium">
                Editing mode active
              </p>
            </div>
          )}
          <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-colors flex-1 min-h-[800px] ${
            editingMode && isAdmin 
              ? 'border-blue-200' 
              : 'border-gray-200'
          }`}>
          {process.env.NODE_ENV !== 'production' && (
            <div className="absolute top-2 left-2 z-10 rounded bg-white/90 px-2 py-1 text-xs text-gray-700 border border-gray-200 shadow-sm">
              Nodes {nodes.length} · Edges {edges.length}
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
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
            connectionLineType={ConnectionLineType.Step}
            isValidConnection={isValidConnection}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.3}
            maxZoom={1.5}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            proOptions={{ hideAttribution: true }}
            className="react-flow-panels-below"
          >
            <Controls showInteractive={false} />
          </ReactFlow>
          </div>
        </div>

      {/* Side Panel - Only show when editing mode ON and no node/edge selected */}
      <div className="w-96 flex-shrink-0">
        {selectedEdge && effectiveAdmin ? (
          // Edge editing panel for admins
          <div className="bg-blue-50 rounded-lg shadow-md p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Connection</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <span className="font-semibold">Connection ID:</span>
                <span className="px-2 py-1 bg-white border border-gray-300 rounded text-gray-800 truncate" title={selectedEdge.option.id}>
                  {selectedEdge.option.id}
                </span>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedEdge.option.id)
                      setCopyStatus('copied')
                      setTimeout(() => setCopyStatus('idle'), 1200)
                    } catch (err) {
                      console.error('Copy failed', err)
                    }
                  }}
                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  Copy
                </button>
                {copyStatus === 'copied' && <span className="text-green-700">Copied</span>}
              </div>
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
                  
                  {/* Badges section */}
                  <div className="pt-4 border-t border-gray-200">
                    <label htmlFor="node-badges" className="block text-sm font-medium text-gray-700 mb-2">
                      Badges
                    </label>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {['STAMP'].map((badge) => (
                          <label key={badge} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editingBadges.includes(badge)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditingBadges([...editingBadges, badge])
                                } else {
                                  setEditingBadges(editingBadges.filter(b => b !== badge))
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{badge}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Style section */}
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Node Styling
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="node-theme" className="block text-sm font-medium text-gray-700 mb-1">
                          Theme
                        </label>
                        <select
                          id="node-theme"
                          value={editingStyle?.theme || 'default'}
                          onChange={(e) => {
                            const theme = e.target.value as 'default' | 'info' | 'warning' | 'success' | 'muted' | 'panel' | 'default'
                            setEditingStyle({
                              ...editingStyle,
                              theme: theme === 'default' ? undefined : theme,
                            })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="default">Default</option>
                          <option value="info">Info (Blue)</option>
                          <option value="warning">Warning (Amber)</option>
                          <option value="success">Success (Green)</option>
                          <option value="muted">Muted (Gray)</option>
                          <option value="panel">Panel (Background)</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="node-bg-color" className="block text-xs font-medium text-gray-600 mb-1">
                            Background
                          </label>
                          <input
                            id="node-bg-color"
                            type="color"
                            value={editingStyle?.bgColor || '#ffffff'}
                            onChange={(e) => {
                              setEditingStyle({
                                ...editingStyle,
                                bgColor: e.target.value,
                              })
                            }}
                            className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                          />
                        </div>
                        <div>
                          <label htmlFor="node-text-color" className="block text-xs font-medium text-gray-600 mb-1">
                            Text
                          </label>
                          <input
                            id="node-text-color"
                            type="color"
                            value={editingStyle?.textColor || '#111827'}
                            onChange={(e) => {
                              setEditingStyle({
                                ...editingStyle,
                                textColor: e.target.value,
                              })
                            }}
                            className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="node-border-color" className="block text-xs font-medium text-gray-600 mb-1">
                          Border
                        </label>
                        <input
                          id="node-border-color"
                          type="color"
                          value={editingStyle?.borderColor || '#e5e7eb'}
                          onChange={(e) => {
                            setEditingStyle({
                              ...editingStyle,
                              borderColor: e.target.value,
                            })
                          }}
                          className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStyle(null)
                        }}
                        className="w-full px-3 py-1.5 text-sm text-gray-600 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Reset to defaults
                      </button>
                    </div>
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
                    {/* Repeatable list editor */}
                    <div className="space-y-3">
                      {editingLinkedWorkflows.map((link, index) => {
                        const availableTemplates = allTemplates?.filter(
                          (t) => t.id !== template.id && !editingLinkedWorkflows.some((l, i) => i !== index && l.toTemplateId === t.id)
                        ) || []
                        return (
                          <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded border border-gray-200">
                            <div className="flex-1 space-y-2">
                              <select
                                value={link.toTemplateId}
                                onChange={(e) => {
                                  const updated = [...editingLinkedWorkflows]
                                  updated[index] = { ...updated[index], toTemplateId: e.target.value }
                                  setEditingLinkedWorkflows(updated)
                                }}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select workflow...</option>
                                {availableTemplates.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={link.label}
                                onChange={(e) => {
                                  const updated = [...editingLinkedWorkflows]
                                  updated[index] = { ...updated[index], label: e.target.value }
                                  setEditingLinkedWorkflows(updated)
                                }}
                                placeholder="Open linked workflow"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              {index > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...editingLinkedWorkflows]
                                    const temp = updated[index]
                                    updated[index] = updated[index - 1]
                                    updated[index - 1] = temp
                                    setEditingLinkedWorkflows(updated.map((l, i) => ({ ...l, sortOrder: i })))
                                  }}
                                  className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                                  title="Move up"
                                >
                                  ↑
                                </button>
                              )}
                              {index < editingLinkedWorkflows.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...editingLinkedWorkflows]
                                    const temp = updated[index]
                                    updated[index] = updated[index + 1]
                                    updated[index + 1] = temp
                                    setEditingLinkedWorkflows(updated.map((l, i) => ({ ...l, sortOrder: i })))
                                  }}
                                  className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                                  title="Move down"
                                >
                                  ↓
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLinkedWorkflows(editingLinkedWorkflows.filter((_, i) => i !== index).map((l, i) => ({ ...l, sortOrder: i })))
                                }}
                                className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                title="Remove"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLinkedWorkflows([
                            ...editingLinkedWorkflows,
                            { toTemplateId: '', label: 'Open linked workflow', sortOrder: editingLinkedWorkflows.length },
                          ])
                        }}
                        className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      >
                        + Add linked workflow
                      </button>
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
                    setEditingLinkedWorkflows([])
                    setEditingBadges([])
                    setEditingStyle(null)
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
                {selectedNode.body && (
                  <div className="text-gray-800 mb-4 text-sm leading-relaxed">
                    {renderBulletText(selectedNode.body)}
                  </div>
                )}
                {/* Linked workflows list */}
                {selectedNode.workflowLinks.length > 0 && (
                  <div className="mb-4 pt-4 border-t border-yellow-300">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Linked workflows
                    </h3>
                    <p className="text-xs text-gray-600 mb-3">
                      Select the most appropriate pathway to continue.
                    </p>
                    <div className="space-y-2">
                      {selectedNode.workflowLinks.map((link) => (
                        <Link
                          key={link.id}
                          href={`/s/${surgeryId}/workflow/templates/${link.templateId}/view`}
                          className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        >
                          <span className="font-medium">{link.label}</span>
                          <span className="text-gray-400">↗</span>
                        </Link>
                      ))}
                    </div>
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

              {(() => {
                const labelledOptions = selectedNode.answerOptions.filter(
                  (o) => (o.label ?? '').trim().length > 0
                )
                if (labelledOptions.length === 0) return null
                return (
                  <div className="mt-4 pt-4 border-t border-yellow-300">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Answer Options
                    </h3>
                    <ul className="space-y-2">
                      {labelledOptions.map((option) => (
                        <li key={option.id} className="text-sm text-gray-800">
                          <span className="font-medium">{option.label}</span>
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
                )
              })()}

              <button
                onClick={() => setSelectedNodeId(null)}
                className="mt-6 text-sm text-gray-700 hover:text-gray-900 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                Clear details
              </button>
            </div>
          )
        ) : effectiveAdmin && !selectedNode && !selectedEdge ? (
          // Helper panel - only shown when editing mode is ON and nothing is selected
          <div className="space-y-4">
            {/* View/Editing mode toggle - segmented control */}
            {isAdmin && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Mode
                </label>
                <div className="flex rounded-md border border-gray-200 overflow-hidden" role="group" aria-label="View or edit mode">
                  <button
                    type="button"
                    onClick={() => setEditingMode(false)}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                      !editingMode
                        ? 'bg-gray-50 text-gray-700 border-r border-gray-200'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                    aria-pressed={!editingMode}
                  >
                    Viewing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editingMode) {
                        if (confirm("You're entering editing mode. Changes affect staff guidance.\n\nContinue?")) {
                          setEditingMode(true)
                        }
                      } else {
                        setEditingMode(true)
                      }
                    }}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                      editingMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-pressed={editingMode}
                  >
                    Editing
                  </button>
                </div>
                {editingMode && (
                  <p className="text-xs text-gray-500 mt-2">
                    Editing mode active
                  </p>
                )}
              </div>
            )}
            
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Getting started</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                Click a node to edit it, or click a connection to edit its label. Drag from node handles to create connections.
              </p>
              <div className="space-y-2 text-xs text-gray-500">
                <p>• Use the toolbar above to add new steps</p>
                <p>• Drag nodes to reposition them</p>
                <p>• Hold Shift while dragging to lock to one axis</p>
              </div>
            </div>
            
            {/* Diagram legend - collapsible, visually quiet */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setLegendExpanded(!legendExpanded)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                aria-expanded={legendExpanded}
                aria-label="Toggle diagram legend"
              >
                <span className="font-medium text-gray-700">Diagram legend</span>
                <svg
                  className={`w-4 h-4 transition-transform ${legendExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {legendExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                  <div className="flex flex-col gap-3">
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
              )}
            </div>
          </div>
        ) : !effectiveAdmin && !selectedNode ? (
          <div className="space-y-4">
            {/* View/Editing mode toggle - segmented control (admin only) */}
            {isAdmin && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Mode
                </label>
                <div className="flex rounded-md border border-gray-200 overflow-hidden" role="group" aria-label="View or edit mode">
                  <button
                    type="button"
                    onClick={() => setEditingMode(false)}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                      !editingMode
                        ? 'bg-gray-50 text-gray-700 border-r border-gray-200'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                    aria-pressed={!editingMode}
                  >
                    Viewing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editingMode) {
                        if (confirm("You're entering editing mode. Changes affect staff guidance.\n\nContinue?")) {
                          setEditingMode(true)
                        }
                      } else {
                        setEditingMode(true)
                      }
                    }}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                      editingMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-pressed={editingMode}
                  >
                    Editing
                  </button>
                </div>
                {editingMode && (
                  <p className="text-xs text-gray-500 mt-2">
                    Editing mode active
                  </p>
                )}
              </div>
            )}
            
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-600 leading-relaxed">
                Click a node with the <span className="inline-flex items-center text-blue-600">ⓘ</span> icon in the diagram to view reference details.
              </p>
            </div>
            
            {/* Diagram legend - collapsible, visually quiet */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setLegendExpanded(!legendExpanded)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                aria-expanded={legendExpanded}
                aria-label="Toggle diagram legend"
              >
                <span className="font-medium text-gray-700">Diagram legend</span>
                <svg
                  className={`w-4 h-4 transition-transform ${legendExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {legendExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                  <div className="flex flex-col gap-3">
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
              )}
            </div>
          </div>
        ) : null}
      </div>
      </div>
    </div>
  )
}

