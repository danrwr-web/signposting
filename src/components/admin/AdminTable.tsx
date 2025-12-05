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
  colWidths?: string[]
}

export default function AdminTable<T>({
  columns,
  rows,
  emptyMessage = 'No items found.',
  rowKey,
  onRowClick,
  colWidths,
}: AdminTableProps<T>) {
  return (
    <div className="sm:overflow-x-auto">
      <table className={`min-w-full divide-y divide-gray-200 ${colWidths ? 'table-fixed' : ''}`}>
        {colWidths && colWidths.length === columns.length && (
          <colgroup>
            {colWidths.map((width, index) => {
              // Extract width value from Tailwind class (e.g., "w-[200px]" -> "200px")
              const widthMatch = width.match(/\[(\d+px)\]/)
              const widthValue = widthMatch ? widthMatch[1] : null
              return (
                <col
                  key={index}
                  style={widthValue ? { width: widthValue } : undefined}
                />
              )
            })}
          </colgroup>
        )}
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            {columns.map((column) => {
              const hasTextRight = column.className?.includes('text-right')
              return (
                <th
                  key={column.key}
                  className={`px-6 py-3 ${hasTextRight ? 'text-right' : 'text-left'} text-xs font-medium text-gray-500 uppercase tracking-wider ${
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
              <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-gray-500">
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
                    className={`px-6 py-4 ${column.className?.includes('whitespace-nowrap') ? '' : 'whitespace-nowrap'} ${column.className || ''}`}
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

