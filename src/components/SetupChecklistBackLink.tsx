'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface SetupChecklistBackLinkProps {
  surgeryId: string
}

export default function SetupChecklistBackLink({ surgeryId }: SetupChecklistBackLinkProps) {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')

  if (from !== 'setup') return null

  return (
    <div className="mb-4">
      <Link
        href={`/s/${surgeryId}/admin/setup-checklist`}
        className="inline-flex items-center text-sm text-nhs-blue hover:text-nhs-dark-blue"
      >
        &larr; Back to Setup Checklist
      </Link>
    </div>
  )
}
