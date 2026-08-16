import {
  deploymentDatabaseLabel,
  deploymentEnvironment,
  describeDeployment,
  isProductionDeployment,
} from '../environment'

const ENV_KEYS = [
  'VERCEL_ENV',
  'NEXT_PUBLIC_VERCEL_ENV',
  'VERCEL_GIT_COMMIT_REF',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF',
  'DATABASE_URL',
] as const

describe('deploymentEnvironment', () => {
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

  it.each(['production', 'preview'] as const)('reports %s from VERCEL_ENV', value => {
    process.env.VERCEL_ENV = value
    expect(deploymentEnvironment()).toBe(value)
  })

  it('reports development when VERCEL_ENV is absent', () => {
    expect(deploymentEnvironment()).toBe('development')
    expect(isProductionDeployment()).toBe(false)
  })

  it('treats an unrecognised value as non-production, not as production', () => {
    // The asymmetry that matters: a wrong "production" hides the banner on a
    // preview, which is the failure this module exists to prevent. A wrong
    // "development" only shows a banner where it is not needed.
    process.env.VERCEL_ENV = 'staging'
    expect(deploymentEnvironment()).toBe('development')
    expect(isProductionDeployment()).toBe(false)
  })

  it('falls back to the public variable so client components can ask too', () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
    expect(deploymentEnvironment()).toBe('preview')
  })

  it('prefers the server variable when both are set', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
    expect(deploymentEnvironment()).toBe('production')
  })

  it('does not consult NODE_ENV', () => {
    // NODE_ENV is 'production' for preview builds on Vercel, which is exactly
    // why every guard that used it could not tell the two apart.
    const previous = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
    expect(deploymentEnvironment()).toBe('development')
    Object.defineProperty(process.env, 'NODE_ENV', { value: previous, configurable: true })
  })
})

describe('deploymentDatabaseLabel', () => {
  it('returns the Neon endpoint id', () => {
    expect(
      deploymentDatabaseLabel('postgresql://u:p@ep-cool-mud-a1b2c3d4.eu-west-2.aws.neon.tech/db')
    ).toBe('ep-cool-mud-a1b2c3d4')
  })

  it('treats the pooled and direct endpoints of a branch as one database', () => {
    const pooled = deploymentDatabaseLabel(
      'postgresql://u:p@ep-cool-mud-a1b2c3d4-pooler.eu-west-2.aws.neon.tech/db'
    )
    const direct = deploymentDatabaseLabel(
      'postgresql://u:p@ep-cool-mud-a1b2c3d4.eu-west-2.aws.neon.tech/db'
    )
    expect(pooled).toBe(direct)
  })

  it('distinguishes two branches of the same project', () => {
    const a = deploymentDatabaseLabel('postgresql://u:p@ep-aaa-111.eu-west-2.aws.neon.tech/db')
    const b = deploymentDatabaseLabel('postgresql://u:p@ep-bbb-222.eu-west-2.aws.neon.tech/db')
    expect(a).not.toBe(b)
  })

  it('never returns credentials, the database name or the query string', () => {
    const label = deploymentDatabaseLabel(
      'postgresql://admin:sup3rs3cret@ep-cool-mud-a1b2c3d4.eu-west-2.aws.neon.tech/prod?sslmode=require'
    )
    expect(label).toBe('ep-cool-mud-a1b2c3d4')
    expect(label).not.toContain('sup3rs3cret')
    expect(label).not.toContain('admin')
    expect(label).not.toContain('prod')
  })

  it('returns null rather than guessing when the URL is unusable', () => {
    expect(deploymentDatabaseLabel('not a url')).toBeNull()
    expect(deploymentDatabaseLabel('')).toBeNull()
  })
})

describe('describeDeployment', () => {
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

  it('collects the environment, branch and database', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_GIT_COMMIT_REF = 'claude/some-feature'
    process.env.DATABASE_URL =
      'postgresql://u:p@ep-cool-mud-a1b2c3d4-pooler.eu-west-2.aws.neon.tech/db'

    expect(describeDeployment()).toEqual({
      environment: 'preview',
      gitBranch: 'claude/some-feature',
      database: 'ep-cool-mud-a1b2c3d4',
    })
  })

  it('reports nulls rather than failing when the platform tells it nothing', () => {
    expect(describeDeployment()).toEqual({
      environment: 'development',
      gitBranch: null,
      database: null,
    })
  })
})
