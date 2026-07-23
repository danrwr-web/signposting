import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import SurgeryUsersClient from '@/app/s/[id]/admin/users/SurgeryUsersClient'
import type { Surgery } from '@/app/s/[id]/admin/users/types'

const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

jest.mock('react-hot-toast', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}))

jest.mock('@/components/SetupChecklistBackLink', () => ({
  __esModule: true,
  default: () => <div data-testid="setup-back-link" />,
}))

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

const surgery: Surgery = {
  id: 's1',
  name: 'Mount Pleasant Health Centre',
  slug: 'mount-pleasant',
  users: [
    {
      id: 'm-alice',
      role: 'ADMIN',
      adminToolkitWrite: false,
      user: { id: 'u-alice', email: 'alice@nhs.net', name: 'Alice Adams', defaultSurgeryId: 's1' },
    },
    {
      id: 'm-bob',
      role: 'STANDARD',
      adminToolkitWrite: false,
      user: { id: 'u-bob', email: 'bob@nhs.net', name: 'Bob Brown', defaultSurgeryId: null },
    },
    {
      id: 'm-cara',
      role: 'STANDARD',
      adminToolkitWrite: true,
      user: { id: 'u-cara', email: 'cara@nhs.net', name: 'Cara Cole', defaultSurgeryId: null },
    },
  ],
}

const lastActiveData: Record<string, string | null> = {
  'u-alice': daysAgo(2),
  'u-bob': daysAgo(45),
  'u-cara': null,
}

const sessionUser = { id: 'admin', email: 'admin@nhs.net' } as any

function renderPage(handbookEnabled = true) {
  return render(
    <SurgeryUsersClient
      surgery={surgery}
      user={sessionUser}
      lastActiveData={lastActiveData}
      handbookEnabled={handbookEnabled}
    />
  )
}

function getRowOrder(): string[] {
  const rows = screen.getAllByRole('row').slice(1) // drop header row
  const names = ['Alice Adams', 'Bob Brown', 'Cara Cole']
  return rows.map((row) => names.find((name) => row.textContent?.includes(name)) || '?')
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  }) as jest.Mock
})

describe('SurgeryUsersClient', () => {
  it('renders summary stats computed from the full member list', () => {
    renderPage()

    const statFor = (label: string) => {
      const tile = screen
        .getAllByText(label)
        .map((el) => el.parentElement as HTMLElement)
        .find((parent) => within(parent).queryByText(/^\d+$/))
      return tile ? within(tile).getByText(/^\d+$/).textContent : null
    }

    expect(statFor('Total members')).toBe('3')
    expect(statFor('Practice admins')).toBe('1')
    expect(statFor('Active last 30 days')).toBe('1')
    expect(statFor('Never signed in')).toBe('1')
  })

  it('badges practice admins only — no badge for standard members', () => {
    renderPage()

    expect(screen.getAllByText('Practice admin')).toHaveLength(1)
    expect(screen.queryByText('Standard')).not.toBeInTheDocument()
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('filters with the Practice admins chip', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Practice admins' }))

    expect(screen.getByText('Alice Adams')).toBeInTheDocument()
    expect(screen.queryByText('Bob Brown')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 1 of 3 members')).toBeInTheDocument()
  })

  it('filters with the Handbook access chip using effective access', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Handbook access' }))

    // Alice (admin, always) and Cara (explicit grant) remain
    expect(screen.getByText('Alice Adams')).toBeInTheDocument()
    expect(screen.getByText('Cara Cole')).toBeInTheDocument()
    expect(screen.queryByText('Bob Brown')).not.toBeInTheDocument()
  })

  it('hides the Permissions column and Handbook chip when the feature is disabled', () => {
    renderPage(false)

    expect(screen.queryByText('Permissions')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Handbook access' })).not.toBeInTheDocument()
    expect(screen.queryByText('Handbook')).not.toBeInTheDocument()
  })

  it('re-sorts by last active when the header is clicked', () => {
    renderPage()

    expect(getRowOrder()).toEqual(['Alice Adams', 'Bob Brown', 'Cara Cole'])

    fireEvent.click(screen.getByRole('button', { name: /Last active/ }))
    expect(getRowOrder()).toEqual(['Alice Adams', 'Bob Brown', 'Cara Cole'])

    fireEvent.click(screen.getByRole('button', { name: /Last active/ }))
    expect(getRowOrder()).toEqual(['Bob Brown', 'Alice Adams', 'Cara Cole'])
  })

  it('toggles handbook write inline without opening the detail panel', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Practice Handbook write for Bob Brown' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/s/s1/members/u-bob',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ adminToolkitWrite: true }) })
      )
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the detail panel when a row is clicked', () => {
    renderPage()

    fireEvent.click(screen.getByText('Bob Brown'))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('bob@nhs.net')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('removes access via the panel with confirmation', async () => {
    renderPage()

    fireEvent.click(screen.getByText('Bob Brown'))
    const panel = screen.getByRole('dialog')
    fireEvent.click(within(panel).getByRole('button', { name: 'Remove access' }))

    expect(screen.getByText(/only their access to this/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/s/s1/members/u-bob', { method: 'DELETE' })
    )
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('shows a clear-filters empty state when nothing matches', () => {
    renderPage()

    fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), {
      target: { value: 'zzz-no-match' },
    })

    expect(screen.getByText('No members match your search or filters.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('Alice Adams')).toBeInTheDocument()
  })
})
