import { render, screen } from '@testing-library/react'
import HelpPage from '@/app/help/page'

// Mock the file system read
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => '# Test User Guide\n\nThis is a test guide.')
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  notFound: jest.fn()
}))

// Mock react-markdown
jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: string }) {
    return <div dangerouslySetInnerHTML={{ __html: children }} />
  }
})

// Mock remark-gfm
jest.mock('remark-gfm', () => jest.fn())

// Mock environment variable
const originalEnv = process.env
beforeEach(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_APP_VERSION: '0.9 (Beta)'
  }
})

afterEach(() => {
  process.env = originalEnv
})

describe('Help Page', () => {
  it('renders the markdown content', () => {
    render(<HelpPage />)
    
    expect(screen.getByRole('heading', { name: 'User Guide' })).toBeInTheDocument()
    expect(screen.getByText(/This is a test guide/)).toBeInTheDocument()
  })

  it('displays the page title correctly', () => {
    render(<HelpPage />)
    
    const title = screen.getByRole('heading', { name: 'User Guide' })
    expect(title).toBeInTheDocument()
    expect(title).toHaveClass('text-2xl', 'font-bold')
  })

  it('shows version footer with correct version', () => {
    render(<HelpPage />)
    
    expect(screen.getByText('Version 0.9 (Beta) — Last updated October 2025')).toBeInTheDocument()
  })

  it('includes PDF download link (disabled)', () => {
    render(<HelpPage />)
    
    const pdfButton = screen.getByRole('button', { name: 'PDF download coming soon' })
    expect(pdfButton).toBeInTheDocument()
    expect(pdfButton).toBeDisabled()
  })

  it('has proper semantic HTML structure', () => {
    render(<HelpPage />)
    
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('article')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('handles missing markdown file gracefully', () => {
    // Mock fs.readFileSync to throw an error
    const fs = require('fs')
    fs.readFileSync.mockImplementationOnce(() => {
      throw new Error('File not found')
    })

    render(<HelpPage />)
    
    expect(screen.getByText('User Guide not found')).toBeInTheDocument()
    expect(screen.getByText('Please ensure docs/USER_GUIDE.md exists.')).toBeInTheDocument()
  })
})
