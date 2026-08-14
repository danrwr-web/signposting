/**
 * Prisma migrate deploy wrapper for CI/Vercel.
 *
 * Neon pooler URLs (often containing "-pooler.") are not suitable for migrations/advisory locks.
 * Use DIRECT_URL pointing at the non-pooler endpoint.
 *
 * This script also refuses to migrate the production database from a preview
 * build. That is not hypothetical: preview builds run `vercel-build`, which runs
 * this script against whatever DATABASE_URL the environment supplies, and tables
 * from unmerged branches have already reached the production database this way.
 */

const { spawnSync } = require('node:child_process')

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false, env: process.env })
  if (res.status !== 0) process.exit(res.status ?? 1)
}

function normaliseDbUrl(url) {
  if (!url) return url
  let u = String(url).trim()
  // Remove accidental wrapping quotes from env var UIs.
  u = u.replace(/^['"]|['"]$/g, '')
  // Reject obviously invalid values (e.g. pasted shell commands).
  if (/\s/.test(u)) return u
  // Prisma expects the "postgresql" scheme (not "postgres").
  if (u.startsWith('postgres://')) u = `postgresql://${u.slice('postgres://'.length)}`
  return u
}

/**
 * Hostname of a connection URL, or null when it cannot be parsed.
 * Only ever the host — connection strings carry credentials and must not be
 * logged or compared in full.
 */
function hostOf(url) {
  if (!url) return null
  try {
    return new URL(String(url).trim()).hostname.toLowerCase() || null
  } catch {
    return null
  }
}

/**
 * Environment variable names that carry a non-pooled connection string.
 *
 * DIRECT_URL is this project's own convention, but the Neon and Vercel Postgres
 * integrations inject their own names, and a preview branch provisioned by an
 * integration will not set DIRECT_URL. Falling back to the standard names means
 * preview branches migrate without anyone hand-copying values per environment.
 */
const DIRECT_URL_FALLBACKS = ['DIRECT_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING']

function resolveDirectUrl(env) {
  for (const name of DIRECT_URL_FALLBACKS) {
    const value = env[name]
    if (value && String(value).trim()) return { value: String(value), source: name }
  }
  return { value: '', source: null }
}

/**
 * Decide whether this build may run migrations.
 *
 * Fails closed on preview: if we cannot prove the target is NOT production, we
 * abort rather than migrate. A broken preview build is cheap; an unreviewed
 * migration on live practice data is not.
 */
function evaluateMigrationTarget({ vercelEnv, effectiveUrl, productionHost }) {
  // Local runs and CI (`npm run db:migrate:deploy`) have no VERCEL_ENV and keep
  // the previous behaviour — the operator chose the database deliberately.
  if (vercelEnv !== 'preview') {
    const targetHost = hostOf(effectiveUrl)
    const prodHost = productionHost ? productionHost.toLowerCase() : null
    if (vercelEnv === 'production' && prodHost && targetHost && targetHost !== prodHost) {
      return {
        action: 'run',
        warning:
          'This is a production build, but the database host does not match PRODUCTION_DB_HOST. ' +
          'Continuing, but check the environment variables are scoped as intended.',
      }
    }
    return { action: 'run' }
  }

  if (!productionHost) {
    return {
      action: 'abort',
      reason: [
        'ERROR: Refusing to run migrations from a preview build.',
        '',
        'PRODUCTION_DB_HOST is not set, so this script cannot tell whether the',
        'preview is pointed at its own database or at production.',
        '',
        'Set PRODUCTION_DB_HOST (the production database hostname only, no',
        'credentials) in the Vercel project for ALL environments. It is not a',
        'secret — it is the value this guard compares against.',
      ].join('\n'),
    }
  }

  const targetHost = hostOf(effectiveUrl)
  if (!targetHost) {
    return {
      action: 'abort',
      reason: [
        'ERROR: Refusing to run migrations from a preview build.',
        'The database URL could not be parsed, so its host cannot be compared',
        'against PRODUCTION_DB_HOST.',
      ].join('\n'),
    }
  }

  if (targetHost === productionHost.toLowerCase()) {
    return {
      action: 'abort',
      reason: [
        'ERROR: This preview build is pointed at the PRODUCTION database.',
        '',
        'Migrations have NOT been run, and this build is failing on purpose.',
        '',
        'Scope DATABASE_URL and DIRECT_URL to the Production environment only in',
        'the Vercel project, so preview deployments receive their own database',
        'branch instead of the live one.',
      ].join('\n'),
    }
  }

  return { action: 'run' }
}

function main() {
  const dbUrl = normaliseDbUrl(process.env.DATABASE_URL || '')
  const direct = resolveDirectUrl(process.env)
  const directUrl = normaliseDbUrl(direct.value)

  if (directUrl && /\s/.test(directUrl)) {
    console.error(
      [
        `ERROR: ${direct.source} contains whitespace.`,
        `Set ${direct.source} to the raw Postgres connection URL only (no \`psql ...\` prefix, no quotes, no newlines).`,
      ].join('\n')
    )
    process.exit(1)
  }

  if (!directUrl) {
    if (dbUrl.includes('-pooler.')) {
      console.error(
        [
          'ERROR: A direct (non-pooler) URL is required for migrations when using a pooler DATABASE_URL.',
          `Set one of ${DIRECT_URL_FALLBACKS.join(', ')} to the non-pooler Neon connection string.`,
        ].join('\n')
      )
      process.exit(1)
    }
    // If DATABASE_URL is already a direct connection, use it as-is.
    if (dbUrl) process.env.DATABASE_URL = dbUrl
  } else {
    // For migrations, force Prisma to use the direct URL by swapping DATABASE_URL for this command.
    if (direct.source !== 'DIRECT_URL') {
      console.log(`Using ${direct.source} as the direct connection for migrations.`)
    }
    process.env.DATABASE_URL = directUrl
  }

  // Validate DATABASE_URL scheme early with a safe error message (do not print secrets).
  const finalDb = process.env.DATABASE_URL || ''
  if (finalDb && !finalDb.startsWith('postgresql://')) {
    const scheme = String(finalDb).split(':')[0] || '(none)'
    console.error(
      [
        `ERROR: DATABASE_URL (effective for migrations) must start with "postgresql://".`,
        `Got scheme: "${scheme}".`,
        'If you copied a Neon connection string starting with "postgres://", re-save it (this script will normalise it).',
        'If your URL comes from a console UI, ensure it is not wrapped in quotes and contains no leading/trailing whitespace.',
      ].join('\n')
    )
    process.exit(1)
  }

  const decision = evaluateMigrationTarget({
    vercelEnv: process.env.VERCEL_ENV,
    effectiveUrl: finalDb,
    productionHost: process.env.PRODUCTION_DB_HOST,
  })

  if (decision.action === 'abort') {
    console.error(decision.reason)
    process.exit(1)
  }
  if (decision.warning) {
    console.warn(`WARNING: ${decision.warning}`)
  }

  // Be a bit more tolerant of concurrent deploys holding the advisory lock.
  process.env.PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT =
    process.env.PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT || '60000'

  run('npx', ['prisma', 'migrate', 'deploy'])
}

if (require.main === module) {
  main()
}

module.exports = {
  normaliseDbUrl,
  hostOf,
  resolveDirectUrl,
  evaluateMigrationTarget,
  DIRECT_URL_FALLBACKS,
}
