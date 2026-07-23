import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import MemberDetailPanel from '@/app/s/[id]/admin/users/MemberDetailPanel'
import type { Membership } from '@/app/s/[id]/admin/users/types'

const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

jest.mock('react-hot-toast', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}))

function makeMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'm-bob',
    role: 'STANDARD',
    adminToolkitWrite: false,
    user: {
      id: 'u-bob',
      email: 'bob@nhs.net',
      name: 'Bob Brown',
      defaultSurgeryId: null,
    },
    ...overrides,
  }
}

const onClose = jest.fn()
const onRequestConfirm = jest.fn()

function renderPanel(membership: Membership | null = makeMembership(), handbookEnabled = true) {
  return render(
    <MemberDetailPanel
      membership={membership}
      surgeryId="s1"
      surgeryName="Mount Pleasant Health Centre"
      handbookEnabled={handbookEnabled}
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

describe('MemberDetailPanel', () => {
  it('renders nothing when no member is selected', () => {
    renderPanel(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('saves details with a PATCH including name and role', async () => {
    renderPanel()

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Robert Brown' } })
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'ADMIN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    const [url, init] = lastFetchCall()
    expect(url).toBe('/api/s/s1/members/u-bob')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'Robert Brown', role: 'ADMIN' })
  })

  it('toggles handbook write access via PATCH', async () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Practice Handbook write for Bob Brown' }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    const [url, init] = lastFetchCall()
    expect(url).toBe('/api/s/s1/members/u-bob')
    expect(JSON.parse(init?.body as string)).toEqual({ adminToolkitWrite: true })
  })

  it('disables the handbook toggle for practice admins', () => {
    renderPanel(makeMembership({ role: 'ADMIN' }))

    expect(
      screen.getByRole('button', { name: 'Toggle Practice Handbook write for Bob Brown' })
    ).toBeDisabled()
    expect(screen.getByText('Practice admins can always edit.')).toBeInTheDocument()
  })

  it('hides the permissions section when the handbook feature is disabled', () => {
    renderPanel(makeMembership(), false)

    expect(screen.queryByText('Permissions')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Toggle Practice Handbook write for Bob Brown' })
    ).not.toBeInTheDocument()
  })

  it('sets the default surgery via PATCH', async () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Set as default surgery' }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    const [url, init] = lastFetchCall()
    expect(url).toBe('/api/s/s1/members/u-bob')
    expect(JSON.parse(init?.body as string)).toEqual({ setAsDefault: true })
  })

  it('shows static text instead of the button when already the default surgery', () => {
    renderPanel(makeMembership({ user: { id: 'u-bob', email: 'bob@nhs.net', name: 'Bob Brown', defaultSurgeryId: 's1' } }))

    expect(screen.queryByRole('button', { name: 'Set as default surgery' })).not.toBeInTheDocument()
    expect(screen.getByText(/default surgery — they land here/)).toBeInTheDocument()
  })

  it('resets the password via the inline security form', async () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'new-secret-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      const [url, init] = lastFetchCall()
      expect(url).toBe('/api/s/s1/members/u-bob/reset-password')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(init?.body as string)).toEqual({ newPassword: 'new-secret-1' })
    })
    await waitFor(() =>
      expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument()
    )
  })

  it('routes remove-access through onRequestConfirm', () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Remove access' }))

    expect(onRequestConfirm).toHaveBeenCalledWith({
      type: 'remove-access',
      userId: 'u-bob',
      email: 'bob@nhs.net',
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
