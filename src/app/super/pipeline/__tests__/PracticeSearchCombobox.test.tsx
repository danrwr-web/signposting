import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import PracticeSearchCombobox from '../PracticeSearchCombobox'

jest.mock('react-hot-toast', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}))

const originalFetch = global.fetch

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const searchResults = {
  results: [
    { odsCode: 'L83100', name: 'Ide Lane Surgery', postcode: 'EX2 8UP' },
    { odsCode: 'L83057', name: 'Pinhoe Surgery', postcode: 'EX4 9HN' },
  ],
}

const detailPayload = {
  odsCode: 'L83100',
  name: 'Ide Lane Surgery',
  addressLines: ['Ide Lane', 'Alphington'],
  town: 'Exeter',
  postcode: 'EX2 8UP',
  pcnName: 'Outer Exeter PCN',
  listSize: 8900,
  listSizeExtractDate: '2026-07-01T00:00:00.000Z',
  listSizeStale: false,
}

describe('PracticeSearchCombobox', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  function setup(props: Partial<React.ComponentProps<typeof PracticeSearchCombobox>> = {}) {
    const onChange = jest.fn()
    const onSelect = jest.fn()
    const utils = render(
      <PracticeSearchCombobox value="" onChange={onChange} onSelect={onSelect} {...props} />
    )
    return { onChange, onSelect, ...utils }
  }

  it('does not search below the minimum query length', async () => {
    const mockFetch = jest.fn()
    global.fetch = mockFetch as typeof fetch
    setup()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('debounces keystrokes into a single search request', async () => {
    const mockFetch = jest.fn().mockResolvedValue(jsonResponse(searchResults))
    global.fetch = mockFetch as typeof fetch
    setup()

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'id' } })
    fireEvent.change(input, { target: { value: 'ide' } })
    fireEvent.change(input, { target: { value: 'ide l' } })

    act(() => {
      jest.advanceTimersByTime(300)
    })
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    expect(mockFetch.mock.calls[0][0]).toContain('q=ide%20l')

    expect(await screen.findByText('Ide Lane Surgery')).toBeInTheDocument()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('selects with keyboard navigation and fires onSelect with the detail payload', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResults))
      .mockResolvedValueOnce(jsonResponse(detailPayload))
    global.fetch = mockFetch as typeof fetch
    const { onChange, onSelect } = setup()

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'ide lane' } })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    await screen.findByText('Ide Lane Surgery')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const enterEvent = fireEvent.keyDown(input, { key: 'Enter' })
    // preventDefault must have been called so the parent form doesn't submit
    expect(enterEvent).toBe(false)

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(detailPayload))
    expect(onChange).toHaveBeenLastCalledWith('Ide Lane Surgery')
    expect(mockFetch.mock.calls[1][0]).toContain('/api/super/practice-lookup/L83100')
  })

  it('closes the listbox on Escape without clearing the input', async () => {
    const mockFetch = jest.fn().mockResolvedValue(jsonResponse(searchResults))
    global.fetch = mockFetch as typeof fetch
    setup({ value: 'ide' })

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'ide lane' } })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    await screen.findByRole('listbox')

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows a non-blocking message when the search fails', async () => {
    const mockFetch = jest.fn().mockResolvedValue(jsonResponse({ error: 'Directory down' }, 502))
    global.fetch = mockFetch as typeof fetch
    setup()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ide lane' } })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(await screen.findByText('Directory down')).toBeInTheDocument()
    // Input remains usable
    expect(screen.getByRole('combobox')).not.toBeDisabled()
  })

  it('shows the empty-results hint', async () => {
    const mockFetch = jest.fn().mockResolvedValue(jsonResponse({ results: [] }))
    global.fetch = mockFetch as typeof fetch
    setup()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzz' } })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(
      await screen.findByText(/No matching practices/)
    ).toBeInTheDocument()
  })
})
