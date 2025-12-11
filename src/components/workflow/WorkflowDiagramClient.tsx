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

export default function WorkflowDiagramClient({ template, isAdmin = false, updatePositionAction }: WorkflowDiagramClientProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  
  // Debounce timer for position updates
  const positionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Find selected node data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return template.nodes.find((n) => n.id === selectedNodeId) || null
  }, [selectedNodeId, template.nodes])

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

  // Convert answer options to React Flow edges
  const flowEdges = useMemo<Edge[]>(() => {
    const edgesList: Edge[] = []
    
    template.nodes.forEach((node) => {
      node.answerOptions.forEach((option) => {
        if (option.nextNodeId) {
          edgesList.push({
            id: option.id,
            source: node.id,
            target: option.nextNodeId,
            label: (
              <div className="px-2.5 py-1 bg-white border border-blue-300 rounded text-xs font-medium text-blue-900 shadow-sm">
                {option.label}
              </div>
            ),
            type: 'smoothstep',
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

    return edgesList
  }, [template.nodes])

  // Initialize nodes and edges (no auto-selection)
  useEffect(() => {
    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [flowNodes, flowEdges, setNodes, setEdges])

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
  }, [toggleNodeSelection])

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

      {/* Admin hint */}
      {isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          Drag nodes to adjust the layout. Positions are saved automatically.
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
            onNodeDragStop={handleNodeDragStop}
            nodesDraggable={isAdmin}
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
        {selectedNode ? (
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
            )}

            <button
              onClick={() => setSelectedNodeId(null)}
              className="mt-6 text-sm text-gray-700 hover:text-gray-900 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              Clear details
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <p className="text-sm text-gray-600 leading-relaxed">
              Click a node with the <span className="inline-flex items-center text-blue-600">ⓘ</span> icon in the diagram to view reference details.
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

