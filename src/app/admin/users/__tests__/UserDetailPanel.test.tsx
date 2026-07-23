import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import UserDetailPanel from '@/app/admin/users/UserDetailPanel'
import type { User } from '@/app/admin/users/types'

const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

jest.mock('react-hot-toast', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}))

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'alice',
    email: 'alice@example.com',
    name: 'Alice Adams',
    globalRole: 'USER',
    defaultSurgeryId: null,
    createdAt: new Date('2026-01-01'),
    isTestUser: false,
    symptomUsageLimit: null,
    symptomsUsed: 0,
    memberships: [{ id: 'm1', role: 'STANDARD', surgery: { id: 's1', name: 'Mount Pleasant Health Centre' } }],
    defaultSurgery: null,
    ...overrides,
  }
}

const surgeries = [
  { id: 's1', name: 'Mount Pleasant Health Centre' },
  { id: 's2', name: 'Ide Lane Surgery' },
]

const onClose = jest.fn()
const onRequestConfirm = jest.fn()

function renderPanel(user: User | null = makeUser()) {
  return render(
    <UserDetailPanel
      user={user}
      surgeries={surgeries}
      lastActive={null}
      onClose={onClose}
      onRequestConfirm={onRequestConfirm}
    />
  )
}

function lastFetchCall(): [string, RequestInit | undefined] {
  const calls = (global.fetch as jest.Mock).mock.calls
  return calls[calls.length - 1]
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  }) as jest.Mock
})

describe('UserDetailPanel', () => {
  it('renders nothing when no user is selected', () => {
    renderPanel(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('saves details with a PATCH including name, role and default surgery', async () => {
    renderPanel()

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alice A. Adams' } })
    fireEvent.change(screen.getByLabelText('Global Role'), { target: { value: 'SUPERUSER' } })
    fireEvent.change(screen.getByLabelText('Default Surgery'), { target: { value: 's1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    const [url, init] = lastFetchCall()
    expect(url).toBe('/api/admin/users/alice')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Alice A. Adams',
      globalRole: 'SUPERUSER',
      defaultSurgeryId: 's1',
    })
  })

  it('adds a surgery membership, offering only non-member surgeries', async () => {
    renderPanel()

    const surgerySelect = screen.getByLabelText('Add to surgery')
    // s1 is already a membership so only s2 should be offered
    expect(surgerySelect).not.toHaveTextContent('Mount Pleasant Health Centre')
    fireEvent.change(surgerySelect, { target: { value: 's2' } })
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'ADMIN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add membership' }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    const [url, init] = lastFetchCall()
    expect(url).toBe('/api/admin/users/alice/memberships')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ surgeryId: 's2', role: 'ADMIN' })
  })

  it('updates a membership role via PATCH', async () => {
    renderPanel()

    fireEvent.change(screen.getByLabelText('Role at Mount Pleasant Health Centre'), {
      target: { value: 'ADMIN' },
    })

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    const [url, init] = lastFetchCall()
    expect(url).toBe('/api/admin/users/alice/memberships/m1')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({ role: 'ADMIN' })
  })

  it('routes membership removal through onRequestConfirm', () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(onRequestConfirm).toHaveBeenCalledWith({
      type: 'remove-membership',
      userId: 'alice',
      membershipId: 'm1',
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows the test-user usage block only for test users', () => {
    const { unmount } = renderPanel()
    expect(screen.queryByText('Test user usage')).not.toBeInTheDocument()
    unmount()

    renderPanel(makeUser({ isTestUser: true, symptomsUsed: 7, symptomUsageLimit: 25 }))
    expect(screen.getByText('Test user usage')).toBeInTheDocument()
    expect(screen.getByText('7 / 25')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset usage count' }))
    expect(onRequestConfirm).toHaveBeenCalledWith({ type: 'reset-usage', userId: 'alice' })
  })

  it('resets the password via the inline security form', async () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'new-secret-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      const [url, init] = lastFetchCall()
      expect(url).toBe('/api/admin/users/alice/reset-password')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(init?.body as string)).toEqual({ newPassword: 'new-secret-1' })
    })
    // The inline form collapses again on success
    await waitFor(() =>
      expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument()
    )
  })

  it('routes delete through onRequestConfirm', () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Delete user' }))

    expect(onRequestConfirm).toHaveBeenCalledWith({
      type: 'delete-user',
      userId: 'alice',
      email: 'alice@example.com',
    })
  })
})
