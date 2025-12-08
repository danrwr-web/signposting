import { render, screen } from '@testing-library/react'
import CompactToolbar from '@/components/CompactToolbar'

const mockUseSession = jest.fn()
const mockUseSurgery = jest.fn()

jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signOut: jest.fn()
}))

jest.mock('@/context/SurgeryContext', () => ({
  useSurgery: () => mockUseSurgery()
}))

jest.mock('@/components/SurgerySelector', () => () => <div data-testid="surgery-selector" />)
jest.mock('@/components/SurgeryFiltersHeader', () => () => <div data-testid="filters-header" />)
jest.mock('@/components/UserPreferencesModal', () => () => <div data-testid="preferences-modal" />)
jest.mock('@/components/LogoSizeControl', () => () => <div data-testid="logo-size-control" />)

const baseProps = {
  surgeries: [],
  currentSurgeryId: 's1',
  searchTerm: '',
  onSearchChange: jest.fn(),
  selectedLetter: 'All' as const,
  onLetterChange: jest.fn(),
  selectedAge: 'All' as const,
  onAgeChange: jest.fn(),
  resultsCount: 0,
  totalCount: 0,
  showSurgerySelector: false,
  onShowSurgerySelector: jest.fn()
}

const renderToolbar = (sessionData: any) => {
  mockUseSession.mockReturnValue({ data: sessionData })
  mockUseSurgery.mockReturnValue({ surgery: { id: 's1', name: 'Test Surgery' } })

  render(<CompactToolbar {...baseProps} />)
}

describe('CompactToolbar documentation link', () => {
  it('shows Docs link for admins or superusers', () => {
    renderToolbar({
      user: { globalRole: 'SUPERUSER', memberships: [{ surgeryId: 's1', role: 'ADMIN' }] }
    })

    const docsLink = screen.getByRole('link', { name: 'Docs' })
    expect(docsLink).toBeInTheDocument()
    expect(docsLink).toHaveAttribute('href', 'https://docs.signpostingtool.co.uk/')
    expect(docsLink).toHaveAttribute('target', '_blank')
    expect(docsLink).toHaveAttribute('rel', 'noreferrer noopener')
  })

  it('hides Docs link for standard users', () => {
    renderToolbar({
      user: { globalRole: 'USER', memberships: [] }
    })

    expect(screen.queryByRole('link', { name: 'Docs' })).not.toBeInTheDocument()
  })
})

