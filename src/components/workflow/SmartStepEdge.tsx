'use client'

import { useMemo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  Position,
} from 'reactflow'

const DEBUG = false
const STEP = 24

function buildPathFromPoints(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  const segments = rest.map((point) => `L ${point.x},${point.y}`).join(' ')
  return `M ${first.x},${first.y} ${segments}`
}

function getExitPoint(
  sourceHandle: string | null | undefined,
  sourceX: number,
  sourceY: number
): { x: number; y: number } {
  switch (sourceHandle) {
    case 'source-top':
      return { x: sourceX, y: sourceY - STEP }
    case 'source-bottom':
      return { x: sourceX, y: sourceY + STEP }
    case 'source-left':
      return { x: sourceX - STEP, y: sourceY }
    case 'source-right':
      return { x: sourceX + STEP, y: sourceY }
    default:
      return { x: sourceX, y: sourceY + STEP }
  }
}

function getApproachPoint(
  targetHandle: string | null | undefined,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  switch (targetHandle) {
    case 'target-top':
      return { x: targetX, y: targetY - STEP }
    case 'target-bottom':
      return { x: targetX, y: targetY + STEP }
    case 'target-left':
      return { x: targetX - STEP, y: targetY }
    case 'target-right':
      return { x: targetX + STEP, y: targetY }
    default:
      return { x: targetX, y: targetY - STEP }
  }
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
  style = {},
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  const exitPoint = useMemo(
    () => getExitPoint(sourceHandle, sourceX, sourceY),
    [sourceHandle, sourceX, sourceY]
  )

  const approachPoint = useMemo(
    () => getApproachPoint(targetHandle, targetX, targetY),
    [targetHandle, targetX, targetY]
  )

  const dx = Math.abs(exitPoint.x - approachPoint.x)
  const dy = Math.abs(exitPoint.y - approachPoint.y)
  const verticalFirst = dy >= dx

  const middlePoints = verticalFirst
    ? [
        { x: exitPoint.x, y: approachPoint.y },
      ]
    : [
        { x: approachPoint.x, y: exitPoint.y },
      ]

  const points = [
    { x: sourceX, y: sourceY },
    exitPoint,
    ...middlePoints,
    approachPoint,
    { x: targetX, y: targetY },
  ]

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

  if (DEBUG) {
    const lastPoints = points.slice(-3)
    // eslint-disable-next-line no-console
    console.log('SmartStepEdge', {
      id,
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
      lastPoints,
    })
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={mergedStyle} />
      {DEBUG && (
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

