'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ConnectionMode,
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
      return 'bg-blue-100 text-blue-800 border-blue-300'
    case 'QUESTION':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case 'END':
      return 'bg-green-100 text-green-800 border-green-300'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

export default function WorkflowDiagramClient({ template }: WorkflowDiagramClientProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

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
        y = node.sortOrder * 150
      }

      return {
        id: node.id,
        type: 'default',
        position: { x, y },
        data: {
          label: (
            <div className="px-3 py-2 min-w-[200px] max-w-[300px]">
              <div className={`text-xs font-semibold px-2 py-1 rounded mb-2 inline-block ${getNodeTypeColor(node.nodeType)}`}>
                {node.nodeType}
              </div>
              <div className="font-medium text-gray-900 mb-1 break-words">
                {node.title}
              </div>
              {node.actionKey && (
                <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                  Outcome: {formatActionKey(node.actionKey)}
                </div>
              )}
            </div>
          ),
          nodeType: node.nodeType,
          title: node.title,
          body: node.body,
          actionKey: node.actionKey,
        },
      }
    })
  }, [template.nodes])

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
            label: option.label,
            type: 'smoothstep',
            animated: false,
          })
        }
      })
    })

    return edgesList
  }, [template.nodes])

  // Initialize nodes and edges
  useEffect(() => {
    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [flowNodes, flowEdges, setNodes, setEdges])

  // Handle node click
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
  }, [])

  // Find selected node data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return template.nodes.find((n) => n.id === selectedNodeId) || null
  }, [selectedNodeId, template.nodes])

  return (
    <div className="flex gap-6 h-[800px]">
      {/* Diagram Area */}
      <div className="flex-1 bg-white rounded-lg shadow border border-gray-200">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          connectionMode={ConnectionMode.Loose}
          fitView
          attributionPosition="bottom-left"
        >
          <Controls />
          <Background />
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
  )
}

