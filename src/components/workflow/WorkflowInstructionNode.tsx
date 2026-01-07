'use client'

import { Handle, Position, type NodeProps } from 'reactflow'
import { WorkflowNodeType } from '@prisma/client'
import { getNodeStyles, renderBadges } from './nodeStyleUtils'
import InfoBadgeButton from './InfoBadgeButton'

type WorkflowInstructionNodeData = {
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
  onInfoClick?: (nodeId: string) => void
}

function getNodeTypeColor(nodeType: WorkflowNodeType): string {
  switch (nodeType) {
    case 'INSTRUCTION':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

export default function WorkflowInstructionNode({ id, data, selected }: NodeProps<WorkflowInstructionNodeData>) {
  const { nodeType, title, hasBody, badges = [], style, isSelected, isAdmin = false, onNodeClick, onInfoClick } = data
  const handleClass = isAdmin ? 'w-3 h-3 !bg-blue-500' : 'w-3 h-3 opacity-0 pointer-events-none'
  const { className: styleClasses, style: inlineStyles } = getNodeStyles(style)
  const nodeStyles = getNodeTypeColor(nodeType)

  return (
    <div className="relative" style={{ width: 300 }}>
      {/* Target handles - connections come IN */}
      <Handle id="target-top" type="target" position={Position.Top} className={handleClass} />
      <Handle id="target-right" type="target" position={Position.Right} className={handleClass} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={handleClass} />
      <Handle id="target-left" type="target" position={Position.Left} className={handleClass} />

      {/* Card container - intrinsic sizing */}
      <div 
        className={`rounded-lg shadow-md overflow-hidden transition-all cursor-pointer border bg-white border-gray-200 ${
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
          <div className="flex-shrink-0 ml-2">
            <InfoBadgeButton
              onClick={() => onInfoClick?.(id)}
              title="View details"
              ariaLabel="View details"
            />
          </div>
        </div>
        
        {/* Title - constrained with overflow protection */}
        <div className="px-4 pb-3 min-h-[2.5rem] overflow-hidden">
          <div className={`font-medium break-words text-sm leading-snug text-gray-900`} style={style?.textColor ? { color: style.textColor } : undefined}>
            {title}
          </div>
        </div>
      </div>

      {/* Source handles - connections go OUT */}
      <Handle id="source-top" type="source" position={Position.Top} className={handleClass} />
      <Handle id="source-right" type="source" position={Position.Right} className={handleClass} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={handleClass} />
      <Handle id="source-left" type="source" position={Position.Left} className={handleClass} />
    </div>
  )
}
