import { render, screen, fireEvent, act } from '@testing-library/react'
import { createRef } from 'react'
import StickyFilterBar from '@/components/StickyFilterBar'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

const makeSymptom = (id: string, name: string): EffectiveSymptom =>
  ({ id, name, ageGroup: 'Adult', source: 'base' } as unknown as EffectiveSymptom)

let observerCallback: IntersectionObserverCallback
const observe = jest.fn()
const disconnect = jest.fn()

beforeEach(() => {
  observe.mockClear()
  disconnect.mockClear()
  global.IntersectionObserver = jest.fn((cb: IntersectionObserverCallback) => {
    observerCallback = cb
    return { observe, disconnect, unobserve: jest.fn(), takeRecords: jest.fn() }
  }) as unknown as typeof IntersectionObserver
})

const fireIntersection = (isIntersecting: boolean, top: number) => {
  act(() => {
    observerCallback(
      [{ isIntersecting, boundingClientRect: { top } } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
  })
}

const renderBar = (overrides: Partial<Parameters<typeof StickyFilterBar>[0]> = {}) => {
  const sentinelRef = createRef<HTMLDivElement>()
  const result = render(
    <div>
      <div ref={sentinelRef} />
      <StickyFilterBar
        sentinelRef={sentinelRef}
        searchTerm=""
        onSearchChange={jest.fn()}
        selectedLetter="All"
        onLetterChange={jest.fn()}
        symptoms={[makeSymptom('1', 'Abdominal pain'), makeSymptom('2', 'Cough')]}
        resultsCount={2}
        totalCount={2}
        {...overrides}
      />
    </div>
  )
  return result
}

describe('StickyFilterBar', () => {
  it('is hidden until the toolbar sentinel scrolls out of view above', () => {
    renderBar()
    expect(screen.queryByPlaceholderText('Search symptoms...')).not.toBeInTheDocument()
  })

  it('appears when the sentinel leaves the viewport above', () => {
    renderBar()
    fireIntersection(false, -10)
    expect(screen.getByPlaceholderText('Search symptoms...')).toBeInTheDocument()
  })

  it('does not appear when the sentinel is below the viewport', () => {
    renderBar()
    fireIntersection(false, 500)
    expect(screen.queryByPlaceholderText('Search symptoms...')).not.toBeInTheDocument()
  })

  it('hides again when the sentinel scrolls back into view', () => {
    renderBar()
    fireIntersection(false, -10)
    fireIntersection(true, 100)
    expect(screen.queryByPlaceholderText('Search symptoms...')).not.toBeInTheDocument()
  })

  it('greys out letters with no symptoms and keeps populated letters enabled', () => {
    renderBar()
    fireIntersection(false, -10)
    expect(screen.getByRole('button', { name: 'B' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'A' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'All' })).toBeEnabled()
  })

  it('fires onLetterChange when a letter pill is clicked', () => {
    const onLetterChange = jest.fn()
    renderBar({ onLetterChange })
    fireIntersection(false, -10)
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(onLetterChange).toHaveBeenCalledWith('C')
  })

  it('fires onSearchChange after typing (via debounce)', async () => {
    jest.useFakeTimers()
    const onSearchChange = jest.fn()
    renderBar({ onSearchChange })
    fireIntersection(false, -10)
    fireEvent.change(screen.getByPlaceholderText('Search symptoms...'), { target: { value: 'cough' } })
    act(() => { jest.advanceTimersByTime(300) })
    expect(onSearchChange).toHaveBeenCalledWith('cough')
    jest.useRealTimers()
  })

  it('shows the results count', () => {
    renderBar({ resultsCount: 5, totalCount: 250 })
    fireIntersection(false, -10)
    expect(screen.getByText('5 of 250')).toBeInTheDocument()
  })
})
