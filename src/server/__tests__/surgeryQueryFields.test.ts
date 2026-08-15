import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * The Surgery row carries adminEmail and an adminPassHash bcrypt hash, which is
 * a live credential for surgery-level login (see src/server/auth.ts). A
 * prisma.surgery.findMany() with no `select` or `omit` returns every scalar
 * column, and these rows are routinely handed to client components — where
 * Next.js serialises them into the page for the browser to read.
 *
 * That is how the hashes ended up in the public HTML of /symptom/[id],
 * /anaphylaxis and /stroke-triage. This guards the whole class rather than the
 * three pages that happened to be wrong, because the failure is silent: nothing
 * breaks, the extra columns are simply published.
 */

const repoRoot = path.resolve(__dirname, '../../..')

function sourceFilesWithSurgeryFindMany(): string[] {
  const out = execSync(
    "grep -rl 'surgery\\.findMany' src --include='*.ts' --include='*.tsx' || true",
    { cwd: repoRoot, encoding: 'utf8' }
  )
  return out
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(f => !f.includes('__tests__'))
}

describe('prisma.surgery.findMany call sites', () => {
  it('always constrain the columns returned', () => {
    const offenders: string[] = []

    for (const file of sourceFilesWithSurgeryFindMany()) {
      const lines = readFileSync(path.join(repoRoot, file), 'utf8').split('\n')

      lines.forEach((line, i) => {
        if (!line.includes('surgery.findMany')) return

        // The query object runs to the closing `})`; scan that window for a
        // column constraint rather than a fixed number of lines.
        const window: string[] = []
        for (let j = i; j < Math.min(i + 25, lines.length); j++) {
          window.push(lines[j])
          if (/^\s*\}\)/.test(lines[j])) break
        }

        const text = window.join('\n')
        if (!/\bselect:/.test(text) && !/\bomit:/.test(text)) {
          offenders.push(`${file}:${i + 1}`)
        }
      })
    }

    expect(offenders).toEqual([])
  })
})
