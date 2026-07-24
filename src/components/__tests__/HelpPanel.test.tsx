import { render, screen, fireEvent, within } from '@testing-library/react'
import HelpPanel from '@/components/HelpPanel'

const DOCS_BASE_URL = 'https://docs.signpostingtool.co.uk'

function getDocLinks() {
  const dialog = screen.getByRole('dialog')
  return within(dialog)
    .getAllByRole('link')
    .map((link) => link.getAttribute('href') ?? '')
    .filter((href) => href.startsWith(DOCS_BASE_URL))
}

describe('HelpPanel', () => {
  it('renders nothing when closed', () => {
    render(<HelpPanel isOpen={false} onClose={jest.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens as a dialog with the expected title', () => {
    render(<HelpPanel isOpen onClose={jest.fn()} />)
    expect(
      screen.getByRole('heading', { name: 'Help & Documentation' })
    ).toBeInTheDocument()
  })

  it('does not link to the legacy /RELEASE_NOTES path', () => {
    render(<HelpPanel isOpen onClose={jest.fn()} />)
    const hrefs = getDocLinks()
    expect(hrefs.some((href) => href.includes('/RELEASE_NOTES'))).toBe(false)
  })

  it('links Release Notes to the live lowercase /release-notes page', () => {
    render(<HelpPanel isOpen onClose={jest.fn()} />)
    const releaseNotes = screen.getByRole('link', { name: /Release Notes/i })
    expect(releaseNotes).toHaveAttribute('href', `${DOCS_BASE_URL}/release-notes`)
  })

  it('points every documentation link at the docs site', () => {
    render(<HelpPanel isOpen onClose={jest.fn()} />)
    const hrefs = getDocLinks()
    expect(hrefs.length).toBeGreaterThan(0)
    hrefs.forEach((href) => expect(href.startsWith(DOCS_BASE_URL)).toBe(true))
  })

  it('filters links by keyword search', () => {
    render(<HelpPanel isOpen onClose={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('Search help links'), {
      target: { value: 'changelog' },
    })
    expect(screen.getByRole('link', { name: /Release Notes/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Symptom Library/i })
    ).not.toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', () => {
    render(<HelpPanel isOpen onClose={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('Search help links'), {
      target: { value: 'zzzznomatch' },
    })
    expect(screen.getByText('No matches found')).toBeInTheDocument()
  })
})
