'use client'

import { useState } from 'react'
import type { EngagementTrendPoint } from '@/lib/api-contracts'

const VIEW_W = 720
const VIEW_H = 200
const MARGIN = { top: 10, right: 8, bottom: 24, left: 40 }

const BAR_FILL = '#005EB8' // nhs-blue
const BAR_FILL_HOVER = '#003087' // nhs-dark-blue
const GRID_STROKE = '#E5E7EB'
const AXIS_STROKE = '#D1D5DB'
const TICK_FILL = '#6B7280'

/** Round up to a clean axis maximum (1/2/5 × 10^k). */
export function niceCeil(value: number): number {
  if (value <= 0) return 0
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  for (const step of [1, 2, 5, 10]) {
    if (value <= step * magnitude) return step * magnitude
  }
  return 10 * magnitude
}

function formatDate(isoDay: string): string {
  return new Date(`${isoDay}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** Bar path with a rounded top (data end) and a square baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  const bottom = y + h
  return [
    `M ${x} ${bottom}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${bottom}`,
    'Z',
  ].join(' ')
}

export interface TrendChartProps {
  points: EngagementTrendPoint[]
}

export function TrendChart({ points }: TrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const total = points.reduce((sum, p) => sum + p.views, 0)
  if (points.length === 0 || total === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        No symptom views recorded in this period.
      </p>
    )
  }

  const innerW = VIEW_W - MARGIN.left - MARGIN.right
  const innerH = VIEW_H - MARGIN.top - MARGIN.bottom
  const maxViews = Math.max(...points.map(p => p.views))
  const yMax = niceCeil(maxViews)
  const slot = innerW / points.length
  const barW = Math.max(Math.min(24, slot - 2), 1)

  const peak = points.reduce((best, p) => (p.views > best.views ? p : best), points[0])

  // ~5 evenly spaced x-axis labels, always including first and last day
  const labelCount = Math.min(5, points.length)
  const labelIndices = new Set(
    Array.from({ length: labelCount }, (_, i) =>
      Math.round((i * (points.length - 1)) / Math.max(labelCount - 1, 1))
    )
  )

  const yFor = (views: number) => MARGIN.top + innerH * (1 - views / yMax)

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Daily symptom views over ${points.length} days. ${total.toLocaleString()} views in total, peaking at ${peak.views} on ${formatDate(peak.date)}.`}
    >
      {[yMax, yMax / 2].map(tick => (
        <g key={tick}>
          <line
            x1={MARGIN.left}
            x2={VIEW_W - MARGIN.right}
            y1={yFor(tick)}
            y2={yFor(tick)}
            stroke={GRID_STROKE}
            strokeWidth={1}
          />
          <text
            x={MARGIN.left - 6}
            y={yFor(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={10}
            fill={TICK_FILL}
          >
            {Number.isInteger(tick) ? tick.toLocaleString() : tick}
          </text>
        </g>
      ))}
      <line
        x1={MARGIN.left}
        x2={VIEW_W - MARGIN.right}
        y1={MARGIN.top + innerH}
        y2={MARGIN.top + innerH}
        stroke={AXIS_STROKE}
        strokeWidth={1}
      />
      <text
        x={MARGIN.left - 6}
        y={MARGIN.top + innerH}
        textAnchor="end"
        dominantBaseline="middle"
        fontSize={10}
        fill={TICK_FILL}
      >
        0
      </text>

      {points.map((point, i) => {
        const slotX = MARGIN.left + i * slot
        const x = slotX + (slot - barW) / 2
        const h = (point.views / yMax) * innerH
        return (
          <g
            key={point.date}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Full-height hit target so hover/tooltip works on short bars */}
            <rect
              x={slotX}
              y={MARGIN.top}
              width={slot}
              height={innerH}
              fill="transparent"
            />
            {point.views > 0 && (
              <path
                d={barPath(x, MARGIN.top + innerH - h, barW, h)}
                fill={hovered === i ? BAR_FILL_HOVER : BAR_FILL}
              />
            )}
            <title>{`${formatDate(point.date)} — ${point.views.toLocaleString()} view${point.views === 1 ? '' : 's'}`}</title>
          </g>
        )
      })}

      {points.map((point, i) =>
        labelIndices.has(i) ? (
          <text
            key={`label-${point.date}`}
            x={MARGIN.left + i * slot + slot / 2}
            y={VIEW_H - 8}
            textAnchor="middle"
            fontSize={10}
            fill={TICK_FILL}
          >
            {formatDate(point.date)}
          </text>
        ) : null
      )}
    </svg>
  )
}
