'use client'

import { useMemo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  Position,
  useStore,
} from 'reactflow'

type Rect = {
  id: string
  x1: number
  x2: number
  y1: number
  y2: number
}

const DEBUG = false
const DEBUG_EDGE_ID: string | null = null
const STEP = 24
const PADDING = 12
const ESC = 48

function buildPathFromPoints(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  const segments = rest.map((point) => `L ${point.x},${point.y}`).join(' ')
  return `M ${first.x},${first.y} ${segments}`
}

function offsetFromHandle(
  handle: string | null | undefined,
  x: number,
  y: number,
  distance: number,
  defaultDirection: 'down' | 'up' | 'left' | 'right' = 'down'
): { x: number; y: number } {
  switch (handle) {
    case 'source-top':
    case 'target-top':
      return { x, y: y - distance }
    case 'source-bottom':
    case 'target-bottom':
      return { x, y: y + distance }
    case 'source-left':
    case 'target-left':
      return { x: x - distance, y }
    case 'source-right':
    case 'target-right':
      return { x: x + distance, y }
    default:
      if (defaultDirection === 'up') return { x, y: y - distance }
      if (defaultDirection === 'left') return { x: x - distance, y }
      if (defaultDirection === 'right') return { x: x + distance, y }
      return { x, y: y + distance }
  }
}

function getExitPoint(
  sourceHandle: string | null | undefined,
  sourceX: number,
  sourceY: number
): { x: number; y: number } {
  return offsetFromHandle(sourceHandle, sourceX, sourceY, STEP, 'down')
}

function getApproachPoint(
  targetHandle: string | null | undefined,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  return offsetFromHandle(targetHandle, targetX, targetY, STEP, 'up')
}

function getEscapePoint(
  sourceHandle: string | null | undefined,
  exitX: number,
  exitY: number
): { x: number; y: number } {
  return offsetFromHandle(sourceHandle, exitX, exitY, ESC, 'down')
}

