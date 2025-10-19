import { render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { SurgeryProvider, useSurgery } from '@/context/SurgeryContext'

// Mock next-auth
jest.mock('next-auth/react')
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}))

describe('SurgeryContext', () => {
  const mockSession = {
    user: {
      id: '1',
      email: 'admin@example.com',
      globalRole: 'USER',
      defaultSurgeryId: 'surgery1',
      memberships: [
        { surgeryId: 'surgery1', role: 'ADMIN' },
        { surgeryId: 'surgery2', role: 'STANDARD' }
      ]
    }
  }

  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: { ...mockSession, expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
      status: 'authenticated',
      update: jest.fn(),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should provide surgery context with correct values', async () => {
    const TestComponent = () => {
      const { surgery, availableSurgeries, canManageSurgery, isSuperuser } = useSurgery()
      
      return (
        <div>
          <div data-testid="surgery-name">{surgery?.name || 'No surgery'}</div>
          <div data-testid="available-count">{availableSurgeries.length}</div>
          <div data-testid="can-manage-surgery1">{canManageSurgery('surgery1').toString()}</div>
          <div data-testid="can-manage-surgery2">{canManageSurgery('surgery2').toString()}</div>
          <div data-testid="is-superuser">{isSuperuser.toString()}</div>
        </div>
      )
    }

    const availableSurgeries = [
      { id: 'surgery1', name: 'Test Surgery 1' },
      { id: 'surgery2', name: 'Test Surgery 2' }
    ]

    render(
      <SurgeryProvider 
        initialSurgery={null} 
        availableSurgeries={availableSurgeries}
      >
        <TestComponent />
      </SurgeryProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('available-count').textContent).toBe('2')
      expect(screen.getByTestId('can-manage-surgery1').textContent).toBe('true')
      expect(screen.getByTestId('can-manage-surgery2').textContent).toBe('false')
      expect(screen.getByTestId('is-superuser').textContent).toBe('false')
    })
  })

  it('should handle superuser correctly', async () => {
    const superuserSession = {
      user: {
        id: '1',
        email: 'superuser@example.com',
        globalRole: 'SUPERUSER',
        defaultSurgeryId: 'surgery1',
        memberships: []
      }
    }

    mockUseSession.mockReturnValue({
      data: { ...superuserSession, expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
      status: 'authenticated',
      update: jest.fn(),
    })

    const TestComponent = () => {
      const { canManageSurgery, isSuperuser } = useSurgery()
      
      return (
        <div>
          <div data-testid="can-manage-any">{canManageSurgery('any-surgery').toString()}</div>
          <div data-testid="is-superuser">{isSuperuser.toString()}</div>
        </div>
      )
    }

    const availableSurgeries = [
      { id: 'surgery1', name: 'Test Surgery 1' }
    ]

    render(
      <SurgeryProvider 
        initialSurgery={null} 
        availableSurgeries={availableSurgeries}
      >
        <TestComponent />
      </SurgeryProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('can-manage-any').textContent).toBe('true')
      expect(screen.getByTestId('is-superuser').textContent).toBe('true')
    })
  })
})