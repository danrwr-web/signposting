'use client'

import { Handle, Position } from 'reactflow'
import { WorkflowNodeType } from '@prisma/client'

interface WorkflowDecisionNodeProps {
  data: {
    nodeType: WorkflowNodeType
    title: string
    body: string | null
    hasBody: boolean
    isSelected: boolean
    isAdmin?: boolean
    onNodeClick?: () => void
    onInfoClick?: () => void
  }
  selected?: boolean
}

function getNodeTypeColor(nodeType: WorkflowNodeType): string {
  switch (nodeType) {
    case 'QUESTION':
      return 'bg-amber-50 text-amber-700 border-amber-200'
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

export default function WorkflowDecisionNode({ data, selected }: WorkflowDecisionNodeProps) {
  const { nodeType, title, hasBody, isSelected, isAdmin = false, onNodeClick, onInfoClick } = data

  return (
    <>
      {/* Target handles - connections come IN */}
      {isAdmin && (
        <>
          <Handle
            id="target-top"
            type="target"
            position={Position.Top}
            className="w-3 h-3 !bg-blue-500"
          />
          <Handle
            id="target-right"
            type="target"
            position={Position.Right}
            className="w-3 h-3 !bg-blue-500"
          />
          <Handle
            id="target-bottom"
            type="target"
            position={Position.Bottom}
            className="w-3 h-3 !bg-blue-500"
          />
          <Handle
            id="target-left"
            type="target"
            position={Position.Left}
            className="w-3 h-3 !bg-blue-500"
          />
        </>
      )}

      {/* Source handles - connections go OUT */}
      {isAdmin && (
        <>
          <Handle
            id="source-top"
            type="source"
            position={Position.Top}
            className="w-3 h-3 !bg-blue-500"
          />
          <Handle
            id="source-left"
            type="source"
            position={Position.Left}
            className="w-3 h-3 !bg-blue-500"
          />
          <Handle
            id="source-right"
            type="source"
            position={Position.Right}
            className="w-3 h-3 !bg-blue-500"
          />
          <Handle
            id="source-bottom"
            type="source"
            position={Position.Bottom}
            className="w-3 h-3 !bg-blue-500"
          />
        </>
      )}

      {/* Diamond container - using clip-path for stable layout */}
      <div
        className={`relative w-[200px] h-[130px] cursor-pointer transition-all ${
          isSelected || selected
            ? 'ring-2 ring-blue-500 shadow-lg'
            : 'shadow-md'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          onNodeClick?.()
        }}
      >
        {/* Diamond background - clipped with polygon */}
        <div
          className="absolute inset-0 bg-amber-50/70 border-2 border-amber-200"
          style={{
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          }}
        />

        {/* Content container - 3-row grid for optical centering */}
        <div className="relative h-full grid grid-rows-[auto_1fr_auto] items-center p-3 overflow-hidden">
          {/* Badge and info icon row */}
          <div className="flex items-start justify-between w-full min-h-[20px]">
            <div className={`text-xs font-semibold px-2 py-0.5 rounded border ${getNodeTypeColor(nodeType)}`}>
              {nodeType}
            </div>
            {/* Info indicator - only if has body */}
            {hasBody && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onInfoClick?.()
                }}
                className="flex-shrink-0 text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors"
                title="Click for reference details"
                aria-label="View details"
              >
                <InfoIcon />
              </button>
            )}
          </div>

          {/* Title row - flexes to center, constrained width, subtle upward nudge */}
          <div className="flex items-center justify-center w-full -mt-1">
            <div className="font-medium text-gray-900 break-words text-sm leading-snug text-center max-w-[140px] overflow-hidden">
              {title}
            </div>
          </div>

          {/* Spacer row for visual balance */}
          <div className="h-[8px]"></div>
        </div>
      </div>
    </>
  )
}
