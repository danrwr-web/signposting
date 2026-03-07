'use client'

import { EditorialBulkProgressBanner } from './EditorialBulkProgressBanner'

export function EditorialLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EditorialBulkProgressBanner />
      {children}
    </>
  )
}
