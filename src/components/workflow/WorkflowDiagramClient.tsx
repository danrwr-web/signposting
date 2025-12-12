'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  MarkerType,
  Connection,
  Handle,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { WorkflowNodeType, WorkflowActionKey } from '@prisma/client'

interface WorkflowNode {
  id: string
  nodeType: WorkflowNodeType
  title: string
  body: string | null
  sortOrder: number
  positionX: number | null
  positionY: number | null
  actionKey: WorkflowActionKey | null
  answerOptions: Array<{
    id: string
    label: string
    nextNodeId: string | null
    actionKey: WorkflowActionKey | null
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
  updatePositionAction?: (nodeId: string, positionX: number, positionY: number) => Promise<{ success: boolean; error?: string }>
  createNodeAction?: (nodeType: WorkflowNodeType, title?: string) => Promise<{ success: boolean; error?: string; node?: any }>
  createAnswerOptionAction?: (fromNodeId: string, toNodeId: string, label: string) => Promise<{ success: boolean; error?: string; option?: any }>
  updateAnswerOptionLabelAction?: (optionId: string, label: string) => Promise<{ success: boolean; error?: string }>
  deleteAnswerOptionAction?: (optionId: string) => Promise<{ success: boolean; error?: string }>
  deleteNodeAction?: (nodeId: string) => Promise<{ success: boolean; error?: string }>
  updateNodeAction?: (nodeId: string, title: string, body: string | null, actionKey: WorkflowActionKey | null) => Promise<{ success: boolean; error?: string }>
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
  updatePositionAction,
  createNodeAction,
  createAnswerOptionAction,
  updateAnswerOptionLabelAction,
  deleteAnswerOptionAction,
  deleteNodeAction,
  updateNodeAction,
}: WorkflowDiagramClientProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  
  // Editing state for admin
  const [editingTitle, setEditingTitle] = useState('')
  const [editingBody, setEditingBody] = useState('')
  const [editingActionKey, setEditingActionKey] = useState<WorkflowActionKey | null>(null)
  const [editingEdgeLabel, setEditingEdgeLabel] = useState('')
  
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

