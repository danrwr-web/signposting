'use client'

import { BaseEdge, EdgeProps, getStraightPath, getMarkerId } from 'reactflow'

export default function WorkflowOrthogonalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  const TOLERANCE = 2

  // Calculate deltas
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  let edgePath: string
  let labelX: number
  let labelY: number

  // Case 1: Vertically aligned (same X) - draw straight vertical line
  if (absDx <= TOLERANCE) {
    const [path] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    })
    edgePath = path
    labelX = sourceX
    labelY = (sourceY + targetY) / 2
  }
  // Case 2: Horizontally aligned (same Y) - draw straight horizontal line
  else if (absDy <= TOLERANCE) {
    const [path] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    })
    edgePath = path
    labelX = (sourceX + targetX) / 2
    labelY = sourceY
  }
  // Case 3: Not aligned - draw orthogonal path with one bend
  else {
    // Calculate midpoint Y
    const midY = (sourceY + targetY) / 2
    
    // Build path: vertical from source to midY, then horizontal to targetX, then vertical to targetY
    edgePath = `M ${sourceX},${sourceY} L ${sourceX},${midY} L ${targetX},${midY} L ${targetX},${targetY}`
    
    // Label position at the horizontal segment
    labelX = (sourceX + targetX) / 2
    labelY = midY
  }

  // Convert markerEnd object to string ID using React Flow's getMarkerId helper
  const markerEndId = markerEnd ? (typeof markerEnd === 'string' ? markerEnd : getMarkerId(markerEnd)) : undefined

  // Calculate label dimensions for background
  const labelText = typeof label === 'string' ? label : ''
  const fontSize = labelStyle?.fontSize ? Number(labelStyle.fontSize) : 12
  const paddingX = typeof labelBgPadding?.[0] === 'number' ? labelBgPadding[0] : 0
  const paddingY = typeof labelBgPadding?.[1] === 'number' ? labelBgPadding[1] : 0
  // Rough estimate: ~7px per character for 12px font
  const textWidth = labelText.length * (fontSize * 0.6)
  const textHeight = fontSize

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEndId}
        style={style}
      />
      {label && (
        <g className="react-flow__edge-textwrapper">
          {labelBgStyle && (
            <rect
              x={labelX - textWidth / 2 - paddingX}
              y={labelY - textHeight / 2 - paddingY}
              width={textWidth + paddingX * 2}
              height={textHeight + paddingY * 2}
              rx={labelBgBorderRadius || 0}
              ry={labelBgBorderRadius || 0}
              style={labelBgStyle}
            />
          )}
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            style={labelStyle}
            className="react-flow__edge-text"
          >
            {labelText}
          </text>
        </g>
      )}
    </>
  )
}
