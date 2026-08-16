/**
 * Which deployment this code is running on.
 *
 * Every environment guard in this codebase used to reach for `NODE_ENV`, which
 * cannot answer the question: Vercel sets `NODE_ENV=production` for preview
 * builds too, so preview and production were indistinguishable to all of them.
 * `VERCEL_ENV` is the variable that actually distinguishes the three.
 *
 * `NODE_ENV` still has its own job — build mode, minification, React's dev
 * warnings — and this module deliberately does not replace it. Use `NODE_ENV`
 * to ask "is this an optimised build"; use this module to ask "which
 * deployment am I talking to".
 */

export type DeploymentEnvironment = 'production' | 'preview' | 'development'

/**
 * Resolve the deployment environment.
 *
 * When `VERCEL_ENV` is missing or unrecognised this reports `development`, and
 * that direction is deliberate. The two ways of being wrong are not
 * symmetrical: wrongly reporting `production` silently suppresses the banner on
 * a preview, which is the exact failure this exists to prevent, while wrongly
 * reporting `development` puts a visible banner on a live deployment — obvious
 * within seconds and harmless while it lasts. So an unknown environment fails
 * loud rather than quiet.
 *
 * `NEXT_PUBLIC_VERCEL_ENV` is read as a second source so client components can
 * use this too. Both names are written out literally because Next.js inlines
 * `process.env.NEXT_PUBLIC_*` into client bundles by textual substitution — a
 * computed lookup would compile to `undefined` in the browser.
 */
export function deploymentEnvironment(): DeploymentEnvironment {
  const raw = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV

  if (raw === 'production') return 'production'
  if (raw === 'preview') return 'preview'
  return 'development'
}

export function isProductionDeployment(): boolean {
  return deploymentEnvironment() === 'production'
}

/**
 * A short, human-readable name for the database this deployment is pointed at.
 *
 * Returns the first hostname label only — for Neon that is the endpoint id
 * (`ep-cool-mud-a1b2c3d4`), which is what distinguishes one branch's database
 * from another's. The `-pooler` suffix is dropped because the pooled and direct
 * endpoints of the same branch are the same database, and showing them as two
 * different labels would suggest otherwise.
 *
 * Never returns anything drawn from the credentials or the path: this value is
 * rendered on screen, and a connection string carries a password.
 */
export function deploymentDatabaseLabel(connectionString?: string): string | null {
  const url = connectionString ?? process.env.DATABASE_URL
  if (!url) return null

  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }

  const label = host.split('.')[0]
  if (!label) return null

  return label.replace(/-pooler$/, '')
}

export interface DeploymentDescription {
  environment: DeploymentEnvironment
  /** The git branch the deployment was built from, when the platform reports one. */
  gitBranch: string | null
  /** The database endpoint, or null when it cannot be determined without guessing. */
  database: string | null
}

/**
 * Everything the non-production banner needs, resolved in one place.
 *
 * Server-side only in practice — `DATABASE_URL` is not exposed to the browser,
 * so `database` is null if this is ever called from a client component. That is
 * the correct outcome rather than a bug to work around: the connection string
 * must not be inlined into a client bundle.
 */
export function describeDeployment(): DeploymentDescription {
  return {
    environment: deploymentEnvironment(),
    gitBranch:
      process.env.VERCEL_GIT_COMMIT_REF ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ||
      null,
    database: deploymentDatabaseLabel(),
  }
}
