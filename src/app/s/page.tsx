import { redirect } from 'next/navigation'
import 'server-only'
import { getSessionUser } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// `/s` is the authenticated entry route when there is no explicit surgery context.
// It avoids going via `/`, which can lose `/s/[id]` context and (depending on host/middleware) intermittently bounce to `/login`.
export default async function SurgeryEntryPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const surgeryIds = user.memberships.map(m => m.surgeryId)

  if (surgeryIds.length === 1) {
    redirect(`/s/${surgeryIds[0]}`)
  }

  if (surgeryIds.length > 1) {
    redirect('/s/select')
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-nhs-dark-blue">You do not have access to a surgery</h1>
      <p className="mt-4 text-nhs-grey">
        Your account is signed in, but it is not linked to any surgery yet.
      </p>
      <p className="mt-2 text-nhs-grey">
        Please contact your practice administrator to grant access.
      </p>
    </main>
  )
}

