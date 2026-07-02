import { render, screen, fireEvent } from '@testing-library/react'
import SurgeryContextBar from '@/components/admin/SurgeryContextBar'

const surgeries = [
  { id: 's1', name: 'Ide Lane Surgery' },
  { id: 's2', name: 'Pinhoe Surgery' },
]

describe('SurgeryContextBar', () => {
  it('renders a surgery dropdown on surgery-scoped tabs and propagates changes', () => {
    const onChange = jest.fn()
    render(
      <SurgeryContextBar
        scope="surgery"
        surgeries={surgeries}
        selectedSurgeryId="s1"
        onChange={onChange}
      />
    )

    const select = screen.getByLabelText('Select surgery') as HTMLSelectElement
    expect(select.value).toBe('s1')
    expect(screen.getByText('Configuring:')).toBeInTheDocument()
    expect(screen.queryByText('All surgeries')).not.toBeInTheDocument()

    fireEvent.change(select, { target: { value: 's2' } })
    expect(onChange).toHaveBeenCalledWith('s2')
  })

  it('shows a global badge instead of a dropdown on global tabs', () => {
    render(
      <SurgeryContextBar
        scope="global"
        surgeries={surgeries}
        selectedSurgeryId="s1"
        onChange={jest.fn()}
      />
    )

    expect(screen.getByText('Global')).toBeInTheDocument()
    expect(screen.getByText('This tab applies to all surgeries.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Select surgery')).not.toBeInTheDocument()
  })

  it('supports an "All surgeries" option that toggles the local flag without changing the shared selection', () => {
    const onChange = jest.fn()
    const onShowAllChange = jest.fn()
    render(
      <SurgeryContextBar
        scope="surgery"
        surgeries={surgeries}
        selectedSurgeryId="s1"
        onChange={onChange}
        label="Viewing:"
        allOption
        showAll={false}
        onShowAllChange={onShowAllChange}
      />
    )

    expect(screen.getByText('Viewing:')).toBeInTheDocument()
    const select = screen.getByLabelText('Select surgery') as HTMLSelectElement

    fireEvent.change(select, { target: { value: 'all' } })
    expect(onShowAllChange).toHaveBeenCalledWith(true)
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.change(select, { target: { value: 's2' } })
    expect(onShowAllChange).toHaveBeenCalledWith(false)
    expect(onChange).toHaveBeenCalledWith('s2')
  })

  it('reflects showAll in the dropdown value', () => {
    render(
      <SurgeryContextBar
        scope="surgery"
        surgeries={surgeries}
        selectedSurgeryId="s1"
        onChange={jest.fn()}
        allOption
        showAll
        onShowAllChange={jest.fn()}
      />
    )

    expect((screen.getByLabelText('Select surgery') as HTMLSelectElement).value).toBe('all')
  })
})
