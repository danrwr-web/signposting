/**
 * Prisma migrate deploy wrapper for CI/Vercel.
 *
 * Neon pooler URLs (often containing "-pooler.") are not suitable for migrations/advisory locks.
 * Use DIRECT_URL pointing at the non-pooler endpoint.
 */

const { spawnSync } = require('node:child_process')

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false, env: process.env })
  if (res.status !== 0) process.exit(res.status ?? 1)
}

const dbUrl = process.env.DATABASE_URL || ''
const directUrl = process.env.DIRECT_URL || ''

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
  if (dbUrl) {
    process.env.DIRECT_URL = dbUrl
  }
}

// Be a bit more tolerant of concurrent deploys holding the advisory lock.
process.env.PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT = process.env.PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT || '60000'

run('npx', ['prisma', 'migrate', 'deploy'])

