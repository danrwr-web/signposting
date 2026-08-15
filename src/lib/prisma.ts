import { PrismaClient } from '@prisma/client'

/**
 * Credential columns are omitted from every query by default.
 *
 * `User.password` is a bcrypt hash checked at login (src/lib/auth.ts,
 * src/server/auth.ts). It lives on rows that pages routinely hand to client
 * components, and Next.js serialises client props into
 * the page HTML — so any query that forgot a `select` published them. That is
 * not hypothetical: it happened on three public pages and three admin screens,
 * and each time nothing broke, no test failed, and no error was logged.
 *
 * Omitting them here inverts the default. A query has to ask for a credential
 * explicitly (`omit: { password: false }`), which is greppable and reviewable,
 * instead of receiving it silently by forgetting to exclude it.
 */
const createPrismaClient = () =>
  new PrismaClient({
    omit: {
      user: { password: true },
    },
  })

// The cached global must carry the omitted client's type, not bare
// PrismaClient. Typing it as PrismaClient collapses the `??` union back to the
// unomitted type: the fields vanish at runtime but still typecheck, so a
// credential read compiles cleanly and then silently reads undefined — which
// would break login rather than fail the build.
type OmittedPrismaClient = ReturnType<typeof createPrismaClient>

const globalForPrisma = globalThis as unknown as {
  prisma: OmittedPrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
