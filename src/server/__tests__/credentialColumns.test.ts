import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * `User.password` and `Surgery.adminPassHash` are bcrypt hashes verified at
 * login. Both sit on rows that pages hand to client components, and Next.js
 * serialises client props into the page HTML — so any read that forgot to
 * exclude them published them. It happened on three public pages and three
 * admin screens, and each time nothing broke and no test failed.
 *
 * src/lib/prisma.ts omits both columns from every query by default. Two things
 * have to stay true for that to hold, and neither is enforced by the compiler:
 * the global omit must remain configured, and opting back in must stay rare and
 * deliberate. Prisma's generated types do NOT reflect a global omit, so a
 * dropped opt-in typechecks cleanly and fails only at runtime.
 *
 * An earlier version of this file instead required a root-level `select` on
 * every surgery/user read. That was the wrong invariant: most of those reads
 * never cross a client boundary, so it flagged ~129 call sites of mixed
 * legitimacy. Guarding the credential columns directly is precise, and the
 * global omit makes it sufficient.
 */

const repoRoot = path.resolve(__dirname, '../../..')

/**
 * Every place allowed to read a credential back, and how many times.
 *
 * Counts, not just filenames: a file-set comparison passes when an opt-in is
 * *removed* from a file that still has another one, and a removed opt-in is the
 * dangerous direction — it silently breaks login, because the generated types
 * do not know the column is omitted.
 */
const APPROVED_OPT_INS: Record<string, number> = {
  'src/lib/auth.ts': 1, // NextAuth credentials provider
  'src/server/auth.ts': 2, // surgery-admin login, superuser login
  'src/app/api/super/pipeline/[id]/provision/route.ts': 1, // detects a passwordless account
  'src/app/api/user/change-password/route.ts': 1, // verifies the current password
}

const CREDENTIALS = ['password', 'adminPassHash']

/** Strip comments so documented examples are not counted as real opt-ins. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
}

/**
 * Count read-backs of a credential column.
 *
 * There are two ways past the global omit, spelled almost identically with
 * opposite meanings, so the surrounding key decides:
 *
 *   omit:   { password: false }      -> reads it back  (an opt-in)
 *   omit:   { adminPassHash: true }  -> excludes it    (not an opt-in)
 *   select: { password: true }       -> reads it back  (an opt-in)
 *
 * Matching the field name alone would both miss `select` opt-ins and misread
 * ordinary `omit` exclusions as opt-ins. `[^}]*` keeps each match inside one
 * object literal so a later block cannot be attributed to an earlier key.
 */
function countOptIns(source: string): number {
  const text = stripComments(source).replace(/\s+/g, ' ')
  let count = 0

  for (const field of CREDENTIALS) {
    for (const [key, value] of [
      ['omit', 'false'],
      ['select', 'true'],
    ] as const) {
      const re = new RegExp(`${key}:\\s*\\{[^}]*\\b${field}\\s*:\\s*${value}\\b`, 'g')
      count += (text.match(re) ?? []).length
    }
  }

  return count
}

describe('credential columns', () => {
  it('are omitted from every query by default', () => {
    const client = readFileSync(path.join(repoRoot, 'src/lib/prisma.ts'), 'utf8')

    expect(client).toMatch(/omit:\s*\{/)
    expect(client).toMatch(/user:\s*\{\s*password:\s*true\s*\}/)
    expect(client).toMatch(/surgery:\s*\{\s*adminPassHash:\s*true\s*\}/)
  })

  it('keep the cached client typed as the omitted client', () => {
    // Typing the global cache as bare PrismaClient collapses the `??` union
    // back to the unomitted type: credentials disappear at runtime but still
    // typecheck, so a credential read compiles and silently reads undefined.
    const client = readFileSync(path.join(repoRoot, 'src/lib/prisma.ts'), 'utf8')

    expect(client).not.toMatch(/prisma:\s*PrismaClient\s*\|\s*undefined/)
  })

  it('are only read back in approved authentication paths', () => {
    const out = execSync(
      "grep -rl 'password\\|adminPassHash' src --include='*.ts' --include='*.tsx' || true",
      { cwd: repoRoot, encoding: 'utf8' }
    )

    const counts: Record<string, number> = {}

    out
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .filter(f => !f.includes('__tests__') && !f.includes('.test.'))
      .forEach(file => {
        const n = countOptIns(readFileSync(path.join(repoRoot, file), 'utf8'))
        if (n > 0) counts[file] = n
      })

    expect(counts).toEqual(APPROVED_OPT_INS)
  })
})
