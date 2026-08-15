import { render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { SurgeryProvider, useSurgery } from '@/context/SurgeryContext'
import SurgeryContextSync from '@/components/SurgeryContextSync'

jest.mock('next-auth/react')
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

// Stable instances: the provider's mount effect depends on these, so fresh
// objects per render would re-run it every render.
const stableSearchParams = new URLSearchParams()
let mockPathname = '/s/surgery1'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => mockPathname,
  useSearchParams: () => stableSearchParams,
}))

function SurgeryProbe() {
  const { surgery } = useSurgery()
  return (
    <div>
      <div data-testid="surgery-id">{surgery?.id ?? 'none'}</div>
      <div data-testid="surgery-name">{surgery?.name ?? 'none'}</div>
    </div>
  )
}

describe('SurgeryContext with a stale availableSurgeries list', () => {
  beforeEach(() => {
    mockPathname = '/s/surgery1'
    window.localStorage.clear()
    document.cookie = 'surgery=; Path=/; Max-Age=0'
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: '1',
          email: 'user@example.com',
          globalRole: 'USER',
          defaultSurgeryId: 'surgery1',
          memberships: [{ surgeryId: 'surgery1', role: 'ADMIN' }],
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any,
      status: 'authenticated',
      update: jest.fn(),
    })
  })

  it('keeps the path id but never persists the nameless placeholder', async () => {
    // The root layout rendered before sign-in: empty list, no initial surgery.
    render(
      <SurgeryProvider initialSurgery={null} availableSurgeries={[]}>
        <SurgeryProbe />
      </SurgeryProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('surgery-id').textContent).toBe('surgery1')
    })
    // The placeholder may live in state, but must not poison localStorage.
    expect(window.localStorage.getItem('surgery_state')).toBeNull()
  })

  it('does not downgrade an already-named surgery when the list misses', async () => {
    render(
      <SurgeryProvider
        initialSurgery={{ id: 'surgery1', slug: 'ide-lane', name: 'Ide Lane Surgery' }}
        availableSurgeries={[]}
      >
        <SurgeryProbe />
      </SurgeryProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('surgery-name').textContent).toBe('Ide Lane Surgery')
    })
    expect(window.localStorage.getItem('surgery_state')).toBeNull()
  })

  it('SurgeryContextSync upgrades the placeholder with the server-resolved surgery', async () => {
    render(
      <SurgeryProvider initialSurgery={null} availableSurgeries={[]}>
        <SurgeryContextSync
          surgery={{ id: 'surgery1', slug: 'ide-lane', name: 'Ide Lane Surgery' }}
        />
        <SurgeryProbe />
      </SurgeryProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('surgery-name').textContent).toBe('Ide Lane Surgery')
    })
    expect(JSON.parse(window.localStorage.getItem('surgery_state') ?? 'null')).toEqual({
      id: 'surgery1',
      slug: 'ide-lane',
      name: 'Ide Lane Surgery',
    })
  })

  it('still resolves the name from availableSurgeries when present', async () => {
    render(
      <SurgeryProvider
        initialSurgery={null}
        availableSurgeries={[{ id: 'surgery1', slug: 'ide-lane', name: 'Ide Lane Surgery' }]}
      >
        <SurgeryProbe />
      </SurgeryProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('surgery-name').textContent).toBe('Ide Lane Surgery')
    })
    expect(JSON.parse(window.localStorage.getItem('surgery_state') ?? 'null')).toEqual({
      id: 'surgery1',
      slug: 'ide-lane',
      name: 'Ide Lane Surgery',
    })
  })
})
