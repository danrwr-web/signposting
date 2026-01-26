'use client'

import { useRef, useState, useEffect } from 'react'

interface Column<T> {
  header: string
  key: string
  className?: string
  render?: (row: T) => React.ReactNode
  /** If true, this column will be sticky to the right edge of the table */
  sticky?: boolean
}

interface AdminTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  emptyMessage?: string
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  colWidths?: string[] // CSS width strings, e.g. ["180px", "220px", ...]
  cellPadding?: string // Horizontal padding for cells, e.g. "px-4" or "px-6" (default: "px-6")
  /** If true, shows a hint when the table has horizontal overflow */
  showHorizontalScrollHint?: boolean
}

export default function AdminTable<T>({
  columns,
  rows,
  emptyMessage = 'No items found.',
  rowKey,
  onRowClick,
  colWidths,
  cellPadding = 'px-6',
  showHorizontalScrollHint = false,
}: AdminTableProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false)

  // Detect horizontal overflow on mount, resize, and when rows change
  useEffect(() => {
    if (!showHorizontalScrollHint) return

    const checkOverflow = () => {
      const el = scrollContainerRef.current
      if (el) {
        setHasHorizontalOverflow(el.scrollWidth > el.clientWidth)
      }
    }

    // Check on mount
    checkOverflow()

    // Check on resize
    const resizeObserver = new ResizeObserver(checkOverflow)
    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [showHorizontalScrollHint, rows.length, columns.length])

  return (
    <>
      {/* Horizontal scroll hint */}
      {showHorizontalScrollHint && hasHorizontalOverflow && (
        <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
          <span>Scroll horizontally to see more columns</span>
          <span aria-hidden="true">→</span>
        </p>
      )}
      <div ref={scrollContainerRef} className="overflow-x-auto">
      <table className={`min-w-full divide-y divide-gray-200 ${colWidths ? 'table-fixed w-max' : ''}`}>
        {colWidths && colWidths.length === columns.length && (
          <colgroup>
            {colWidths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
        )}
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            {columns.map((column) => {
              const hasTextRight = column.className?.includes('text-right')
              // Sticky column styling for header
              const stickyClasses = column.sticky
                ? 'sticky right-0 z-20 bg-gray-50 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]'
                : ''
              return (
                <th
                  key={column.key}
                  className={`${cellPadding} py-3 ${hasTextRight ? 'text-right' : 'text-left'} text-xs font-medium text-gray-500 uppercase tracking-wider ${stickyClasses} ${
                    column.className || ''
                  }`}
                >
                  {column.header}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={`${cellPadding} py-12 text-center text-sm text-gray-500`}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'hover:bg-gray-50 transition-colors cursor-pointer group' : 'hover:bg-gray-50 transition-colors group'}
              >
                {columns.map((column) => {
                  // Sticky column styling for body cells
                  const stickyClasses = column.sticky
                    ? 'sticky right-0 z-10 bg-white group-hover:bg-gray-50 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]'
                    : ''
                  return (
                    <td
                      key={column.key}
                      className={`${cellPadding} py-4 ${column.className?.includes('whitespace-nowrap') ? '' : 'whitespace-nowrap'} ${stickyClasses} ${column.className || ''}`}
                    >
                      {column.render ? column.render(row) : (row as any)[column.key]}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    </>
  )
}

