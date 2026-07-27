import { render, screen } from '@testing-library/react'
import SurgerySelector from '@/components/SurgerySelector'

const mockUseSession = jest.fn()
const mockUseSurgery = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/s/imperial/admin/setup-checklist'
}))

jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession()
}))

jest.mock('@/context/SurgeryContext', () => ({
  useSurgery: () => mockUseSurgery()
}))

jest.mock('@/components/GroupedSurgeryOptions', () => function MockGroupedSurgeryOptions({ surgeries }: { surgeries: Array<{ id: string; name: string }> }) {
  return (
    <>
      {surgeries.map(s => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </>
  )
})

const surgeries = [
  { id: 'imperial', slug: 'imperial', name: 'Imperial Medical Practice' },
  { id: 'stpeters', slug: 'stpeters', name: "St Peter's Practice" }
]

describe('SurgerySelector current surgery precedence', () => {
  it('prefers the URL-derived currentSurgeryId prop over a stale context surgery', () => {
    mockUseSession.mockReturnValue({ data: { user: { globalRole: 'SUPERUSER', memberships: [] } } })
    mockUseSurgery.mockReturnValue({
      surgery: { id: 'stpeters', slug: 'stpeters', name: "St Peter's Practice" },
      clearSurgery: jest.fn()
    })

    render(<SurgerySelector surgeries={surgeries} currentSurgeryId="imperial" />)

    expect(screen.getByLabelText('Change surgery')).toHaveValue('imperial')
  })

  it('falls back to the context surgery when no prop is provided', () => {
    mockUseSession.mockReturnValue({ data: { user: { globalRole: 'SUPERUSER', memberships: [] } } })
    mockUseSurgery.mockReturnValue({
      surgery: { id: 'stpeters', slug: 'stpeters', name: "St Peter's Practice" },
      clearSurgery: jest.fn()
    })

    render(<SurgerySelector surgeries={surgeries} />)

    expect(screen.getByLabelText('Change surgery')).toHaveValue('stpeters')
  })

  it('shows the prop-selected surgery name for non-superusers', () => {
    mockUseSession.mockReturnValue({ data: { user: { globalRole: 'USER', memberships: [] } } })
    mockUseSurgery.mockReturnValue({
      surgery: { id: 'stpeters', slug: 'stpeters', name: "St Peter's Practice" },
      clearSurgery: jest.fn()
    })

    render(<SurgerySelector surgeries={surgeries} currentSurgeryId="imperial" />)

    expect(screen.getByText('Imperial Medical Practice')).toBeInTheDocument()
  })
})
