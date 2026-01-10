import 'server-only'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SelectSurgeryPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const surgeryIds = user.memberships.map(m => m.surgeryId)

  if (surgeryIds.length === 1) {
    redirect(`/s/${surgeryIds[0]}`)
  }

  if (surgeryIds.length === 0) {
    redirect('/s')
  }

  const surgeries = await prisma.surgery.findMany({
    where: { id: { in: surgeryIds } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-nhs-dark-blue">Choose a surgery</h1>
      <p className="mt-4 text-nhs-grey">
        Your account has access to more than one surgery. Choose where you want to work.
      </p>

      <ul className="mt-6 space-y-2">
        {surgeries.map(s => (
          <li key={s.id}>
            <Link
              href={`/s/${s.id}`}
              className="block rounded-md border border-gray-200 bg-white px-4 py-3 text-nhs-blue hover:bg-nhs-light-grey focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
            >
              {s.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}