export default function SmartStepEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
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

  const exitPoint = useMemo(
    () => getExitPoint(sourceHandle, sourceX, sourceY),
    [sourceHandle, sourceX, sourceY]
  )

  const approachPoint = useMemo(
    () => getApproachPoint(targetHandle, targetX, targetY),
    [targetHandle, targetX, targetY]
  )

  const rects = useMemo<Rect[]>(() => {
    return Array.from(nodeInternals.values())
      .filter((node) => node.width != null && node.height != null && node.positionAbsolute)
      .map((node) => {
        const { x, y } = node.positionAbsolute!
        const width = node.width ?? 0
        const height = node.height ?? 0
        return {
          id: node.id,
          x1: x - PADDING,
          y1: y - PADDING,
          x2: x + width + PADDING,
          y2: y + height + PADDING,
        }
      })
  }, [nodeInternals])

  const manhattan = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

  const segmentCollides = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    ignoreIds: Set<string>
  ) => {
    const isHorizontal = p1.y === p2.y
    const isVertical = p1.x === p2.x
    if (!isHorizontal && !isVertical) return true
    return rects.some((rect) => {
      if (ignoreIds.has(rect.id)) return false
      if (isHorizontal) {
        const y = p1.y
        const minX = Math.min(p1.x, p2.x)
        const maxX = Math.max(p1.x, p2.x)
        return y >= rect.y1 && y <= rect.y2 && maxX >= rect.x1 && minX <= rect.x2
      }
      const x = p1.x
      const minY = Math.min(p1.y, p2.y)
      const maxY = Math.max(p1.y, p2.y)
      return x >= rect.x1 && x <= rect.x2 && maxY >= rect.y1 && minY <= rect.y2
    })
  }

  const polylineCollides = (pts: Array<{ x: number; y: number }>) => {
    const ignoreFirst = new Set<string>([source])
    const ignoreLast = new Set<string>([target])
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const ignoreIds = i === 0 ? ignoreFirst : i === pts.length - 2 ? ignoreLast : new Set<string>()
      if (segmentCollides(p1, p2, ignoreIds)) return true
    }
    return false
  }

  const buildPathPoints = (midpoints: Array<{ x: number; y: number }>) => [
    { x: sourceX, y: sourceY },
    exitPoint,
    ...midpoints,
    approachPoint,
    { x: targetX, y: targetY },
  ]

  const hvMid = { x: approachPoint.x, y: exitPoint.y }
  const vhMid = { x: exitPoint.x, y: approachPoint.y }

  const hvPoints = buildPathPoints([hvMid])
  const vhPoints = buildPathPoints([vhMid])

  const hvCollides = polylineCollides(hvPoints)
  const vhCollides = polylineCollides(vhPoints)

  let chosenPoints = hvPoints
  if (hvCollides && !vhCollides) {
    chosenPoints = vhPoints
  } else if (!hvCollides && vhCollides) {
    chosenPoints = hvPoints
  } else if (!hvCollides && !vhCollides) {
    const hvLen = manhattan(exitPoint, hvMid) + manhattan(hvMid, approachPoint)
    const vhLen = manhattan(exitPoint, vhMid) + manhattan(vhMid, approachPoint)
    chosenPoints = hvLen <= vhLen ? hvPoints : vhPoints
  } else {
    const escape = getEscapePoint(sourceHandle, exitPoint.x, exitPoint.y)
    const escapeHV = buildPathPoints([
      escape,
      { x: escape.x, y: approachPoint.y },
    ])
    const escapeVH = buildPathPoints([
      escape,
      { x: approachPoint.x, y: escape.y },
    ])
    const escapeHVCollides = polylineCollides(escapeHV)
    const escapeVHCollides = polylineCollides(escapeVH)
    if (!escapeHVCollides && escapeVHCollides) {
      chosenPoints = escapeHV
    } else if (escapeHVCollides && !escapeVHCollides) {
      chosenPoints = escapeVH
    } else if (!escapeHVCollides && !escapeVHCollides) {
      const lenHV =
        manhattan(exitPoint, escape) +
        manhattan(escape, { x: escape.x, y: approachPoint.y }) +
        manhattan({ x: escape.x, y: approachPoint.y }, approachPoint)
      const lenVH =
        manhattan(exitPoint, escape) +
        manhattan(escape, { x: approachPoint.x, y: escape.y }) +
        manhattan({ x: approachPoint.x, y: escape.y }, approachPoint)
      chosenPoints = lenHV <= lenVH ? escapeHV : escapeVH
    } else {
      chosenPoints = hvPoints
    }
  }

  const points = chosenPoints

  const path = buildPathFromPoints(points)

  const labelAnchorIndex = Math.max(1, Math.floor((points.length - 1) / 2))
  const labelCenter = {
    x: (points[labelAnchorIndex].x + points[labelAnchorIndex - 1].x) / 2,
    y: (points[labelAnchorIndex].y + points[labelAnchorIndex - 1].y) / 2,
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

  const debugEdgeId = typeof data?.debugEdgeId === 'string' && data.debugEdgeId.length > 0 ? data.debugEdgeId : null
  const debugActive = (DEBUG && (!DEBUG_EDGE_ID || DEBUG_EDGE_ID === id)) || (debugEdgeId && debugEdgeId === id)

  if (debugActive) {
    const lastPoints = points.slice(-3)
    // eslint-disable-next-line no-console
    console.log('[SmartStepEdge]', {
      id,
      type: 'smartstep',
      source,
      target,
      sourceHandle,
      targetHandle,
      sourceX,
      sourceY,
      targetX,
      targetY,
      exitPoint,
      approachPoint,
      pathPoints: points,
      lastPoints,
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
          {points.length >= 2 && (
            <circle
              cx={points[points.length - 2].x}
              cy={points[points.length - 2].y}
              r={4}
              fill="purple"
            />
          )}
          {rects.map((rect) => (
            <rect
              key={rect.id}
              x={rect.x1}
              y={rect.y1}
              width={rect.x2 - rect.x1}
              height={rect.y2 - rect.y1}
              fill="none"
              stroke="gray"
              strokeDasharray="4 2"
              strokeWidth={1}
            />
          ))}
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="magenta"
            strokeWidth={1.5}
          />
          <text x={labelCenter.x} y={labelCenter.y - 12} fontSize={10} fill="magenta">
            SMARTSTEP
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

