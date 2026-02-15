'use client'

import { BaseEdge, EdgeProps, EdgeLabelRenderer, getStraightPath } from 'reactflow'

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

  const mergedStyle = {
    stroke: '#005EB8',
    strokeWidth: 2.5,
    ...style,
  }

  const labelText = typeof label === 'string' ? label : ''
  const paddingX = typeof labelBgPadding?.[0] === 'number' ? labelBgPadding[0] : 0
  const paddingY = typeof labelBgPadding?.[1] === 'number' ? labelBgPadding[1] : 0

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={mergedStyle}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="react-flow__edge-text"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              background: labelBgStyle?.fill ?? '#ffffff',
              border: labelBgStyle?.stroke
                ? `${labelBgStyle?.strokeWidth ?? 1}px solid ${labelBgStyle.stroke}`
                : undefined,
              borderRadius: labelBgBorderRadius ?? 0,
              padding: `${paddingY}px ${paddingX}px`,
              color: labelStyle?.color ?? '#0b4670',
              fontSize: (labelStyle?.fontSize as number | undefined) ?? 12,
              fontWeight: labelStyle?.fontWeight ?? 600,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}
          >
            {labelText}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
