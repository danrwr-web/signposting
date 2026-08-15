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
    return normaliseHost(new URL(String(url).trim()).hostname)
  } catch {
    return null
  }
}

/**
 * Canonical form of a database hostname.
 *
 * Neon serves the same database on two hostnames: a direct endpoint, and a
 * pooled one with "-pooler" appended to the endpoint id. This guard compares
 * the *migration* URL, which is the direct form — so if PRODUCTION_DB_HOST were
 * set to the pooled hostname (the obvious thing to copy, since it is what
 * DATABASE_URL usually contains) the comparison would never match and the guard
 * would fail OPEN, silently permitting exactly what it exists to prevent.
 *
 * Collapsing both forms to one means either value works.
 */
function normaliseHost(host) {
  if (!host) return null
  let value = String(host).trim().toLowerCase()
  if (!value) return null

  // Tolerate a whole connection string pasted where a hostname was asked for.
  // Extracting the host is safer than comparing the raw value: a value that can
  // never match is a guard that never fires.
  if (value.includes('://') || value.includes('@') || value.includes('/')) {
    try {
      value = new URL(value.includes('://') ? value : `postgresql://${value}`).hostname
    } catch {
      return null
    }
  }

  value = value.replace(/:\d+$/, '').replace(/-pooler(?=\.)/, '')

  // Anything that is not a hostname is treated as unreadable rather than passed
  // through. A value like "ep-prod.example (production)" is non-empty, so it
  // would satisfy a null check, but can never equal a real host — leaving a
  // guard that is configured, silent, and completely inert.
  if (value.length > MAX_HOSTNAME_LENGTH) return null
  if (!HOSTNAME_RE.test(value)) return null

  return value || null
}

// Full RFC 1123 hostname syntax: each dot-separated label is 1-63 characters,
// alphanumeric at both ends with hyphens only inside, and the whole name is at
// most 253. Validating the string as a whole instead would accept
// "ep-prod..example.com", "ep-prod-.example.com" and over-length labels —
// strings that can never name a real host, so treating them as readable leaves
// the guard configured and inert.
//
// This is the boundary of what validation can do. A well-formed but WRONG value
// (a decommissioned branch's hostname, a transposed character that still parses)
// is indistinguishable from a correct one here, and no syntax check will ever
// catch it. What establishes the guard works is watching it fire.
const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
const HOSTNAME_RE = new RegExp(`^${LABEL}(?:\\.${LABEL})*$`)
const MAX_HOSTNAME_LENGTH = 253

// Named hosts only. There is deliberately no IPv6 literal case: Neon and Vercel
// address databases by hostname, so an accepted bracketed literal would be
// something this guard never actually meets — and a hand-rolled matcher for one
// is easy to get subtly wrong, which here means accepting a malformed literal
// that can never equal the real target and failing OPEN. A literal is treated
// as unreadable instead, which aborts a preview build rather than waving it
// through.

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
function evaluateMigrationTarget({ vercelEnv, effectiveUrl, productionHost, urlSource }) {
  // Local runs and CI (`npm run db:migrate:deploy`) have no VERCEL_ENV and keep
  // the previous behaviour — the operator chose the database deliberately.
  if (vercelEnv !== 'preview') {
    const targetHost = hostOf(effectiveUrl)
    const prodHost = normaliseHost(productionHost)
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

  // Normalise BEFORE testing for configuration. A whitespace-only or otherwise
  // unreadable value is truthy but normalises to null, so testing the raw value
  // would accept it as configured and then compare against null — which never
  // matches, failing OPEN in precisely the case the guard exists to catch.
  const prodHost = normaliseHost(productionHost)
  if (!prodHost) {
    return {
      action: 'abort',
      reason: [
        'ERROR: Refusing to run migrations from a preview build.',
        '',
        'PRODUCTION_DB_HOST is not set to a readable hostname (it is missing,',
        'blank, or could not be parsed), so this script cannot tell whether the',
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

  if (targetHost === prodHost) {
    return {
      action: 'abort',
      reason: [
        'ERROR: This preview build is pointed at the PRODUCTION database.',
        '',
        'Migrations have NOT been run, and this build is failing on purpose.',
        '',
        // Hostnames only, never the URL: connection strings carry credentials.
        // Which VARIABLE supplied the URL is the whole diagnosis when a preview
        // database exists but the migration still resolves to production —
        // typically a project-level DIRECT_URL that outranks the per-deployment
        // DATABASE_URL an integration injects.
        `  migration URL came from: ${urlSource || '(unknown)'}`,
        `  it resolves to host    : ${targetHost}`,
        `  PRODUCTION_DB_HOST     : ${prodHost}`,
        '',
        'If a preview database or branch does exist, the variable named above is',
        'the one still pointing at production. Scope it to the Production',
        'environment only, or remove it so the preview value is used.',
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
    urlSource: directUrl ? direct.source : 'DATABASE_URL',
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
  normaliseHost,
  resolveDirectUrl,
  evaluateMigrationTarget,
  DIRECT_URL_FALLBACKS,
}
