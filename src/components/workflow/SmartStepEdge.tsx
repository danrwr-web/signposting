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
  x1: number
  x2: number
  y1: number
  y2: number
}

const MIN_RUN = 40
const PADDING = 12
const LANE_STEP = 24
const MAX_LANE_ATTEMPTS = 10

function buildPathFromPoints(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  const segments = rest.map((point) => `L ${point.x},${point.y}`).join(' ')
  return `M ${first.x},${first.y} ${segments}`
}

function horizontalIntersects(rect: Rect, y: number, x1: number, x2: number): boolean {
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  return y >= rect.y1 && y <= rect.y2 && maxX >= rect.x1 && minX <= rect.x2
}

function verticalIntersects(rect: Rect, x: number, y1: number, y2: number): boolean {
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)
  return x >= rect.x1 && x <= rect.x2 && maxY >= rect.y1 && minY <= rect.y2
}

function getLaneOffsets(): number[] {
  const offsets: number[] = [0]
  for (let i = 1; i < MAX_LANE_ATTEMPTS; i += 1) {
    const magnitude = Math.ceil(i / 2)
    const sign = i % 2 === 0 ? -1 : 1
    offsets.push(sign * magnitude)
  }
  return offsets
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
  style = {},
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  const nodeInternals = useStore((store) => store.nodeInternals)

  const inflatedRects = useMemo(() => {
    const exclude = new Set([source, target])
    return Array.from(nodeInternals.values())
      .filter((node) => node.width != null && node.height != null && node.positionAbsolute)
      .filter((node) => !exclude.has(node.id))
      .map((node) => {
        const { x, y } = node.positionAbsolute!
        const width = node.width ?? 0
        const height = node.height ?? 0
        return {
          x1: x - PADDING,
          y1: y - PADDING,
          x2: x + width + PADDING,
          y2: y + height + PADDING,
        }
      })
  }, [nodeInternals, source, target])

  const verticalFirst =
    sourcePosition === Position.Top || sourcePosition === Position.Bottom

  const baseLane = verticalFirst
    ? sourceY + (sourcePosition === Position.Top ? -MIN_RUN : MIN_RUN)
    : sourceX + (sourcePosition === Position.Left ? -MIN_RUN : MIN_RUN)

  const laneOffsets = useMemo(() => getLaneOffsets(), [])

  const laneCoordinate = laneOffsets.reduce<number | null>((chosen, offset) => {
    if (chosen !== null) return chosen
    const candidate = baseLane + offset * LANE_STEP

    const collides = inflatedRects.some((rect) =>
      verticalFirst
        ? horizontalIntersects(rect, candidate, sourceX, targetX)
        : verticalIntersects(rect, candidate, sourceY, targetY)
    )

    return collides ? null : candidate
  }, null)

  const lane = laneCoordinate ?? baseLane

  const points = verticalFirst
    ? [
        { x: sourceX, y: sourceY },
        { x: sourceX, y: lane },
        { x: targetX, y: lane },
        { x: targetX, y: targetY },
      ]
    : [
        { x: sourceX, y: sourceY },
        { x: lane, y: sourceY },
        { x: lane, y: targetY },
        { x: targetX, y: targetY },
      ]

  const path = buildPathFromPoints(points)

  const labelCenter = verticalFirst
    ? { x: (points[1].x + points[2].x) / 2, y: lane }
    : { x: lane, y: (points[1].y + points[2].y) / 2 }

  const mergedStyle = {
    stroke: '#005EB8',
    strokeWidth: 2.5,
    ...style,
  }

  const labelText = typeof label === 'string' ? label : ''
  const paddingX = typeof labelBgPadding?.[0] === 'number' ? labelBgPadding[0] : 0
  const paddingY = typeof labelBgPadding?.[1] === 'number' ? labelBgPadding[1] : 0
  const { transform: _ignoredTransform, ...restLabelStyle } = labelStyle ?? {}

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={mergedStyle} />
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

