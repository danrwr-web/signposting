/**
 * The guard that stops a preview build migrating the production database.
 *
 * This is not a theoretical protection: tables from unmerged branches reached
 * the production database because `vercel-build` runs `prisma migrate deploy`
 * against whatever DATABASE_URL the environment supplies, preview included.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  normaliseDbUrl,
  hostOf,
  resolveDirectUrl,
  evaluateMigrationTarget,
} = require('../prisma-migrate-deploy.js')

const PROD_HOST = 'ep-prod-main-123456.eu-west-2.aws.neon.tech'
const PREVIEW_HOST = 'ep-preview-branch-999999.eu-west-2.aws.neon.tech'

const url = (host: string) => `postgresql://user:secret@${host}/neondb?sslmode=require`

describe('evaluateMigrationTarget — preview builds', () => {
  it('aborts when a preview points at the production host', () => {
    const result = evaluateMigrationTarget({
      vercelEnv: 'preview',
      effectiveUrl: url(PROD_HOST),
      productionHost: PROD_HOST,
    })

    expect(result.action).toBe('abort')
    expect(result.reason).toContain('pointed at the PRODUCTION database')
  })

  it('runs when a preview points at its own branch', () => {
    const result = evaluateMigrationTarget({
      vercelEnv: 'preview',
      effectiveUrl: url(PREVIEW_HOST),
      productionHost: PROD_HOST,
    })

    // Isolated preview branches DO need migrating, or a PR adding a migration
    // would deploy against a schema that lacks it.
    expect(result.action).toBe('run')
  })

  it('fails closed when PRODUCTION_DB_HOST is not configured', () => {
    // Cannot prove the target is not production, so refuse.
    const result = evaluateMigrationTarget({
      vercelEnv: 'preview',
      effectiveUrl: url(PREVIEW_HOST),
      productionHost: undefined,
    })

    expect(result.action).toBe('abort')
    expect(result.reason).toContain('PRODUCTION_DB_HOST is not set')
  })

  it('fails closed when the URL cannot be parsed', () => {
    const result = evaluateMigrationTarget({
      vercelEnv: 'preview',
      effectiveUrl: 'not-a-url',
      productionHost: PROD_HOST,
    })

    expect(result.action).toBe('abort')
  })

  it('compares hosts case-insensitively', () => {
    const result = evaluateMigrationTarget({
      vercelEnv: 'preview',
      effectiveUrl: url(PROD_HOST.toUpperCase()),
      productionHost: PROD_HOST,
    })

    expect(result.action).toBe('abort')
  })

  it('ignores credentials, port and database name when comparing', () => {
    const result = evaluateMigrationTarget({
      vercelEnv: 'preview',
      effectiveUrl: `postgresql://someone-else:different@${PROD_HOST}:5432/other_db`,
      productionHost: PROD_HOST,
    })

    expect(result.action).toBe('abort')
  })
})

describe('evaluateMigrationTarget — other environments', () => {
  it('runs on production', () => {
    const result = evaluateMigrationTarget({
      vercelEnv: 'production',
      effectiveUrl: url(PROD_HOST),
      productionHost: PROD_HOST,
    })

    expect(result.action).toBe('run')
    expect(result.warning).toBeUndefined()
  })

  it('warns but still runs when a production build targets an unexpected host', () => {
    // The reverse misconfiguration. Worth surfacing, but not worth blocking a
    // production deploy over — the host may legitimately have changed.
    const result = evaluateMigrationTarget({
      vercelEnv: 'production',
      effectiveUrl: url(PREVIEW_HOST),
      productionHost: PROD_HOST,
    })

    expect(result.action).toBe('run')
    expect(result.warning).toContain('does not match PRODUCTION_DB_HOST')
  })

  it('runs locally and in CI, where VERCEL_ENV is unset', () => {
    // `npm run db:migrate:deploy` — the operator picked the database.
    const result = evaluateMigrationTarget({
      vercelEnv: undefined,
      effectiveUrl: url(PROD_HOST),
      productionHost: PROD_HOST,
    })

    expect(result.action).toBe('run')
  })
})

describe('resolveDirectUrl', () => {
  it('prefers this project’s own DIRECT_URL', () => {
    expect(
      resolveDirectUrl({ DIRECT_URL: url(PROD_HOST), DATABASE_URL_UNPOOLED: url(PREVIEW_HOST) })
    ).toMatchObject({ source: 'DIRECT_URL' })
  })

  it('falls back to the names the Neon and Vercel integrations inject', () => {
    // A preview branch provisioned by an integration will not set DIRECT_URL.
    expect(resolveDirectUrl({ DATABASE_URL_UNPOOLED: url(PREVIEW_HOST) })).toMatchObject({
      source: 'DATABASE_URL_UNPOOLED',
    })
    expect(resolveDirectUrl({ POSTGRES_URL_NON_POOLING: url(PREVIEW_HOST) })).toMatchObject({
      source: 'POSTGRES_URL_NON_POOLING',
    })
  })

  it('ignores blank values', () => {
    expect(resolveDirectUrl({ DIRECT_URL: '   ', DATABASE_URL_UNPOOLED: url(PREVIEW_HOST) })).toMatchObject(
      { source: 'DATABASE_URL_UNPOOLED' }
    )
    expect(resolveDirectUrl({})).toMatchObject({ source: null, value: '' })
  })
})

describe('hostOf / normaliseDbUrl', () => {
  it('extracts the host without credentials', () => {
    expect(hostOf(url(PROD_HOST))).toBe(PROD_HOST)
  })

  it('returns null for unparseable input rather than throwing', () => {
    for (const value of ['', 'psql "postgres://x"', undefined, null]) {
      expect(hostOf(value)).toBeNull()
    }
  })

  it('normalises the postgres:// scheme Prisma rejects', () => {
    expect(normaliseDbUrl('postgres://u:p@host/db')).toBe('postgresql://u:p@host/db')
  })

  it('strips quotes pasted from env var UIs', () => {
    expect(normaliseDbUrl('"postgresql://u:p@host/db"')).toBe('postgresql://u:p@host/db')
  })
})
