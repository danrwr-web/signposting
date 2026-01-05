'use client'

import { Handle, Position } from 'reactflow'
import { WorkflowNodeType } from '@prisma/client'
import { getNodeStyles, renderBadges } from './nodeStyleUtils'
import './node-handles.css'

interface WorkflowInstructionNodeProps {
  data: {
    nodeType: WorkflowNodeType
    title: string
    body: string | null
    hasBody: boolean
    badges?: string[]
    style?: {
      bgColor?: string
      textColor?: string
      borderColor?: string
      borderWidth?: number
      radius?: number
      fontWeight?: 'normal' | 'medium' | 'bold'
      theme?: 'default' | 'info' | 'warning' | 'success' | 'muted' | 'panel'
    } | null
    isSelected: boolean
    isAdmin?: boolean
    onNodeClick?: () => void
    onInfoClick?: () => void
  }
  selected?: boolean
}

function getNodeTypeColor(nodeType: WorkflowNodeType): string {
  switch (nodeType) {
    case 'INSTRUCTION':
      return 'bg-blue-50 text-blue-700 border-blue-200'
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

export default function WorkflowInstructionNode({ data, selected }: WorkflowInstructionNodeProps) {
  const { nodeType, title, hasBody, badges = [], style, isSelected, isAdmin = false, onNodeClick, onInfoClick } = data
  const handleClass = isAdmin ? 'w-3 h-3 !bg-blue-500' : 'w-3 h-3 opacity-0 pointer-events-none'
  const { className: styleClasses, style: inlineStyles } = getNodeStyles(style)
  const nodeStyles = getNodeTypeColor(nodeType)

  return (
    <div className="node-wrapper" style={{ width: 300 }}>
      {/* Target handles - connections come IN */}
      <Handle id="target-top" type="target" position={Position.Top} className={`${handleClass} handle-position-top`} />
      <Handle id="target-right" type="target" position={Position.Right} className={`${handleClass} handle-position-right`} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={`${handleClass} handle-position-bottom`} />
      <Handle id="target-left" type="target" position={Position.Left} className={`${handleClass} handle-position-left`} />

      {/* Card container - fills wrapper */}
      <div 
        className={`w-full h-full rounded-lg shadow-md overflow-hidden transition-all cursor-pointer border bg-white border-gray-200 ${
          styleClasses
        } ${
          isSelected || selected
            ? 'border-2 border-blue-500 shadow-lg'
            : ''
        }`}
        style={{
          ...(Object.keys(inlineStyles).length > 0 ? inlineStyles : {}),
          boxSizing: 'border-box',
        }}
        onClick={(e) => {
          e.stopPropagation()
          onNodeClick?.()
        }}
      >
        {/* Badge in top-left */}
        <div className="flex items-start justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`text-xs font-semibold px-2.5 py-1 rounded border ${nodeStyles}`}>
              {nodeType}
            </div>
            {/* Node badges */}
            {badges.length > 0 && (
              <div className="flex items-center gap-1">
                {renderBadges(badges)}
              </div>
            )}
          </div>
          {/* Info indicator - only if has body */}
          {hasBody && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onInfoClick?.()
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
          <div className={`font-medium break-words text-sm leading-snug text-gray-900`} style={style?.textColor ? { color: style.textColor } : undefined}>
            {title}
          </div>
        </div>
      </div>

      {/* Source handles - connections go OUT */}
      <Handle id="source-top" type="source" position={Position.Top} className={`${handleClass} handle-position-top`} />
      <Handle id="source-right" type="source" position={Position.Right} className={`${handleClass} handle-position-right`} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={`${handleClass} handle-position-bottom`} />
      <Handle id="source-left" type="source" position={Position.Left} className={`${handleClass} handle-position-left`} />
    </div>
  )
}
