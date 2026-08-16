import { render, screen } from '@testing-library/react'
import DeploymentEnvironmentBanner from '../DeploymentEnvironmentBanner'

const ENV_KEYS = ['VERCEL_ENV', 'NEXT_PUBLIC_VERCEL_ENV', 'VERCEL_GIT_COMMIT_REF', 'DATABASE_URL'] as const

describe('DeploymentEnvironmentBanner', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  it('renders nothing on production', () => {
    process.env.VERCEL_ENV = 'production'
    const { container } = render(<DeploymentEnvironmentBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names the environment, branch and database on a preview', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_GIT_COMMIT_REF = 'claude/some-feature'
    process.env.DATABASE_URL =
      'postgresql://u:p@ep-cool-mud-a1b2c3d4-pooler.eu-west-2.aws.neon.tech/db'

    render(<DeploymentEnvironmentBanner />)

    expect(screen.getByText('Preview')).toBeInTheDocument()
    expect(screen.getByText('This is not the live site.')).toBeInTheDocument()
    expect(screen.getByText('claude/some-feature')).toBeInTheDocument()
    expect(screen.getByText('ep-cool-mud-a1b2c3d4')).toBeInTheDocument()
  })

  it('never puts the connection string in the markup', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.DATABASE_URL =
      'postgresql://admin:sup3rs3cret@ep-cool-mud-a1b2c3d4.eu-west-2.aws.neon.tech/db'

    const { container } = render(<DeploymentEnvironmentBanner />)

    expect(container.innerHTML).not.toContain('sup3rs3cret')
    expect(container.innerHTML).not.toContain('postgresql://')
  })

  it('still shows when the platform reports nothing but the environment', () => {
    // A misconfigured deployment is the one that most needs the banner, so a
    // missing branch or database must not suppress it.
    process.env.VERCEL_ENV = 'preview'

    render(<DeploymentEnvironmentBanner />)

    expect(screen.getByText('This is not the live site.')).toBeInTheDocument()
  })

  it('shows on a deployment that cannot name its environment', () => {
    render(<DeploymentEnvironmentBanner />)
    expect(screen.getByText('Local')).toBeInTheDocument()
  })
})
