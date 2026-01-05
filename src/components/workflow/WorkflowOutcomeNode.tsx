'use client'

import { Handle, Position } from 'reactflow'
import { WorkflowNodeType, WorkflowActionKey } from '@prisma/client'
import { getNodeStyles, renderBadges } from './nodeStyleUtils'

interface WorkflowOutcomeNodeProps {
  data: {
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
    onInfoClick?: () => void
    getActionKeyDescription?: (actionKey: WorkflowActionKey) => string
  }
  selected?: boolean
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

export default function WorkflowOutcomeNode({ data, selected }: WorkflowOutcomeNodeProps) {
  const { nodeType, title, hasBody, actionKey, hasOutgoingEdges, badges = [], style, isSelected, isAdmin = false, onNodeClick, onInfoClick, getActionKeyDescription: customGetActionKeyDescription } = data
  
  const isOutcomeNode = actionKey !== null && !hasOutgoingEdges
  const getDescription = customGetActionKeyDescription || getActionKeyDescription
  const handleClass = isAdmin ? 'w-3 h-3 !bg-blue-500' : 'w-3 h-3 opacity-0 pointer-events-none'
  const { className: styleClasses, style: inlineStyles } = getNodeStyles(style)
  const nodeStyles = getNodeTypeColor(nodeType)

  return (
    <>
      {/* Target handles - connections come IN */}
      <>
        <Handle id="target-top" type="target" position={Position.Top} className={handleClass} />
        <Handle id="target-right" type="target" position={Position.Right} className={handleClass} />
        <Handle id="target-bottom" type="target" position={Position.Bottom} className={handleClass} />
        <Handle id="target-left" type="target" position={Position.Left} className={handleClass} />
      </>

      {/* Card container */}
      <div 
        className={`min-w-[280px] max-w-[320px] rounded-lg shadow-md overflow-hidden transition-all cursor-pointer flex flex-col border ${
          styleClasses || 'bg-white border-gray-200'
        } ${
          isSelected || selected
            ? 'border-2 border-blue-500 shadow-lg'
            : ''
        }`}
        style={inlineStyles}
        onClick={(e) => {
          e.stopPropagation()
          onNodeClick?.()
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
          <div className="min-h-[2.5rem] overflow-hidden">
            <div className={`font-medium break-words text-sm leading-snug ${style?.textColor ? '' : 'text-gray-900'}`}>
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
      <>
        <Handle id="source-top" type="source" position={Position.Top} className={handleClass} />
        <Handle id="source-right" type="source" position={Position.Right} className={handleClass} />
        <Handle id="source-bottom" type="source" position={Position.Bottom} className={handleClass} />
        <Handle id="source-left" type="source" position={Position.Left} className={handleClass} />
      </>
    </>
  )
}
