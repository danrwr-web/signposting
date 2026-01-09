import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HighlightConfig from '@/components/HighlightConfig'

jest.mock('react-hot-toast', () => {
  const toast = (..._args: any[]) => {}
  ;(toast as any).error = jest.fn()
  ;(toast as any).success = jest.fn()
  return { toast }
})

describe('HighlightConfig duplicate create recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('switches into edit mode after a 409 duplicate create', async () => {
    const payload = {
      highlights: [
        {
          id: 'hr-1',
          phrase: 'pharmacy',
          textColor: '#ffffff',
          bgColor: '#000000',
          isEnabled: true,
          surgeryId: 's1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      enableBuiltInHighlights: true,
      enableImageIcons: true,
    }

    const fetchMock = jest.fn(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url
      const method = (init?.method ?? 'GET').toUpperCase()

      if (url?.startsWith('/api/highlights') && method === 'GET') {
        return new Response(JSON.stringify(payload), { status: 200 })
      }

      if (url === '/api/highlights' && method === 'POST') {
        return new Response(JSON.stringify({ error: 'A highlight rule with this phrase already exists' }), { status: 409 })
      }

      return new Response(JSON.stringify({ error: 'Unexpected request' }), { status: 500 })
    })

    // @ts-expect-error - override global fetch for test
    global.fetch = fetchMock

    render(<HighlightConfig surgeryId="s1" isSuperuser={false} />)

    // Wait for initial list to load
    await waitFor(() => {
      expect(screen.getAllByText('pharmacy').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add Rule' }))

    fireEvent.change(screen.getByLabelText('Phrase'), { target: { value: 'Pharmacy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Rule' }))

    // Recovery path: switches into edit mode
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    })

    expect(screen.getByText(/Rule already exists/i)).toBeInTheDocument()
    expect((screen.getByLabelText('Phrase') as HTMLInputElement).value).toBe('pharmacy')
  })
})

