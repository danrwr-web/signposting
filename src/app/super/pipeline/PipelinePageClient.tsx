'use client'

import { useState } from 'react'
import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'
import { PipelineEntry } from './types'
import PipelineTable from './PipelineTable'
import CommsHub from './CommsHub'
import ProvisionSurgery from './ProvisionSurgery'

const TABS = ['Pipeline Tracker', 'Comms Hub', 'Provision Surgery'] as const
type Tab = (typeof TABS)[number]

interface Props {
  initialEntries: PipelineEntry[]
}

export default function PipelinePageClient({ initialEntries }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Pipeline Tracker')
  const [entries, setEntries] = useState<PipelineEntry[]>(initialEntries)

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={[]} currentSurgeryId={undefined} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-nhs-dark-blue">Sales Pipeline</h1>
            <p className="mt-1 text-nhs-grey">
              Track practices, generate documents, and provision new surgeries
            </p>
          </div>
          <Link
            href="/admin/system"
            className="text-sm text-nhs-blue hover:text-nhs-dark-blue font-medium"
          >
            &larr; Back to System Management
          </Link>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-nhs-blue text-nhs-blue'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'Pipeline Tracker' && (
          <PipelineTable entries={entries} setEntries={setEntries} />
        )}

        {activeTab === 'Comms Hub' && (
          <CommsHub entries={entries} setEntries={setEntries} />
        )}

        {activeTab === 'Provision Surgery' && (
          <ProvisionSurgery entries={entries} setEntries={setEntries} />
        )}
      </main>
    </div>
  )
}
