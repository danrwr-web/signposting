import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import GlobalUsersClient from '@/app/admin/users/GlobalUsersClient'
import type { User } from '@/app/admin/users/types'

const mockRefresh = jest.fn()

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === 'string' ? href : ''} {...props}>
      {children}
    </a>
  ),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

jest.mock('react-hot-toast', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}))

jest.mock('@/components/NavigationPanelTrigger', () => ({
  __esModule: true,
  default: () => <div data-testid="nav-trigger" />,
}))

jest.mock('@/components/LogoSizeControl', () => ({
  __esModule: true,
  default: () => <div data-testid="logo-size" />,
}))

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function makeUser(overrides: Partial<User> & { id: string }): User {
  return {
    email: `${overrides.id}@example.com`,
    name: null,
    globalRole: 'USER',
    defaultSurgeryId: null,
    createdAt: new Date('2026-01-01'),
    isTestUser: false,
    symptomUsageLimit: null,
    symptomsUsed: 0,
    memberships: [],
    defaultSurgery: null,
    ...overrides,
  }
}

const users: User[] = [
  makeUser({
    id: 'alice',
    name: 'Alice Adams',
    memberships: [{ id: 'm1', role: 'ADMIN', surgery: { id: 's1', name: 'Mount Pleasant Health Centre' } }],
  }),
  makeUser({ id: 'bob', name: 'Bob Brown', globalRole: 'SUPERUSER' }),
  makeUser({ id: 'cara', name: 'Cara Cole' }),
]

const surgeries = [
  { id: 's1', name: 'Mount Pleasant Health Centre' },
  { id: 's2', name: 'Ide Lane Surgery' },
]

const lastActiveData: Record<string, string | null> = {
  alice: daysAgo(2),
  bob: daysAgo(45),
  cara: null,
}

function renderPage() {
  return render(<GlobalUsersClient users={users} surgeries={surgeries} lastActiveData={lastActiveData} />)
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

describe('GlobalUsersClient', () => {
  it('renders summary stats computed from the full user list', () => {
    renderPage()

    // Filter chips reuse some stat labels, so find the tile that holds a value
    const statFor = (label: string) => {
      const tile = screen
        .getAllByText(label)
        .map((el) => el.parentElement as HTMLElement)
        .find((parent) => within(parent).queryByText(/^\d+$/))
      return tile ? within(tile).getByText(/^\d+$/).textContent : null
    }

    expect(statFor('Total users')).toBe('3')
    expect(statFor('System admins')).toBe('1')
    expect(statFor('Active last 30 days')).toBe('1')
    expect(statFor('Never signed in')).toBe('1')
  })

  it('badges system admins only — regular users get no role badge', () => {
    renderPage()

    expect(screen.getByText('System admin')).toBeInTheDocument()
    // "User" appears only as the sortable column header, not as row badges
    const userTexts = screen.getAllByText('User')
    expect(userTexts).toHaveLength(1)
    expect(userTexts[0].closest('th')).not.toBeNull()
  })

  it('shows "Never" for users with no activity', () => {
    renderPage()
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('filters rows when searching by surgery name', () => {
    renderPage()

    fireEvent.change(screen.getByPlaceholderText('Search by name, email or surgery…'), {
      target: { value: 'mount pleasant' },
    })

    expect(screen.getByText('Alice Adams')).toBeInTheDocument()
    expect(screen.queryByText('Bob Brown')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 1 of 3 users')).toBeInTheDocument()
  })

  it('filters rows with the System admins chip', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'System admins' }))

    expect(screen.getByText('Bob Brown')).toBeInTheDocument()
    expect(screen.queryByText('Alice Adams')).not.toBeInTheDocument()
  })

  it('shows a clear-filters empty state when nothing matches', () => {
    renderPage()

    fireEvent.change(screen.getByPlaceholderText('Search by name, email or surgery…'), {
      target: { value: 'zzz-no-match' },
    })

    expect(screen.getByText('No users match your search or filters.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('Alice Adams')).toBeInTheDocument()
  })

  it('re-sorts by last active when the header is clicked', () => {
    renderPage()

    // Default: alphabetical
    expect(getRowOrder()).toEqual(['Alice Adams', 'Bob Brown', 'Cara Cole'])

    fireEvent.click(screen.getByRole('button', { name: /Last active/ }))

    // Desc: most recent first, never-active last
    expect(getRowOrder()).toEqual(['Alice Adams', 'Bob Brown', 'Cara Cole'])

    fireEvent.click(screen.getByRole('button', { name: /Last active/ }))

    // Asc: oldest first, never-active still last
    expect(getRowOrder()).toEqual(['Bob Brown', 'Alice Adams', 'Cara Cole'])
  })

  it('opens the detail panel when a row is clicked', () => {
    renderPage()

    fireEvent.click(screen.getByText('Alice Adams'))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('alice@example.com')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('deletes a user via the panel danger zone with confirmation', async () => {
    renderPage()

    fireEvent.click(screen.getByText('Cara Cole'))
    const panel = screen.getByRole('dialog')
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete user' }))

    // ConfirmDialog stacks above the panel
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument()
    const confirmButtons = screen.getAllByRole('button', { name: 'Delete user' })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/users/cara', { method: 'DELETE' })
    )
    expect(mockRefresh).toHaveBeenCalled()
  })
})
