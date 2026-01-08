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

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL
}

run('npx', ['prisma', 'generate'])

