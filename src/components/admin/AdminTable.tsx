'use client'

interface Column<T> {
  header: string
  key: string
  className?: string
  render?: (row: T) => React.ReactNode
}

interface AdminTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  emptyMessage?: string
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  colWidths?: string[] // CSS width strings, e.g. ["180px", "220px", ...]
  cellPadding?: string // Horizontal padding for cells, e.g. "px-4" or "px-6" (default: "px-6")
}

export default function AdminTable<T>({
  columns,
  rows,
  emptyMessage = 'No items found.',
  rowKey,
  onRowClick,
  colWidths,
  cellPadding = 'px-6',
}: AdminTableProps<T>) {
  return (
    <div className="max-sm:overflow-x-auto">
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
              return (
                <th
                  key={column.key}
                  className={`${cellPadding} py-3 ${hasTextRight ? 'text-right' : 'text-left'} text-xs font-medium text-gray-500 uppercase tracking-wider ${
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
                className={onRowClick ? 'hover:bg-gray-50 transition-colors cursor-pointer' : 'hover:bg-gray-50 transition-colors'}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`${cellPadding} py-4 ${column.className?.includes('whitespace-nowrap') ? '' : 'whitespace-nowrap'} ${column.className || ''}`}
                  >
                    {column.render ? column.render(row) : (row as any)[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

