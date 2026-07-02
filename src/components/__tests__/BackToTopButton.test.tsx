import { render, screen, fireEvent } from '@testing-library/react'
import BackToTopButton from '@/components/BackToTopButton'

const setScrollY = (value: number) => {
  Object.defineProperty(window, 'scrollY', { value, writable: true, configurable: true })
}

beforeEach(() => {
  setScrollY(0)
  window.scrollTo = jest.fn()
  window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
})

describe('BackToTopButton', () => {
  it('is hidden while the page is near the top', () => {
    render(<BackToTopButton />)
    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument()
  })

  it('appears after scrolling past the threshold', () => {
    render(<BackToTopButton />)
    setScrollY(700)
    fireEvent.scroll(window)
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument()
  })

  it('hides again when scrolled back to the top', () => {
    render(<BackToTopButton />)
    setScrollY(700)
    fireEvent.scroll(window)
    setScrollY(0)
    fireEvent.scroll(window)
    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument()
  })

  it('scrolls to the top when clicked', () => {
    render(<BackToTopButton />)
    setScrollY(700)
    fireEvent.scroll(window)
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }))
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('uses instant scrolling when the user prefers reduced motion', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    render(<BackToTopButton />)
    setScrollY(700)
    fireEvent.scroll(window)
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }))
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })
})
