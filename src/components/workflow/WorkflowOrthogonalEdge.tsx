'use client'

import { BaseEdge, EdgeProps, getStraightPath } from 'reactflow'

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

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
      {label && (
        <g>
          {labelBgStyle && (
            <rect
              x={labelX - (typeof labelBgPadding?.[0] === 'number' ? labelBgPadding[0] : 0)}
              y={labelY - (typeof labelBgPadding?.[1] === 'number' ? labelBgPadding[1] : 0) - (labelStyle?.fontSize ? Number(labelStyle.fontSize) : 12) / 2}
              width={(typeof labelBgPadding?.[0] === 'number' ? labelBgPadding[0] : 0) * 2 + (typeof label === 'string' ? label.length : 0) * 7}
              height={(typeof labelBgPadding?.[1] === 'number' ? labelBgPadding[1] : 0) * 2 + (labelStyle?.fontSize ? Number(labelStyle.fontSize) : 12)}
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
            {label}
          </text>
        </g>
      )}
    </>
  )
}

