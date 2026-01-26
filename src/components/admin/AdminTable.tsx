'use client'

interface Column<T> {
  header: string
  key: string
  className?: string
  render?: (row: T) => React.ReactNode
  /** If true, this column will be sticky to the right edge of the table */
  sticky?: boolean
  /** If true, this column will be sticky to the left edge of the table */
  stickyLeft?: boolean
}

interface AdminTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  emptyMessage?: string
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  colWidths?: string[] // CSS width strings, e.g. ["180px", "220px", ...]
  cellPadding?: string // Horizontal padding for cells, e.g. "px-4" or "px-6" (default: "px-6")
  /** Additional classes for the scroll container (e.g., max-h for vertical scroll) */
  scrollContainerClassName?: string
}

export default function AdminTable<T>({
  columns,
  rows,
  emptyMessage = 'No items found.',
  rowKey,
  onRowClick,
  colWidths,
  cellPadding = 'px-6',
  scrollContainerClassName = '',
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
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            {columns.map((column) => {
              const hasTextRight = column.className?.includes('text-right')
              // Sticky column styling for header
              let stickyClasses = ''
              if (column.sticky) {
                stickyClasses = 'sticky right-0 z-20 bg-gray-50'
              } else if (column.stickyLeft) {
                stickyClasses = 'sticky left-0 z-20 bg-gray-50'
              }
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
                  let stickyClasses = ''
                  if (column.sticky) {
                    stickyClasses = 'sticky right-0 z-10 bg-white group-hover:bg-gray-50'
                  } else if (column.stickyLeft) {
                    stickyClasses = 'sticky left-0 z-10 bg-white group-hover:bg-gray-50'
                  }
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
  )
}
