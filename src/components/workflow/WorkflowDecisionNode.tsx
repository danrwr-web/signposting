'use client'

import { Handle, Position, type NodeProps } from 'reactflow'
import { WorkflowNodeType } from '@prisma/client'
import { getNodeStyles, renderBadges, type TemplateStyleDefault } from './nodeStyleUtils'
import InfoBadgeButton from './InfoBadgeButton'
import { shouldShowInfoBadge } from './shouldShowInfoBadge'

type WorkflowDecisionNodeData = {
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
  templateDefault?: TemplateStyleDefault | null
  isSelected: boolean
  isAdmin?: boolean
  onNodeClick?: () => void
  onInfoClick?: (nodeId: string) => void
}

function getNodeTypeColor(nodeType: WorkflowNodeType): string {
  switch (nodeType) {
    case 'QUESTION':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

export default function WorkflowDecisionNode({ id, data, selected }: NodeProps<WorkflowDecisionNodeData>) {
  const { nodeType, title, hasBody, badges = [], style, templateDefault, isSelected, isAdmin = false, onNodeClick, onInfoClick } = data
  const handleClass = isAdmin ? 'w-3 h-3 !bg-blue-500' : 'w-3 h-3 opacity-0 pointer-events-none'
  const { className: styleClasses, style: inlineStyles } = getNodeStyles(style, nodeType, templateDefault)
  const nodeStyles = getNodeTypeColor(nodeType)
  const showInfo = shouldShowInfoBadge({ data, style })
  
  // For diamond shape, we need to apply styles to the background div
  // Use effective palette colors from getNodeStyles
  const bgColor = inlineStyles.backgroundColor || 'rgba(251, 191, 36, 0.7)'
  const borderColor = inlineStyles.borderColor || '#fbbf24'

  return (
    <div className="relative cursor-pointer transition-all" style={{ width: 240, height: 160 }}>
      {/* Target handles - connections come IN */}
      <Handle id="target-top" type="target" position={Position.Top} className={handleClass} />
      <Handle id="target-right" type="target" position={Position.Right} className={handleClass} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={handleClass} />
      <Handle id="target-left" type="target" position={Position.Left} className={handleClass} />

      {/* Source handles - connections go OUT */}
      <Handle id="source-top" type="source" position={Position.Top} className={handleClass} />
      <Handle id="source-left" type="source" position={Position.Left} className={handleClass} />
      <Handle id="source-right" type="source" position={Position.Right} className={handleClass} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={handleClass} />

      {/* Diamond container - fixed size matching React Flow node bounds */}
      <div
        className={`absolute inset-0 cursor-pointer transition-all ${
          isSelected || selected
            ? 'ring-2 ring-blue-500 shadow-lg'
            : 'shadow-md'
        }`}
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
            {showInfo && (
              <InfoBadgeButton onClick={() => onInfoClick?.(id)} title="View details" ariaLabel="View details" />
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
