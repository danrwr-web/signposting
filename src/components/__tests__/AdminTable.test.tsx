import { fireEvent, render, screen } from '@testing-library/react'
import AdminTable from '@/components/admin/AdminTable'

interface Row {
  id: string
  name: string
}

const rows: Row[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
]

const columns = [
  { header: 'Name', key: 'name' },
  { header: 'Id', key: 'id' },
]

describe('AdminTable', () => {
  it('renders rows and plain headers without sort props (back-compat)', () => {
    render(<AdminTable columns={columns} rows={rows} rowKey={(r) => r.id} />)

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    // Headers are not buttons when sorting is not enabled
    expect(screen.queryByRole('button', { name: /Name/ })).not.toBeInTheDocument()
  })

  it('renders a string empty message', () => {
    render(<AdminTable columns={columns} rows={[]} rowKey={(r: Row) => r.id} emptyMessage="Nothing here." />)
    expect(screen.getByText('Nothing here.')).toBeInTheDocument()
  })

  it('renders a ReactNode empty message', () => {
    render(
      <AdminTable
        columns={columns}
        rows={[]}
        rowKey={(r: Row) => r.id}
        emptyMessage={<button type="button">Clear filters</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('fires onSortChange when a sortable header is clicked', () => {
    const onSortChange = jest.fn()
    render(
      <AdminTable
        columns={[{ header: 'Name', key: 'name', sortable: true }, { header: 'Id', key: 'id' }]}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'name', direction: 'asc' }}
        onSortChange={onSortChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(onSortChange).toHaveBeenCalledWith('name')
    // Non-sortable columns stay plain
    expect(screen.queryByRole('button', { name: /Id/ })).not.toBeInTheDocument()
  })

  it('exposes the active sort via aria-sort', () => {
    const { rerender } = render(
      <AdminTable
        columns={[{ header: 'Name', key: 'name', sortable: true }]}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'name', direction: 'asc' }}
        onSortChange={jest.fn()}
      />
    )
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending')

    rerender(
      <AdminTable
        columns={[{ header: 'Name', key: 'name', sortable: true }]}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'name', direction: 'desc' }}
        onSortChange={jest.fn()}
      />
    )
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'descending')
  })

  it('calls onRowClick with the clicked row', () => {
    const onRowClick = jest.fn()
    render(<AdminTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />)

    fireEvent.click(screen.getByText('Beta'))
    expect(onRowClick).toHaveBeenCalledWith(rows[1])
  })
})
