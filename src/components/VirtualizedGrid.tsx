'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import SymptomCard, { SymptomChangeInfo, CardData } from './SymptomCard'
import { useSurgery } from '@/context/SurgeryContext'
import { useCardStyle } from '@/context/CardStyleContext'

interface VirtualizedGridProps {
  symptoms: EffectiveSymptom[]
  surgeryId?: string
  columns?: {
    xl: number
    lg: number
    md: number
    sm: number
  }
  itemHeight?: number
  overscan?: number
  /** Map of symptom ID to change info (New/Updated badges) */
  changesMap?: Map<string, SymptomChangeInfo>
  /** Pre-fetched card data (highlights, image icons, settings) shared across all cards */
  cardData?: CardData
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

const DEFAULT_OVERSCAN = 5

export default function VirtualizedGrid({
  symptoms,
  surgeryId,
  columns = DEFAULT_COLUMNS,
  itemHeight,
  overscan = DEFAULT_OVERSCAN,
  changesMap,
  cardData
}: VirtualizedGridProps) {
  const { currentSurgeryId } = useSurgery()
  const { isSimplified, cardStyle } = useCardStyle()
  const resolvedItemHeight = useMemo(() => {
    if (typeof itemHeight === 'number') {
      return itemHeight
    }
    // Provide a little extra room to avoid overlaps in virtualised mode.
    return isSimplified ? 220 : cardStyle === 'powerappsBlue' ? 280 : 272
  }, [itemHeight, isSimplified, cardStyle])
  
  // Use provided surgeryId or fall back to context.
  // This should match the `/s/[id]` route segment so symptom links remain consistent.
  const effectiveSurgeryId = surgeryId || currentSurgeryId
  // Ensure symptoms are sorted alphabetically
  const sortedSymptoms = useMemo(() => 
    [...symptoms].sort((a, b) => a.name.localeCompare(b.name)), 
    [symptoms]
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [gridDimensions, setGridDimensions] = useState<GridDimensions>({
    columns: 1,
    itemWidth: 0,
    containerWidth: 0
  })

  // Debug logging


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

    const rowsPerPage = Math.ceil(containerHeight / resolvedItemHeight)
    const itemsPerRow = gridDimensions.columns
    const itemsPerPage = rowsPerPage * itemsPerRow

    const startIndex = Math.max(0, Math.floor(scrollTop / resolvedItemHeight) * itemsPerRow - overscan * itemsPerRow)
    const endIndex = Math.min(sortedSymptoms.length, startIndex + itemsPerPage + overscan * itemsPerRow)

    return { start: startIndex, end: endIndex }
  }, [scrollTop, containerHeight, gridDimensions.columns, resolvedItemHeight, overscan, sortedSymptoms.length])

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Calculate total height
  const totalRows = Math.ceil(sortedSymptoms.length / gridDimensions.columns)
  const totalHeight = totalRows * resolvedItemHeight + (totalRows - 1) * 24 // gap

  // Get visible symptoms
  const visibleSymptoms = sortedSymptoms.slice(visibleRange.start, visibleRange.end)

  const renderSymptom = useCallback(
    (symptom: EffectiveSymptom, key?: string) => (
      <div key={key ?? symptom.id}>
        <SymptomCard
          symptom={symptom}
          surgeryId={effectiveSurgeryId || undefined}
          changeInfo={changesMap?.get(symptom.id)}
          cardData={cardData}
        />
      </div>
    ),
    [effectiveSurgeryId, changesMap, cardData]
  )

  // If we have fewer than 150 symptoms, render normally without virtualization
  if (sortedSymptoms.length <= 150) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sortedSymptoms.map((symptom) => (
          renderSymptom(symptom, symptom.id)
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
          
          const top = row * (resolvedItemHeight + 24) // itemHeight + gap
          const left = col * (gridDimensions.itemWidth + 24) // itemWidth + gap

          return (
            <div
              key={symptom.id}
              style={{
                position: 'absolute',
                top,
                left,
                width: gridDimensions.itemWidth,
                height: resolvedItemHeight
              }}
            >
              {renderSymptom(symptom)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
