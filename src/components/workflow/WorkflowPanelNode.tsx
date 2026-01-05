'use client'

import { Handle, Position } from 'reactflow'
import { NodeResizer } from '@reactflow/node-resizer'
import '@reactflow/node-resizer/dist/style.css'
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
  
  // Display title or placeholder
  const displayTitle = title?.trim() || 'Untitled panel'

  return (
    <>
      {/* NodeResizer - only visible when selected and admin */}
      {(isSelected || selected) && isAdmin && (
        <NodeResizer
          minWidth={300}
          minHeight={200}
          isVisible={isSelected || selected}
          style={{ pointerEvents: 'auto' }}
        />
      )}

      {/* Panel nodes typically don't have handles, but we'll add them for admin editing */}
      {isAdmin && (
        <>
          <Handle id="target-top" type="target" position={Position.Top} className={handleClass} />
          <Handle id="target-right" type="target" position={Position.Right} className={handleClass} />
          <Handle id="target-bottom" type="target" position={Position.Bottom} className={handleClass} />
          <Handle id="target-left" type="target" position={Position.Left} className={handleClass} />
        </>
      )}

      {/* Panel container - uses 100% width/height to respect React Flow node dimensions */}
      <div
        className={`panel-background w-full h-full rounded-lg shadow-sm transition-all cursor-pointer border-2 flex flex-col ${
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
          position: 'relative',
          zIndex: -1, // Panel sits behind other nodes (edges are in separate SVG layer)
          pointerEvents: 'none', // Background doesn't block interactions
        }}
      >
        {/* Panel header - pointer-events:auto so it can be clicked */}
        <div 
          className="px-4 py-3 border-b border-gray-300 flex items-center justify-between flex-shrink-0"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => {
            e.stopPropagation()
            onNodeClick?.()
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {/* Panel title as primary header */}
            <div className={`font-semibold break-words text-sm ${style?.textColor ? '' : 'text-gray-800'}`} style={style?.textColor ? { color: style.textColor } : {}}>
              {displayTitle}
            </div>
            {/* Panel badges */}
            {badges.length > 0 && (
              <div className="flex items-center gap-1">
                {renderBadges(badges)}
              </div>
            )}
          </div>
        </div>
        
        {/* Panel content area - flex-grow to fill remaining space */}
        <div className="flex-1 px-4 py-4 overflow-hidden">
          {/* Empty content area - can be used for future content */}
        </div>
      </div>
    </>
  )
}
