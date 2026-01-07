'use client'

import type { NodeProps } from 'reactflow'
import { WorkflowNodeType } from '@prisma/client'
import { getNodeStyles, type TemplateStyleDefault } from './nodeStyleUtils'
import InfoBadgeButton from './InfoBadgeButton'
import { shouldShowInfoBadge } from './shouldShowInfoBadge'

type WorkflowReferenceNodeData = {
  nodeType: WorkflowNodeType
  title: string
  reference?: {
    title?: string
    items?: Array<{ text: string; info?: string }>
  } | null
  style?: {
    bgColor?: string
    textColor?: string
    borderColor?: string
    borderWidth?: number
    radius?: number
    fontWeight?: 'normal' | 'medium' | 'bold'
    theme?: 'default' | 'info' | 'warning' | 'success' | 'muted' | 'panel'
    reference?: {
      title?: string
      items?: Array<{ text: string; info?: string }>
    }
  } | null
  templateDefault?: TemplateStyleDefault | null
  surgeryDefault?: TemplateStyleDefault | null
  isSelected: boolean
  isAdmin?: boolean
  onInfoClick?: (nodeId: string) => void
}

// Simple info icon SVG
function InfoIcon() {
  return (
    <svg
      className="w-3 h-3"
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

export default function WorkflowReferenceNode({ id, data, selected }: NodeProps<WorkflowReferenceNodeData>) {
  const { nodeType, title, style, templateDefault, isSelected, isAdmin = false, onInfoClick } = data
  const showInfo = shouldShowInfoBadge({ data, style })
  
  // Extract reference data from style.reference (stored in DB)
  const referenceData = style?.reference || null
  const referenceTitle = referenceData?.title || title || 'Reference'
  const referenceItems = referenceData?.items || [{ text: 'New item' }]

  // Use effective palette from getNodeStyles
  const { style: inlineStyles } = getNodeStyles(style, nodeType, templateDefault, surgeryDefault)
  const bgColor = inlineStyles.backgroundColor || '#f0fdf4'
  const borderColor = inlineStyles.borderColor || '#86efac'

  return (
    <div className="relative" style={{ minWidth: 320 }}>
      {/* No handles - REFERENCE nodes are not connectable */}
      
      {/* Card container */}
      <div 
        className={`rounded-lg shadow-sm overflow-hidden transition-all cursor-pointer flex flex-col border ${
          isSelected || selected
            ? 'border-2 border-blue-500 shadow-md'
            : ''
        }`}
        style={{
          backgroundColor: bgColor,
          borderColor: borderColor,
          borderWidth: style?.borderWidth !== undefined ? style.borderWidth : 1,
          borderRadius: style?.radius !== undefined ? `${style.radius}px` : '8px',
          boxSizing: 'border-box',
          ...(inlineStyles.color ? { color: inlineStyles.color } : {}),
        }}
      >
        {/* Header row */}
        <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: borderColor }}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold text-sm break-words text-inherit">
              {referenceTitle}
            </div>
            <div className="text-xs font-medium px-2 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">
              REFERENCE
            </div>
          </div>
          {showInfo && (
            <div className="flex-shrink-0 ml-3">
              <InfoBadgeButton onClick={() => onInfoClick?.(id)} />
            </div>
          )}
        </div>
        
        {/* Items list */}
        <div className="px-4 py-3 space-y-2">
          {referenceItems.map((item, index) => (
            <div 
              key={index} 
              className="flex items-start gap-2 text-sm text-inherit"
            >
              <div className="flex-1 break-words">
                {item.text}
              </div>
              {item.info && (
                <div 
                  data-rf-no-details
                  className="flex-shrink-0 cursor-help opacity-70"
                  title={item.info}
                >
                  <InfoIcon />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
