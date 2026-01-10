/**
 * Prisma generate wrapper for CI/Vercel.
 *
 * Runs `prisma generate` which does not require a database connection.
 * This script is safe to run during postinstall even when DATABASE_URL is missing.
 */

const { spawnSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

// Find npx - try node_modules/.bin first, then system PATH
const nodeModulesNpx = path.join(__dirname, '..', 'node_modules', '.bin', 'npx' + (process.platform === 'win32' ? '.cmd' : ''))
const npxCmd = fs.existsSync(nodeModulesNpx) ? nodeModulesNpx : 'npx'

// prisma generate does not require DATABASE_URL - it only needs the schema file
// Always attempt to generate, but handle errors gracefully to not block npm install
const res = spawnSync(npxCmd, ['prisma', 'generate'], { 
  stdio: 'inherit', 
  shell: process.platform === 'win32',
  env: process.env 
})

if (res.error) {
  console.warn('Warning: Failed to run prisma generate:', res.error.message)
  console.warn('You may need to run "npx prisma generate" manually after installation.')
  process.exit(0) // Don't block install
}

if (res.status !== null && res.status !== 0) {
  console.warn(`Warning: prisma generate exited with code ${res.status}`)
  console.warn('You may need to run "npx prisma generate" manually after installation.')
  process.exit(0) // Don't block install - allow it to continue
}

// Success
process.exit(0)

