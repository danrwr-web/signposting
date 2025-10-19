'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import SymptomCard from './SymptomCard'

interface VirtualizedGridProps {
  symptoms: EffectiveSymptom[]
  surgerySlug?: string
  columns?: {
    xl: number
    lg: number
    md: number
    sm: number
  }
  itemHeight?: number
  overscan?: number
}

interface GridDimensions {
  columns: number
  itemWidth: number
  containerWidth: number
}

const DEFAULT_COLUMNS = {
  xl: 4,
  lg: 3,
  md: 2,
  sm: 1
}

const DEFAULT_ITEM_HEIGHT = 200
const DEFAULT_OVERSCAN = 5

export default function VirtualizedGrid({
  symptoms,
  surgerySlug,
  columns = DEFAULT_COLUMNS,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  overscan = DEFAULT_OVERSCAN
}: VirtualizedGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [gridDimensions, setGridDimensions] = useState<GridDimensions>({
    columns: 1,
    itemWidth: 0,
    containerWidth: 0
  })

  // Debug logging
  console.log('VirtualizedGrid: Received surgerySlug =', surgerySlug)


  // Calculate grid dimensions based on container width
  const calculateGridDimensions = (width: number): GridDimensions => {
    let cols = DEFAULT_COLUMNS.sm
    
    if (width >= 1280) {
      cols = columns.xl
    } else if (width >= 1024) {
      cols = columns.lg
    } else if (width >= 768) {
      cols = columns.md
    } else {
      cols = columns.sm
    }

    const gap = 24 // 6 * 4px gap
    const itemWidth = Math.floor((width - gap * (cols - 1)) / cols)
    
    return {
      columns: cols,
      itemWidth,
      containerWidth: width
    }
  }

  // Update grid dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth
        const height = containerRef.current.offsetHeight
        setContainerHeight(height)
        setGridDimensions(calculateGridDimensions(width))
      }
    }

    updateDimensions()
    
    const resizeObserver = new ResizeObserver(updateDimensions)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [columns])

  // Calculate visible range
  const visibleRange = useMemo(() => {
    if (!containerHeight || !gridDimensions.columns) {
      return { start: 0, end: 0 }
    }

    const rowsPerPage = Math.ceil(containerHeight / itemHeight)
    const itemsPerRow = gridDimensions.columns
    const itemsPerPage = rowsPerPage * itemsPerRow

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) * itemsPerRow - overscan * itemsPerRow)
    const endIndex = Math.min(symptoms.length, startIndex + itemsPerPage + overscan * itemsPerRow)

    return { start: startIndex, end: endIndex }
  }, [scrollTop, containerHeight, gridDimensions.columns, itemHeight, overscan, symptoms.length])

  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }

  // Calculate total height
  const totalRows = Math.ceil(symptoms.length / gridDimensions.columns)
  const totalHeight = totalRows * itemHeight + (totalRows - 1) * 24 // gap

  // Get visible symptoms
  const visibleSymptoms = symptoms.slice(visibleRange.start, visibleRange.end)

  // If we have fewer than 150 symptoms, render normally without virtualization
  if (symptoms.length <= 150) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {symptoms.map((symptom) => (
          <SymptomCard key={symptom.id} symptom={symptom} surgerySlug={surgerySlug} />
        ))}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="overflow-auto"
      style={{ height: '70vh' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleSymptoms.map((symptom, index) => {
          const globalIndex = visibleRange.start + index
          const row = Math.floor(globalIndex / gridDimensions.columns)
          const col = globalIndex % gridDimensions.columns
          
          const top = row * (itemHeight + 24) // itemHeight + gap
          const left = col * (gridDimensions.itemWidth + 24) // itemWidth + gap

          return (
            <div
              key={symptom.id}
              style={{
                position: 'absolute',
                top,
                left,
                width: gridDimensions.itemWidth,
                height: itemHeight
              }}
            >
              <SymptomCard symptom={symptom} surgerySlug={surgerySlug} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
