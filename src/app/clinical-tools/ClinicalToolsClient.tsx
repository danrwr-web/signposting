'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import CompactToolbar from '@/components/CompactToolbar'
import SurgeryFiltersHeader from '@/components/SurgeryFiltersHeader'
import { useSurgery } from '@/context/SurgeryContext'
import { Surgery } from '@prisma/client'

interface ClinicalTool {
  id: string
  title: string
  description: string
  href: string
  category?: string
}

interface ClinicalToolsClientProps {
  surgeryId: string
}

// Clinical tools data - can be moved to a database or config file later
const CLINICAL_TOOLS: ClinicalTool[] = [
  {
    id: 'diabetic-titration',
    title: 'Diabetic medication titration decision aid',
    description: 'Interactive decision aid to help with medication titration decisions for patients with diabetes.',
    href: '/diabetic-titration',
    category: 'Diabetes',
  },
  {
    id: 'luts',
    title: 'LUTS treatment decision aid',
    description: 'Interactive decision aid to help identify LUTS symptom patterns and choose appropriate medication classes.',
    href: '/luts',
    category: 'Urology',
  },
]

export default function ClinicalToolsClient({ surgeryId }: ClinicalToolsClientProps) {
  const { surgery } = useSurgery()
  const [searchTerm, setSearchTerm] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter tools based on search term
  const filteredTools = useMemo(() => {
    if (!searchTerm.trim()) {
      return CLINICAL_TOOLS
    }
    const searchLower = searchTerm.toLowerCase()
    return CLINICAL_TOOLS.filter(
      (tool) =>
        tool.title.toLowerCase().includes(searchLower) ||
        tool.description.toLowerCase().includes(searchLower) ||
        tool.category?.toLowerCase().includes(searchLower)
    )
  }, [searchTerm])

  const surgeries: Surgery[] = surgery ? [surgery] : []

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <CompactToolbar
        variant="full"
        surgeries={surgeries}
        currentSurgeryId={surgeryId}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedLetter="All"
        onLetterChange={() => {}}
        selectedAge="All"
        onAgeChange={() => {}}
        resultsCount={filteredTools.length}
        totalCount={CLINICAL_TOOLS.length}
        showSurgerySelector={false}
        onShowSurgerySelector={() => {}}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <SurgeryFiltersHeader
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedLetter="All"
          onLetterChange={() => {}}
          selectedAge="All"
          onAgeChange={() => {}}
          resultsCount={filteredTools.length}
          totalCount={CLINICAL_TOOLS.length}
          currentSurgeryId={surgeryId}
          searchInputRef={searchInputRef}
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-nhs-dark-blue mb-3">
            Clinical tools for GPs and Nurses
          </h1>
          <p className="text-base text-nhs-grey max-w-2xl mx-auto">
            Interactive clinical decision aids to support patient care.
          </p>
        </div>

        {/* Tools Grid */}
        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTools.map((tool) => (
              <Link
                key={tool.id}
                href={`/s/${surgeryId}/clinical-tools${tool.href}`}
                className="block rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-nhs-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2"
              >
                <h2 className="text-lg font-semibold text-nhs-dark-blue mb-2">
                  {tool.title}
                </h2>
                <p className="text-sm text-slate-600 mb-3">{tool.description}</p>
                {tool.category && (
                  <span className="inline-block text-xs font-medium text-nhs-blue bg-nhs-light-blue px-2 py-1 rounded">
                    {tool.category}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-nhs-grey text-lg mb-4">
              No tools found matching your search.
            </div>
            <button
              onClick={() => setSearchTerm('')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue"
            >
              Clear Search
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
