'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
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
      className="w-4 h-4 text-blue-600"
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

export default function WorkflowDiagramClient({ template }: WorkflowDiagramClientProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Find selected node data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return template.nodes.find((n) => n.id === selectedNodeId) || null
  }, [selectedNodeId, template.nodes])

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

      return {
        id: node.id,
        type: 'default',
        position: { x, y },
        selected: isSelected,
        data: {
          label: (
            <div className={`min-w-[280px] max-w-[320px] bg-white rounded-lg shadow-md overflow-hidden transition-all ${
              isSelected 
                ? 'border-2 border-blue-500 shadow-lg' 
                : 'border border-gray-200'
            }`}>
              {/* Badge in top-left */}
              <div className="flex items-start justify-between px-4 pt-3 pb-2">
                <div className={`text-xs font-semibold px-2.5 py-1 rounded border ${getNodeTypeColor(node.nodeType)}`}>
                  {node.nodeType}
                </div>
                {/* Info indicator */}
                {hasBody && (
                  <div className="flex-shrink-0 ml-2" title="Click for more details">
                    <InfoIcon />
                  </div>
                )}
              </div>
              
              {/* Title */}
              <div className="px-4 pb-3">
                <div className="font-medium text-gray-900 break-words text-sm leading-snug">
                  {node.title}
                </div>
              </div>

              {/* Footer with actionKey */}
              {hasActionKey && (
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
                  <div className="text-xs font-medium text-blue-900">
                    Outcome: {formatActionKey(node.actionKey)}
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
  }, [template.nodes, selectedNodeId])

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
              <div className="px-2 py-1 bg-white border border-blue-300 rounded text-xs font-medium text-blue-900 shadow-sm">
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

  // Initialize nodes and edges, and auto-select start node
  useEffect(() => {
    setNodes(flowNodes)
    setEdges(flowEdges)
    
    // Auto-select start node or first node
    if (flowNodes.length > 0 && !selectedNodeId) {
      const startNode = template.nodes.find((n) => n.isStart)
      const nodeToSelect = startNode || template.nodes[0]
      if (nodeToSelect) {
        setSelectedNodeId(nodeToSelect.id)
      }
    }
  }, [flowNodes, flowEdges, setNodes, setEdges, template.nodes, selectedNodeId])

  // Handle node click
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
  }, [])

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
            <div className="flex items-center justify-center w-5 h-5">
              <InfoIcon />
            </div>
            <span className="text-sm text-gray-600">Click for details</span>
          </div>
        </div>
      </div>

      <div className="flex gap-6 h-[800px]">
        {/* Diagram Area */}
        <div className="flex-1 bg-white rounded-lg border border-gray-300 overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
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
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="mb-4">
              <div className={`text-xs font-semibold px-2 py-1 rounded inline-block mb-2 ${getNodeTypeColor(selectedNode.nodeType)}`}>
                {selectedNode.nodeType}
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {selectedNode.title}
              </h2>
              {selectedNode.body && (
                <div className="text-gray-700 whitespace-pre-wrap mb-4">
                  {selectedNode.body}
                </div>
              )}
            </div>

            {selectedNode.actionKey && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Outcome
                </h3>
                <p className="text-sm text-gray-700">
                  {getActionKeyDescription(selectedNode.actionKey)}
                </p>
              </div>
            )}

            {selectedNode.answerOptions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Answer Options
                </h3>
                <ul className="space-y-2">
                  {selectedNode.answerOptions.map((option) => (
                    <li key={option.id} className="text-sm text-gray-700">
                      <span className="font-medium">{option.label}</span>
                      {option.nextNodeId && (
                        <span className="text-gray-500 ml-2">
                          → {template.nodes.find((n) => n.id === option.nextNodeId)?.title || 'Next node'}
                        </span>
                      )}
                      {option.actionKey && !option.nextNodeId && (
                        <span className="text-gray-500 ml-2">
                          → {formatActionKey(option.actionKey)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setSelectedNodeId(null)}
              className="mt-6 w-full text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear selection
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <p className="text-sm text-gray-500">
              Click on a node in the diagram to view its details.
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

