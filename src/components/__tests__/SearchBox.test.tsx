import { render, screen, fireEvent } from '@testing-library/react'
import SearchBox from '@/components/SearchBox'

describe('SearchBox clear button', () => {
  it('is not shown when the search box is empty', () => {
    render(<SearchBox value="" onChange={jest.fn()} />)
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('appears once the user has typed something', () => {
    render(<SearchBox value="" onChange={jest.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'cough' } })
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()
  })

  it('clears the input and fires onChange immediately, without the debounce', () => {
    const onChange = jest.fn()
    render(<SearchBox value="" onChange={onChange} debounceMs={5000} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'cough' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(input).toHaveValue('')
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('keeps focus on the input after clearing', () => {
    render(<SearchBox value="" onChange={jest.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'cough' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(input).toHaveFocus()
  })
})
