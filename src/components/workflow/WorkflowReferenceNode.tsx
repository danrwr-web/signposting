'use client'

import { WorkflowNodeType } from '@prisma/client'

interface WorkflowReferenceNodeProps {
  data: {
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
    isSelected: boolean
    isAdmin?: boolean
    onNodeClick?: () => void
  }
  selected?: boolean
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

export default function WorkflowReferenceNode({ data, selected }: WorkflowReferenceNodeProps) {
  const { nodeType, title, style, isSelected, isAdmin = false, onNodeClick } = data
  
  // Extract reference data from style.reference (stored in DB)
  const referenceData = style?.reference || null
  const referenceTitle = referenceData?.title || title || 'Reference'
  const referenceItems = referenceData?.items || [{ text: 'New item' }]

  // Light green background (NHS-like)
  const bgColor = style?.bgColor || '#f0fdf4'
  const borderColor = style?.borderColor || '#86efac'
  const textColor = style?.textColor || '#166534'

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
        }}
      >
        {/* Header row */}
        <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: borderColor }}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold text-sm break-words" style={{ color: textColor }}>
              {referenceTitle}
            </div>
            <div className="text-xs font-medium px-2 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">
              REFERENCE
            </div>
          </div>
        </div>
        
        {/* Items list */}
        <div className="px-4 py-3 space-y-2">
          {referenceItems.map((item, index) => (
            <div 
              key={index} 
              className="flex items-start gap-2 text-sm"
              style={{ color: textColor }}
            >
              <div className="flex-1 break-words">
                {item.text}
              </div>
              {item.info && (
                <div 
                  data-rf-no-details
                  className="flex-shrink-0 cursor-help"
                  title={item.info}
                  style={{ color: textColor, opacity: 0.7 }}
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
