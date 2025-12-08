import { render, screen } from '@testing-library/react'
import AdminDashboardClient from '@/app/admin/AdminDashboardClient'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === 'string' ? href : ''} {...props}>
      {children}
    </a>
  )
}))

jest.mock('next-auth/react', () => ({
  signOut: jest.fn()
}))

jest.mock('react-hot-toast', () => {
  const toast = (..._args: any[]) => {}
  ;(toast as any).error = jest.fn()
  ;(toast as any).success = jest.fn()
  return { toast }
})

const baseUser = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Admin User',
  globalRole: 'USER',
  defaultSurgeryId: 's1',
  isTestUser: false,
  symptomUsageLimit: null,
  symptomsUsed: 0,
  memberships: [{ surgeryId: 's1', role: 'ADMIN' }]
}

const baseSurgeries = [
  {
    id: 's1',
    name: 'Test Surgery',
    slug: 'test-surgery',
    address: '1 Test St',
    postcode: 'TST 1AA',
    phoneNumber: '01234 567890',
    createdAt: new Date(),
    updatedAt: new Date()
  }
] as any

describe('AdminDashboardClient documentation tab', () => {
  it('shows Documentation tab for admins and superusers', () => {
    render(
      <AdminDashboardClient
        user={baseUser as any}
        surgeries={baseSurgeries}
        symptoms={[] as any}
        isSuperuser={false}
      />
    )

    const docsLink = screen.getByRole('link', { name: 'Documentation' })
    expect(docsLink).toBeInTheDocument()
    expect(docsLink).toHaveAttribute('href', 'https://docs.signpostingtool.co.uk/')
    expect(docsLink).toHaveAttribute('target', '_blank')
    expect(docsLink).toHaveAttribute('rel', 'noreferrer noopener')
  })

  it('hides Documentation tab when user lacks admin access', () => {
    render(
      <AdminDashboardClient
        user={{ ...baseUser, memberships: [], globalRole: 'USER' } as any}
        surgeries={baseSurgeries}
        symptoms={[] as any}
        isSuperuser={false}
      />
    )

    expect(screen.queryByRole('link', { name: 'Documentation' })).not.toBeInTheDocument()
  })
})

