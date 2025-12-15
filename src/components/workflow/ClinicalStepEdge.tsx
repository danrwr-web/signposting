'use client'

import { useMemo } from 'react'
import { BaseEdge, EdgeLabelRenderer, EdgeProps, Position, useStore } from 'reactflow'

type Point = { x: number; y: number }

const OFFSET = 18
const ENABLE_EDGE_DEBUG = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_EDGE_DEBUG === 'true'

const buildPathFromPoints = (points: Point[]): string => {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  const segments = rest.map((point) => `L ${point.x},${point.y}`).join(' ')
  return `M ${first.x},${first.y} ${segments}`
}

const handleDirection = (
  handle: string | null | undefined,
  fallback: Position.Top | Position.Bottom | Position.Left | Position.Right
): Position => {
  switch (handle) {
    case 'source-top':
    case 'target-top':
      return Position.Top
    case 'source-bottom':
    case 'target-bottom':
      return Position.Bottom
    case 'source-left':
    case 'target-left':
      return Position.Left
    case 'source-right':
    case 'target-right':
      return Position.Right
    default:
      return fallback
  }
}

const offsetFromHandle = (
  handle: string | null | undefined,
  x: number,
  y: number,
  distance: number,
  fallback: Position
): Point => {
  const direction = handleDirection(handle, fallback)
  if (direction === Position.Top) return { x, y: y - distance }
  if (direction === Position.Bottom) return { x, y: y + distance }
  if (direction === Position.Left) return { x: x - distance, y }
  return { x: x + distance, y }
}

const isTopHandle = (handle?: string | null) => handle === 'source-top' || handle === 'target-top'
const isBottomHandle = (handle?: string | null) => handle === 'source-bottom' || handle === 'target-bottom'
const isLeftHandle = (handle?: string | null) => handle === 'source-left' || handle === 'target-left'
const isRightHandle = (handle?: string | null) => handle === 'source-right' || handle === 'target-right'

