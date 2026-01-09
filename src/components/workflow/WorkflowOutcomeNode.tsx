'use client'

import { Handle, Position, type NodeProps } from 'reactflow'
import { WorkflowNodeType, WorkflowActionKey } from '@prisma/client'
import { getNodeStyles, renderBadges } from './nodeStyleUtils'
import InfoBadgeButton from './InfoBadgeButton'
import { shouldShowInfoBadge } from './shouldShowInfoBadge'

type WorkflowOutcomeNodeData = {
  nodeType: WorkflowNodeType
  title: string
  body: string | null
  hasBody: boolean
  actionKey: WorkflowActionKey | null
  hasOutgoingEdges: boolean
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
  getActionKeyDescription?: (actionKey: WorkflowActionKey) => string
}

function getNodeTypeColor(nodeType: WorkflowNodeType): string {
  switch (nodeType) {
    case 'END':
      return 'bg-green-50 text-green-700 border-green-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

function getActionKeyDescription(actionKey: WorkflowActionKey): string {
  const descriptions: Record<WorkflowActionKey, string> = {
    FORWARD_TO_GP: 'forward this document to the GP inbox',
    FORWARD_TO_PRESCRIBING_TEAM: 'forward to prescribing team',
    FORWARD_TO_PHARMACY_TEAM: 'forward to pharmacy team',
    FILE_WITHOUT_FORWARDING: 'file without forwarding',
    ADD_TO_YELLOW_SLOT: 'add to yellow slot',
    SEND_STANDARD_LETTER: 'send standard letter',
    CODE_AND_FILE: 'code and file',
    OTHER: 'other action',
  }
  return descriptions[actionKey] || actionKey
}

export default function WorkflowOutcomeNode({ id, data, selected }: NodeProps<WorkflowOutcomeNodeData>) {
  const { nodeType, title, hasBody, actionKey, hasOutgoingEdges, badges = [], style, isSelected, isAdmin = false, onNodeClick, onInfoClick, getActionKeyDescription: customGetActionKeyDescription } = data
  
  const isOutcomeNode = actionKey !== null && !hasOutgoingEdges
  const getDescription = customGetActionKeyDescription || getActionKeyDescription
  const handleClass = isAdmin ? 'w-3 h-3 !bg-blue-500' : 'w-3 h-3 opacity-0 pointer-events-none'
  const { className: styleClasses, style: inlineStyles } = getNodeStyles(style)
  const nodeStyles = getNodeTypeColor(nodeType)
  const showInfo = shouldShowInfoBadge({ data, style })

  return (
    <div className="relative" style={{ width: 300 }}>
      {/* Target handles - connections come IN */}
      <Handle id="target-top" type="target" position={Position.Top} className={handleClass} />
      <Handle id="target-right" type="target" position={Position.Right} className={handleClass} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={handleClass} />
      <Handle id="target-left" type="target" position={Position.Left} className={handleClass} />

      {/* Card container - intrinsic sizing */}
      <div 
        className={`rounded-lg shadow-md overflow-hidden transition-all cursor-pointer flex flex-col border bg-white border-gray-200 ${
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
        {/* Content wrapper - vertically centered */}
        <div className="flex-1 flex flex-col justify-center px-4 py-3">
          {/* Badge and info icon row */}
          <div className="flex items-center justify-between mb-2">
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
            {showInfo && (
              <div className="flex-shrink-0 ml-2">
                <InfoBadgeButton onClick={() => onInfoClick?.(id)} title="View details" ariaLabel="View details" />
              </div>
            )}
          </div>
          
          {/* Title - constrained with overflow protection */}
          <div className="min-h-[2.5rem] overflow-hidden">
            <div className={`font-medium break-words text-sm leading-snug text-gray-900`} style={style?.textColor ? { color: style.textColor } : undefined}>
              {title}
            </div>
          </div>
        </div>

        {/* Outcome footer - only if actionKey and no outgoing edges */}
        {isOutcomeNode && (
          <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
            <div className="text-xs font-medium text-blue-900">
              Outcome: {getDescription(actionKey)}
            </div>
          </div>
        )}
      </div>

      {/* Source handles - connections go OUT */}
      <Handle id="source-top" type="source" position={Position.Top} className={handleClass} />
      <Handle id="source-right" type="source" position={Position.Right} className={handleClass} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={handleClass} />
      <Handle id="source-left" type="source" position={Position.Left} className={handleClass} />
    </div>
  )
}