  // Find selected node data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return template.nodes.find((n) => n.id === selectedNodeId) || null
  }, [selectedNodeId, template.nodes])

  // Initialize editing state when node is selected
  useEffect(() => {
    if (selectedNode && isAdmin) {
      setEditingTitle(selectedNode.title)
      setEditingBody(selectedNode.body || '')
      setEditingActionKey(selectedNode.actionKey)
    }
  }, [selectedNode, isAdmin])

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

      return {
        id: node.id,
        type: 'default',
        position: { x, y },
        selected: isSelected,
        data: {
          label: (
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
              
              {/* Title */}
              <div className="px-4 pb-3">
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
          ),
          nodeType: node.nodeType,
          title: node.title,
          body: node.body,
          actionKey: node.actionKey,
          hasBody,
        },
      }
    })
  }, [template.nodes, selectedNodeId, nodeHasOutgoingEdges, toggleNodeSelection])

  // Initialize nodes and edges from template (once when template changes)
  useEffect(() => {
    setNodes(flowNodes)
    
    // Convert answer options to React Flow edges from template
    const initialEdges: Edge[] = []
    
    template.nodes.forEach((node) => {
      node.answerOptions.forEach((option) => {
        if (option.nextNodeId) {
          const labelText = (option.label ?? '').trim()
          const hasLabel = labelText !== ''
          initialEdges.push({
            id: option.id,
            source: node.id,
            target: option.nextNodeId,
            label: hasLabel ? labelText : undefined,
            labelStyle: hasLabel ? { fontSize: 12, fontWeight: 600, color: '#0b4670' } : undefined,
            labelBgStyle: hasLabel ? { fill: '#ffffff', stroke: '#76a9fa', strokeWidth: 1 } : undefined,
            labelBgPadding: hasLabel ? [6, 4] : undefined,
            labelBgBorderRadius: hasLabel ? 8 : undefined,
            type: 'smoothstep',
            selected: false,
            style: {
              strokeWidth: 2.5,
              stroke: '#005EB8', // NHS blue
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
    
    // Debug log
    console.log("init edges", initialEdges.map(e => ({
      id: e.id, 
      labelType: typeof e.label, 
      labelValue: e.label ? 'string' : 'undefined',
      source: e.source, 
      target: e.target
    })))
    
    setEdges(initialEdges)
  }, [flowNodes, template.nodes, setNodes, setEdges])

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

  // Handle node drag end - save position to database
  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    if (!isAdmin || !updatePositionAction) return

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
  }, [isAdmin, updatePositionAction])

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
    if (!isAdmin) return
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null) // Clear node selection
  }, [isAdmin])

  // Handle connection creation
  const onConnect = useCallback(async (connection: Connection) => {
    if (!isAdmin || !createAnswerOptionAction || !connection.source || !connection.target) return

    const labelInput = window.prompt('Label for this path (e.g. Yes / No). Leave blank for no label:', '')
    // If user cancels, labelInput is null - we'll treat this as empty string
    const label = labelInput === null ? '' : labelInput.trim()

    try {
      const result = await createAnswerOptionAction(connection.source, connection.target, label)
      if (result.success && result.option) {
        // Add new edge to the edges state
        const edgeLabel = result.option.label && result.option.label.trim() !== '' ? result.option.label.trim() : undefined
        const newEdge: Edge = {
          id: result.option.id,
          source: connection.source!,
          target: connection.target!,
          label: edgeLabel,
          labelStyle: edgeLabel ? { fontSize: 12, fontWeight: 600, color: '#0b4670' } : undefined,
          labelBgStyle: edgeLabel ? { fill: '#ffffff', stroke: '#76a9fa', strokeWidth: 1 } : undefined,
          labelBgPadding: edgeLabel ? [6, 4] : undefined,
          labelBgBorderRadius: edgeLabel ? 8 : undefined,
          type: 'smoothstep',
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
        
        // Debug log
        console.log("onConnect - creating edge", {
          id: newEdge.id,
          label: edgeLabel,
          labelType: typeof newEdge.label,
          source: newEdge.source,
          target: newEdge.target
        })
        
        setEdges((eds) => {
          const updated = [...eds, newEdge]
          console.log("onConnect - edges after add", updated.map(e => ({
            id: e.id,
            labelType: typeof e.label,
              labelValue: e.label ? 'string' : 'undefined'
          })))
          return updated
        })
      } else {
        console.error('Failed to create answer option:', result.error)
        alert(`Failed to create connection: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating connection:', error)
      alert('Failed to create connection')
    }
  }, [isAdmin, createAnswerOptionAction, setEdges])

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
                    type="source"
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
                  <div className="px-4 pb-3">
                    <div className="font-medium text-gray-900 break-words text-sm leading-snug">
                      {result.node.title}
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <Handle
                    type="target"
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
        
        // Update template nodes cache (we'll need to refresh to get full data)
        // For now, we'll rely on router.refresh() after a successful create
        if (typeof window !== 'undefined') {
          window.location.reload() // Simple refresh to get full node data
        }
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
      const result = await updateNodeAction(selectedNode.id, editingTitle, editingBody || null, editingActionKey)
      if (result.success) {
        if (typeof window !== 'undefined') {
          window.location.reload() // Refresh to get updated data
        }
      } else {
        alert(`Failed to save: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving node:', error)
      alert('Failed to save changes')
    }
  }, [selectedNode, updateNodeAction, editingTitle, editingBody, editingActionKey])

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
            <div className={`text-xs font-semibold px-2.5 py-1 rounded border ${getNodeTypeColor('QUESTION')}`}>
              QUESTION
            </div>
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

      {/* Admin toolbar */}
      {isAdmin && (
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
            Drag nodes to reposition. Connect nodes by dragging from handle to handle. Positions are saved automatically.
          </p>
        </div>
      )}

      <div className="flex gap-6 h-[800px]">
        {/* Diagram Area */}
        <div className="flex-1 bg-white rounded-lg border border-gray-300 overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onConnect={isAdmin ? onConnect : undefined}
            onNodeDragStop={handleNodeDragStop}
            nodesDraggable={isAdmin}
            edgesFocusable={isAdmin}
            edgesUpdatable={false}
            selectNodesOnDrag={false}
            connectionMode={ConnectionMode.Loose}
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
        {selectedEdge && isAdmin ? (
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
          isAdmin ? (
            // Admin edit form
            <div className="bg-yellow-50 rounded-lg shadow-md p-6 border border-yellow-200">
              <div className="mb-4">
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
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // Read-only view for non-admins
            <div className="bg-yellow-50 rounded-lg shadow-md p-6 border border-yellow-200">
              <div className="mb-4">
                <div className={`text-xs font-semibold px-2.5 py-1 rounded border inline-block mb-3 ${getNodeTypeColor(selectedNode.nodeType)}`}>
                  {selectedNode.nodeType}
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                  {selectedNode.title}
                </h2>
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