export default function ClinicalStepEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourceHandle,
  targetHandle,
  data,
  style = {},
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  const nodeInternals = useStore((store) => store.nodeInternals)

  const sourceNode = useMemo(() => nodeInternals.get(source) ?? null, [nodeInternals, source])
  const targetNode = useMemo(() => nodeInternals.get(target) ?? null, [nodeInternals, target])

  const isQuestionSource = sourceNode?.data?.nodeType === 'QUESTION'
  const isInstructionTarget = targetNode?.data?.nodeType === 'INSTRUCTION'

  const exitPoint = useMemo(
    () => offsetFromHandle(sourceHandle, sourceX, sourceY, OFFSET, Position.Bottom),
    [sourceHandle, sourceX, sourceY]
  )
  const approachPoint = useMemo(
    () => offsetFromHandle(targetHandle, targetX, targetY, OFFSET, Position.Top),
    [targetHandle, targetX, targetY]
  )

  const wantsUpward = isTopHandle(sourceHandle)

  const points: Point[] = [
    { x: sourceX, y: sourceY },
    exitPoint,
  ]

  const addPoint = (point: Point) => {
    const last = points[points.length - 1]
    if (last.x === point.x && last.y === point.y) return
    points.push(point)
  }

  const buildHorizontalVertical = () => {
    const midY = exitPoint.y
    addPoint({ x: targetX, y: midY })
    if (approachPoint.y !== midY) {
      addPoint({ x: targetX, y: approachPoint.y })
    }
  }

  if (
    isQuestionSource &&
    isInstructionTarget &&
    isRightHandle(sourceHandle) &&
    targetHandle === 'target-top'
  ) {
    // Question (right) to Instruction (top): horizontal then vertical
    buildHorizontalVertical()
  } else if (
    isQuestionSource &&
    isInstructionTarget &&
    isLeftHandle(sourceHandle) &&
    targetHandle === 'target-top'
  ) {
    // Question (left) to Instruction (top): horizontal then vertical
    buildHorizontalVertical()
  } else if (isBottomHandle(sourceHandle) && targetHandle === 'target-top') {
    // Bottom to top: vertical-first drop, then align to target
    const dropY = Math.max(exitPoint.y, approachPoint.y)
    addPoint({ x: exitPoint.x, y: dropY })
    if (targetX !== exitPoint.x) {
      addPoint({ x: targetX, y: dropY })
    }
  } else {
    // Default orthogonal path with no collision avoidance
    const desiredY = approachPoint.y
    const safeY = wantsUpward ? desiredY : Math.max(exitPoint.y, desiredY)
    addPoint({ x: exitPoint.x, y: safeY })
    if (targetX !== exitPoint.x) {
      addPoint({ x: targetX, y: safeY })
    }
    if (approachPoint.y !== safeY) {
      addPoint({ x: targetX, y: approachPoint.y })
    }
  }

  addPoint(approachPoint)
  addPoint({ x: targetX, y: targetY })

  const path = buildPathFromPoints(points)

  const segments = points.slice(0, -1).map((p, idx) => {
    const next = points[idx + 1]
    return { length: Math.hypot(next.x - p.x, next.y - p.y), start: p, end: next }
  })

  const longestSegment =
    segments.reduce(
      (longest, current) => (current.length > longest.length ? current : longest),
      segments[0]
    ) ?? { start: points[0], end: points[points.length - 1] }

  const labelCenter = {
    x: (longestSegment.start.x + longestSegment.end.x) / 2,
    y: (longestSegment.start.y + longestSegment.end.y) / 2,
  }

  const mergedStyle = {
    stroke: '#005EB8',
    strokeWidth: 2.5,
    ...style,
  }

  const labelText = typeof label === 'string' ? label : ''
  const paddingX = typeof labelBgPadding?.[0] === 'number' ? labelBgPadding[0] : 0
  const paddingY = typeof labelBgPadding?.[1] === 'number' ? labelBgPadding[1] : 0
  const { transform: _ignoredTransform, ...restLabelStyle } = labelStyle ?? {}

  const debugEdgeId =
    typeof data?.debugEdgeId === 'string' && data.debugEdgeId.length > 0 ? data.debugEdgeId : null
  const debugActive = ENABLE_EDGE_DEBUG && debugEdgeId && debugEdgeId === id

  if (debugActive) {
    // eslint-disable-next-line no-console
    console.log('[ClinicalStepEdge]', {
      id,
      type: 'clinical',
      source,
      target,
      sourceHandle,
      targetHandle,
      sourceX,
      sourceY,
      targetX,
      targetY,
      pathPoints: points,
    })
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={mergedStyle} />
      {debugActive && (
        <g>
          <circle cx={sourceX} cy={sourceY} r={3} fill="cyan" />
          <circle cx={exitPoint.x} cy={exitPoint.y} r={3} fill="blue" />
          <circle cx={approachPoint.x} cy={approachPoint.y} r={3} fill="orange" />
          <circle cx={targetX} cy={targetY} r={3} fill="red" />
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="magenta"
            strokeWidth={1.5}
          />
          <text x={labelCenter.x} y={labelCenter.y - 12} fontSize={10} fill="magenta">
            CLINICAL
          </text>
        </g>
      )}
      {label && (
        <EdgeLabelRenderer>
          <div
            className="react-flow__edge-text"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelCenter.x}px, ${labelCenter.y}px)`,
              pointerEvents: 'all',
              background: labelBgStyle?.fill ?? '#ffffff',
              border: labelBgStyle?.stroke
                ? `${labelBgStyle?.strokeWidth ?? 1}px solid ${labelBgStyle.stroke}`
                : undefined,
              borderRadius: labelBgBorderRadius ?? 0,
              padding: `${paddingY}px ${paddingX}px`,
              color: restLabelStyle?.color ?? '#0b4670',
              fontSize: (restLabelStyle?.fontSize as number | undefined) ?? 12,
              fontWeight: restLabelStyle?.fontWeight ?? 600,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              ...restLabelStyle,
            }}
          >
            {labelText}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

