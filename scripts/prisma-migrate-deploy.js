/**
 * Prisma migrate deploy wrapper for CI/Vercel.
 *
 * Neon pooler URLs (often containing "-pooler.") are not suitable for migrations/advisory locks.
 * Use DIRECT_URL pointing at the non-pooler endpoint.
 *
 * Set VERCEL_SKIP_MIGRATE=1 to skip migrations during build (e.g. when DB is unreachable from
 * Vercel's build environment). Run "prisma migrate deploy" manually or via a separate CI step.
 *
 * Set VERCEL_MIGRATE_FAIL_GRACEFULLY=1 to continue the build if migrate fails (e.g. P1002
 * advisory lock timeout). Use when DB is slow or locked; ensure migrations are run separately.
 */

const { spawnSync } = require('node:child_process')

if (process.env.VERCEL_SKIP_MIGRATE === '1' || process.env.VERCEL_SKIP_MIGRATE === 'true') {
  console.log('VERCEL_SKIP_MIGRATE is set; skipping prisma migrate deploy.')
  process.exit(0)
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

const dbUrlRaw = process.env.DATABASE_URL || ''
const dbUrl = normaliseDbUrl(dbUrlRaw)
const directUrlRaw = process.env.DIRECT_URL || ''
const directUrl = normaliseDbUrl(directUrlRaw)

if (directUrl && /\s/.test(directUrl)) {
  console.error(
    [
      'ERROR: DIRECT_URL contains whitespace.',
      'Set DIRECT_URL to the raw Postgres connection URL only (no `psql ...` prefix, no quotes, no newlines).',
    ].join('\n')
  )
  process.exit(1)
}

if (!directUrl) {
  if (dbUrl.includes('-pooler.')) {
    console.error(
      [
        'ERROR: DIRECT_URL is required for migrations when using a pooler DATABASE_URL.',
        'Set DIRECT_URL to the non-pooler Neon connection string in your Vercel environment variables.',
      ].join('\n')
    )
    process.exit(1)
  }
  // If DATABASE_URL is already a direct connection, use it as-is.
  if (dbUrl) process.env.DATABASE_URL = dbUrl
} else {
  // For migrations, force Prisma to use the direct URL by swapping DATABASE_URL for this command.
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

// Be tolerant of concurrent deploys and Neon cold starts (advisory lock timeout, default 10s).
process.env.PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT = process.env.PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT || '120000'

const res = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', shell: false, env: process.env })
if (res.status !== 0) {
  if (process.env.VERCEL_MIGRATE_FAIL_GRACEFULLY === '1' || process.env.VERCEL_MIGRATE_FAIL_GRACEFULLY === 'true') {
    console.warn(
      '\nWARN: prisma migrate deploy failed (e.g. P1002: DB unreachable). Build continues. Run "prisma migrate deploy" manually.'
    )
    process.exit(0)
  }
  process.exit(res.status ?? 1)
}

