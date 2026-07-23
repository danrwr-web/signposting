'use client'

export interface AdminTableSort {
  key: string
  direction: 'asc' | 'desc'
}

interface Column<T> {
  header: string
  key: string
  className?: string
  render?: (row: T) => React.ReactNode
  /** If true, this column will be sticky to the right edge of the table */
  sticky?: boolean
  /** If true, this column will be sticky to the left edge of the table */
  stickyLeft?: boolean
  /** If true (and onSortChange is provided), the header becomes a sort toggle */
  sortable?: boolean
}

interface AdminTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  emptyMessage?: React.ReactNode
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  colWidths?: string[] // CSS width strings, e.g. ["180px", "220px", ...]
  cellPadding?: string // Horizontal padding for cells, e.g. "px-4" or "px-6" (default: "px-6")
  cellPaddingY?: string // Vertical padding for body cells (default: "py-4")
  /** Additional classes for the scroll container (e.g., max-h for vertical scroll) */
  scrollContainerClassName?: string
  /** Current sort state; parent owns the toggle logic via onSortChange */
  sort?: AdminTableSort
  onSortChange?: (key: string) => void
}

export default function AdminTable<T>({
  columns,
  rows,
  emptyMessage = 'No items found.',
  rowKey,
  onRowClick,
  colWidths,
  cellPadding = 'px-6',
  cellPaddingY = 'py-4',
  scrollContainerClassName = '',
  sort,
  onSortChange,
}: AdminTableProps<T>) {
  return (
    <div className={scrollContainerClassName}>
      <table className={`w-full divide-y divide-gray-200 ${colWidths ? 'table-fixed' : ''}`}>
        {colWidths && colWidths.length === columns.length && (
          <colgroup>
            {colWidths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
        )}
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => {
              const hasTextRight = column.className?.includes('text-right')
              // Sticky headers live on the th cells (not thead) so they stack
              // above the sticky-left/right body cells while scrolling.
              let stickyClasses = 'sticky top-0 z-20 bg-gray-50'
              if (column.sticky) {
                stickyClasses = 'sticky top-0 right-0 z-30 bg-gray-50'
              } else if (column.stickyLeft) {
                stickyClasses = 'sticky top-0 left-0 z-30 bg-gray-50'
              }
              const isSortable = column.sortable && onSortChange
              const isSorted = sort?.key === column.key
              return (
                <th
                  key={column.key}
                  aria-sort={
                    isSortable && isSorted
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  className={`${cellPadding} py-3 ${hasTextRight ? 'text-right' : 'text-left'} text-xs font-medium text-gray-500 uppercase tracking-wider ${stickyClasses} ${
                    column.className || ''
                  }`}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.key)}
                      className="inline-flex items-center gap-1 uppercase tracking-wider font-medium hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue rounded"
                    >
                      {column.header}
                      <span aria-hidden="true" className={isSorted ? 'text-gray-700' : 'text-gray-300'}>
                        {isSorted ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
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
                className={onRowClick ? 'hover:bg-gray-50/70 cursor-pointer group' : 'hover:bg-gray-50/70 group'}
              >
                {columns.map((column) => {
                  // Sticky column styling for body cells - must transition with row
                  let stickyClasses = ''
                  if (column.sticky) {
                    stickyClasses = 'sticky right-0 z-10 bg-white group-hover:bg-gray-50/70 transition-colors duration-150'
                  } else if (column.stickyLeft) {
                    stickyClasses = 'sticky left-0 z-10 bg-white group-hover:bg-gray-50/70 transition-colors duration-150'
                  }
                  return (
                    <td
                      key={column.key}
                      className={`${cellPadding} ${cellPaddingY} transition-colors duration-150 ${column.className?.includes('whitespace-nowrap') ? '' : 'whitespace-nowrap'} ${stickyClasses} ${column.className || ''}`}
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
  )
}
