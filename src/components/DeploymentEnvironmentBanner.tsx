import 'server-only'

import { describeDeployment } from '@/lib/environment'

/**
 * A standing strip across the top of every page on any deployment that is not
 * production.
 *
 * The mistake this guards against is not a subtle one — it is looking at a
 * preview URL, believing it to be the live site, and acting accordingly. That
 * belief is entirely reasonable when the two are pixel-identical, so the fix is
 * to make them not identical.
 *
 * Rendered on the server. `DATABASE_URL` is never exposed to the browser, so
 * naming the database has to happen here; only the endpoint label crosses into
 * the markup, never the connection string (see `deploymentDatabaseLabel`).
 */
export default function DeploymentEnvironmentBanner() {
  const { environment, gitBranch, database } = describeDeployment()

  if (environment === 'production') return null

  const isPreview = environment === 'preview'

  return (
    <div
      className={
        isPreview
          ? 'w-full bg-amber-500 text-amber-950 px-4 py-1.5 text-xs sm:text-sm font-medium'
          : 'w-full bg-slate-700 text-slate-50 px-4 py-1.5 text-xs sm:text-sm font-medium'
      }
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-bold uppercase tracking-wide">
          {isPreview ? 'Preview' : 'Local'}
        </span>
        <span>This is not the live site.</span>
        {gitBranch && (
          <span className="opacity-90">
            Branch <span className="font-mono">{gitBranch}</span>
          </span>
        )}
        {database && (
          <span className="opacity-90">
            Database <span className="font-mono">{database}</span>
          </span>
        )}
      </div>
    </div>
  )
}
