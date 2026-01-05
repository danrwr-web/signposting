'use client'

import { Handle, Position } from 'reactflow'
import { WorkflowNodeType } from '@prisma/client'
import { getNodeStyles, renderBadges } from './nodeStyleUtils'
import './node-handles.css'

interface WorkflowDecisionNodeProps {
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
  const { nodeType, title, hasBody, badges = [], style, isSelected, isAdmin = false, onNodeClick, onInfoClick } = data
  const handleClass = isAdmin ? 'w-3 h-3 !bg-blue-500' : 'w-3 h-3 opacity-0 pointer-events-none'
  const { className: styleClasses, style: inlineStyles } = getNodeStyles(style)
  const nodeStyles = getNodeTypeColor(nodeType)
  
  // For diamond shape, we need to apply styles to the background div
  // Use explicit style colors if provided, otherwise use original default amber colors
  const hasExplicitBg = style?.bgColor !== undefined || style?.backgroundColor !== undefined
  const hasExplicitBorder = style?.borderColor !== undefined
  const bgColor = hasExplicitBg ? (style?.bgColor || style?.backgroundColor) : 'rgba(251, 191, 36, 0.7)'
  const borderColor = hasExplicitBorder ? (style?.borderColor || '') : '#fbbf24'

  return (
    <div className="node-wrapper cursor-pointer transition-all" style={{ width: 240, height: 160 }}>
      {/* Target handles - connections come IN */}
      <Handle id="target-top" type="target" position={Position.Top} className={`${handleClass} handle-position-top`} />
      <Handle id="target-right" type="target" position={Position.Right} className={`${handleClass} handle-position-right`} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={`${handleClass} handle-position-bottom`} />
      <Handle id="target-left" type="target" position={Position.Left} className={`${handleClass} handle-position-left`} />

      {/* Source handles - connections go OUT */}
      <Handle id="source-top" type="source" position={Position.Top} className={`${handleClass} handle-position-top`} />
      <Handle id="source-left" type="source" position={Position.Left} className={`${handleClass} handle-position-left`} />
      <Handle id="source-right" type="source" position={Position.Right} className={`${handleClass} handle-position-right`} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={`${handleClass} handle-position-bottom`} />

      {/* Diamond container - fixed size matching React Flow node bounds */}
      <div
        className={`relative w-full h-full cursor-pointer transition-all ${
          isSelected || selected
            ? 'ring-2 ring-blue-500 shadow-lg'
            : 'shadow-md'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          onNodeClick?.()
        }}
      >
        {/* Diamond background - SVG that fills the container */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0"
          style={{ pointerEvents: 'none' }}
        >
          <polygon
            points="50,0 100,50 50,100 0,50"
            fill={bgColor}
            stroke={borderColor}
            strokeWidth={style?.borderWidth !== undefined ? style.borderWidth : 2}
          />
        </svg>

        {/* Content overlay - absolutely positioned and centered */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 overflow-hidden pointer-events-none">
          {/* Badge and info icon row */}
          <div className="flex items-start justify-between w-full min-h-[20px] mb-1 pointer-events-auto">
            <div className="flex items-center gap-1 flex-wrap">
              <div className={`text-xs font-semibold px-2 py-0.5 rounded border ${nodeStyles}`}>
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
                className="flex-shrink-0 text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors"
                title="Click for reference details"
                aria-label="View details"
              >
                <InfoIcon />
              </button>
            )}
          </div>

          {/* Title row - centered */}
          <div className="flex items-center justify-center w-full -mt-1 pointer-events-auto">
            <div className={`font-medium break-words text-sm leading-snug text-center max-w-[70%] overflow-hidden text-gray-900`} style={style?.textColor ? { color: style.textColor } : undefined}>
              {title}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
