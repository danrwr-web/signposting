'use client'

import { Handle, Position } from 'reactflow'
import { WorkflowNodeType } from '@prisma/client'
import { getNodeStyles, renderBadges } from './nodeStyleUtils'

interface WorkflowPanelNodeProps {
  data: {
    nodeType: WorkflowNodeType
    title: string
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
  }
  selected?: boolean
}

export default function WorkflowPanelNode({ data, selected }: WorkflowPanelNodeProps) {
  const { nodeType, title, badges = [], style, isSelected, isAdmin = false, onNodeClick } = data
  const handleClass = isAdmin ? 'w-3 h-3 !bg-blue-500' : 'w-3 h-3 opacity-0 pointer-events-none'
  const { className: styleClasses, style: inlineStyles } = getNodeStyles(style)
  
  // Panel nodes should have a lower z-index and be resizable
  // Default to panel theme if no style specified
  const defaultBg = style?.bgColor || (style?.theme === 'panel' ? '#f3f4f6' : '#f9fafb')
  const defaultBorder = style?.borderColor || '#d1d5db'
  const defaultRadius = style?.radius !== undefined ? style.radius : 12

  return (
    <>
      {/* Panel nodes typically don't have handles, but we'll add them for admin editing */}
      {isAdmin && (
        <>
          <Handle id="target-top" type="target" position={Position.Top} className={handleClass} />
          <Handle id="target-right" type="target" position={Position.Right} className={handleClass} />
          <Handle id="target-bottom" type="target" position={Position.Bottom} className={handleClass} />
          <Handle id="target-left" type="target" position={Position.Left} className={handleClass} />
        </>
      )}

      {/* Panel container - larger, background-style */}
      <div
        className={`min-w-[400px] min-h-[300px] rounded-lg shadow-sm transition-all cursor-pointer border-2 ${
          styleClasses || 'bg-gray-100 border-gray-300'
        } ${
          isSelected || selected
            ? 'border-blue-500 shadow-md ring-2 ring-blue-200'
            : ''
        }`}
        style={{
          ...inlineStyles,
          backgroundColor: inlineStyles.backgroundColor || defaultBg,
          borderColor: inlineStyles.borderColor || defaultBorder,
          borderRadius: inlineStyles.borderRadius || `${defaultRadius}px`,
          zIndex: -1, // Panel sits behind other nodes
        }}
        onClick={(e) => {
          e.stopPropagation()
          onNodeClick?.()
        }}
      >
        {/* Panel header */}
        <div className="px-4 py-3 border-b border-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-xs font-semibold px-2.5 py-1 rounded border bg-gray-200 text-gray-700 border-gray-300">
              {nodeType}
            </div>
            {/* Panel badges */}
            {badges.length > 0 && (
              <div className="flex items-center gap-1">
                {renderBadges(badges)}
              </div>
            )}
          </div>
        </div>
        
        {/* Panel title/content */}
        <div className="px-4 py-4">
          <div className={`font-medium break-words text-sm ${style?.textColor ? '' : 'text-gray-800'}`}>
            {title}
          </div>
        </div>
      </div>
    </>
  )
}
