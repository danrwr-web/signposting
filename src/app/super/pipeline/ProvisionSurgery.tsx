'use client'

import { PipelineEntry } from './types'

interface Props {
  entries: PipelineEntry[]
  setEntries: React.Dispatch<React.SetStateAction<PipelineEntry[]>>
}

export default function ProvisionSurgery({ entries, setEntries }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <p className="text-gray-500">Provision Surgery — coming soon</p>
    </div>
  )
}
