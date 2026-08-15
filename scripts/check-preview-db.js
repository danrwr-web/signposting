#!/usr/bin/env node
/**
 * Dry-run the preview migration guard: prints the decision it WOULD make for a
 * given pair of values, without connecting to anything or running migrations.
 *
 *   node scripts/check-preview-db.js "<preview DATABASE_URL>" "<PRODUCTION_DB_HOST>"
 *
 * Use it to confirm Vercel's Preview environment is set up correctly before
 * pushing a commit and waiting on a build.
 */
const { evaluateMigrationTarget, hostOf, normaliseHost } = require('./prisma-migrate-deploy')

const [previewUrl, productionHost] = process.argv.slice(2)

if (!previewUrl || !productionHost) {
  console.error('Usage: node scripts/check-preview-db.js "<preview DATABASE_URL>" "<PRODUCTION_DB_HOST>"')
  process.exit(2)
}

const previewHost = hostOf(previewUrl)
const prodHost = normaliseHost(productionHost)

console.log('preview host   :', previewHost ?? '(unreadable)')
console.log('production host:', prodHost ?? '(unreadable)')
console.log('')

const decision = evaluateMigrationTarget({
  vercelEnv: 'preview',
  effectiveUrl: previewUrl,
  productionHost,
})

if (decision.action === 'run') {
  console.log('PASS - a preview build with these values would run migrations.')
  process.exit(0)
}

console.log('BLOCKED - a preview build with these values would fail:')
console.log('')
console.log(decision.reason)
process.exit(1)
