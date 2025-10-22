/**
 * Tests for TipTap Editor Component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import TipTapEditor from '@/components/rich-text/TipTapEditor'

// Mock the dynamic imports
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (fn: () => Promise<any>) => {
    const Component = fn()
    return Component
  }
}))

jest.mock('tiptap-markdown', () => ({
  markdownToProseMirror: jest.fn((markdown: string) => ({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: markdown }]
      }
    ]
  })),
  proseMirrorToMarkdown: jest.fn((json: any) => 'converted markdown')
}))

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn()
  }
}))

describe('TipTapEditor', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('renders editor with placeholder', async () => {
    render(
      <TipTapEditor
        value={null}
        onChange={mockOnChange}
        placeholder="Start typing..."
      />
    )

    // Wait for the editor to mount
    await waitFor(() => {
      expect(screen.getByText('Start typing...')).toBeInTheDocument()
    })
  })

  it('renders toolbar buttons', async () => {
    render(
      <TipTapEditor
        value={null}
        onChange={mockOnChange}
        readOnly={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByTitle('Bold')).toBeInTheDocument()
      expect(screen.getByTitle('Italic')).toBeInTheDocument()
      expect(screen.getByTitle('Underline')).toBeInTheDocument()
      expect(screen.getByTitle('Heading 1')).toBeInTheDocument()
      expect(screen.getByTitle('Bullet List')).toBeInTheDocument()
      expect(screen.getByTitle('Numbered List')).toBeInTheDocument()
    })
  })

  it('hides toolbar in read-only mode', async () => {
    render(
      <TipTapEditor
        value={null}
        onChange={mockOnChange}
        readOnly={true}
      />
    )

    await waitFor(() => {
      expect(screen.queryByTitle('Bold')).not.toBeInTheDocument()
    })
  })

  it('opens link modal when link button is clicked', async () => {
    render(
      <TipTapEditor
        value={null}
        onChange={mockOnChange}
        readOnly={false}
      />
    )

    await waitFor(() => {
      const linkButton = screen.getByTitle('Add Link')
      fireEvent.click(linkButton)
    })

    expect(screen.getByText('Add Link')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('https://example.com')).toBeInTheDocument()
  })

  it('opens markdown modal when import button is clicked', async () => {
    render(
      <TipTapEditor
        value={null}
        onChange={mockOnChange}
        readOnly={false}
      />
    )

    await waitFor(() => {
      const importButton = screen.getByTitle('Import from Markdown')
      fireEvent.click(importButton)
    })

    expect(screen.getByText('Markdown Import/Export')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Paste markdown here to import, or edit exported markdown...')).toBeInTheDocument()
  })

  it('shows color picker when color button is clicked', async () => {
    render(
      <TipTapEditor
        value={null}
        onChange={mockOnChange}
        readOnly={false}
      />
    )

    await waitFor(() => {
      const colorButton = screen.getByTitle('Text Colour')
      fireEvent.click(colorButton)
    })

    // Color picker should be visible
    expect(screen.getByTitle('Blue')).toBeInTheDocument()
    expect(screen.getByTitle('Red')).toBeInTheDocument()
    expect(screen.getByTitle('Green')).toBeInTheDocument()
  })

  it('shows badge picker when badge button is clicked', async () => {
    render(
      <TipTapEditor
        value={null}
        onChange={mockOnChange}
        readOnly={false}
      />
    )

    await waitFor(() => {
      const badgeButton = screen.getByTitle('NHS Badge')
      fireEvent.click(badgeButton)
    })

    // Badge picker should be visible
    expect(screen.getByText('Red Badge')).toBeInTheDocument()
    expect(screen.getByText('Orange Badge')).toBeInTheDocument()
    expect(screen.getByText('Green Badge')).toBeInTheDocument()
  })
})
