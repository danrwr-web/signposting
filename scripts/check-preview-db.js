#!/usr/bin/env node
/**
 * Dry-run the preview migration guard: reports the decision a preview build
 * would reach, without connecting to a database or running migrations.
 *
 *   DATABASE_URL='<preview url>' \
 *   DIRECT_URL='<preview non-pooler url>' \
 *   PRODUCTION_DB_HOST='<production hostname>' \
 *   node scripts/check-preview-db.js
 *
 * Reads the same environment variables as the deploy wrapper and resolves the
 * migration URL the same way, because they are not always the same URL: when
 * DATABASE_URL is a pooler endpoint the wrapper migrates against the direct URL
 * instead (DIRECT_URL, DATABASE_URL_UNPOOLED or POSTGRES_URL_NON_POOLING), and
 * it is that host the guard compares. Checking DATABASE_URL alone can report a
 * pass while the real build aborts on a different host.
 */
const {
  evaluateMigrationTarget,
  hostOf,
  normaliseHost,
  normaliseDbUrl,
  resolveDirectUrl,
  DIRECT_URL_FALLBACKS,
} = require('./prisma-migrate-deploy')

const productionHost = process.env.PRODUCTION_DB_HOST
const dbUrl = normaliseDbUrl(process.env.DATABASE_URL || '')
const direct = resolveDirectUrl(process.env)
const directUrl = normaliseDbUrl(direct.value)

if (!dbUrl && !directUrl) {
  console.error(
    [
      'Set the variables to check, as the Vercel Preview environment would:',
      '',
      "  DATABASE_URL='<preview url>' \\",
      "  PRODUCTION_DB_HOST='<production hostname>' \\",
      '  node scripts/check-preview-db.js',
      '',
      `Add ${DIRECT_URL_FALLBACKS.join(' / ')} too if DATABASE_URL is a pooler endpoint.`,
    ].join('\n')
  )
  process.exit(2)
}

// Mirrors main() in prisma-migrate-deploy.js.
let effectiveUrl
let effectiveSource
if (directUrl) {
  effectiveUrl = directUrl
  effectiveSource = direct.source
} else if (dbUrl.includes('-pooler.')) {
  console.log('BLOCKED - a preview build with these values would fail:\n')
  console.log('ERROR: A direct (non-pooler) URL is required for migrations when using a pooler DATABASE_URL.')
  console.log(`Set one of ${DIRECT_URL_FALLBACKS.join(', ')} to the non-pooler connection string.`)
  process.exit(1)
} else {
  effectiveUrl = dbUrl
  effectiveSource = 'DATABASE_URL'
}

console.log(`migration URL comes from: ${effectiveSource}`)
console.log('preview host   :', hostOf(effectiveUrl) ?? '(unreadable)')
console.log('production host:', normaliseHost(productionHost) ?? '(unreadable)')
console.log('')

const decision = evaluateMigrationTarget({
  vercelEnv: 'preview',
  effectiveUrl,
  productionHost,
})

if (decision.action === 'run') {
  console.log('PASS - a preview build with these values would run migrations.')
  process.exit(0)
}

console.log('BLOCKED - a preview build with these values would fail:\n')
console.log(decision.reason)
process.exit(1)
