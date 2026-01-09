/**
 * Prisma generate wrapper for CI/Vercel.
 *
 * If DIRECT_URL is not set, fall back to DATABASE_URL so `prisma generate` still works
 * in local/dev environments. For deploys where DATABASE_URL is a pooler endpoint,
 * migrations should use a non-pooler DIRECT_URL.
 */

const { spawnSync } = require('node:child_process')

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false, env: process.env })
  if (res.status !== 0) process.exit(res.status ?? 1)
}

if (!process.env.DATABASE_URL) {
  // Allow installs (e.g. in CI for linting) without a database connection.
  console.warn('Skipping prisma generate: DATABASE_URL is not set.')
  process.exit(0)
}

if (process.env.DATABASE_URL) {
  // Normalise common DATABASE_URL formats for Prisma.
  const raw = String(process.env.DATABASE_URL).trim().replace(/^['"]|['"]$/g, '')
  process.env.DATABASE_URL = raw.startsWith('postgres://')
    ? `postgresql://${raw.slice('postgres://'.length)}`
    : raw
}

run('npx', ['prisma', 'generate'])

