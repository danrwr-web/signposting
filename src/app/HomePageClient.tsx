'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import CompactToolbar from '@/components/CompactToolbar'
import VirtualizedGrid from '@/components/VirtualizedGrid'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import { Surgery } from '@prisma/client'

type Letter = 'All' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
type AgeBand = 'All' | 'Under5' | '5to17' | 'Adult'

interface HomePageClientProps {
  surgeries: Surgery[]
  symptoms: EffectiveSymptom[]
}

export default function HomePageClient({ surgeries, symptoms: initialSymptoms }: HomePageClientProps) {
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLetter, setSelectedLetter] = useState<Letter>('All')
  const [selectedAge, setSelectedAge] = useState<AgeBand>('All')

  const currentSurgerySlug = searchParams.get('surgery') || undefined

  // Load age filter from localStorage
  useEffect(() => {
    const savedAge = localStorage.getItem('selectedAge') as AgeBand
    if (savedAge && ['All', 'Under5', '5to17', 'Adult'].includes(savedAge)) {
      setSelectedAge(savedAge)
    }
  }, [])

  // Save age filter to localStorage
  useEffect(() => {
    localStorage.setItem('selectedAge', selectedAge)
  }, [selectedAge])

  // Filter symptoms based on search, age group, and letter with useMemo for performance
  const filteredSymptoms = useMemo(() => {
    return initialSymptoms.filter(symptom => {
      const matchesSearch = !searchTerm || 
        symptom.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (symptom.briefInstruction && symptom.briefInstruction.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (symptom.instructions && symptom.instructions.toLowerCase().includes(searchTerm.toLowerCase()))
      
      // Age filtering based on ageGroup field
      const matchesAge = selectedAge === 'All' || (() => {
        if (selectedAge === 'Under5') {
          return symptom.ageGroup === 'U5'
        }
        if (selectedAge === '5to17') {
          return symptom.ageGroup === 'O5'
        }
        if (selectedAge === 'Adult') {
          return symptom.ageGroup === 'Adult'
        }
        return true
      })()
      
      const matchesLetter = selectedLetter === 'All' || 
        symptom.name.trim().toUpperCase().startsWith(selectedLetter)
      
      return matchesSearch && matchesAge && matchesLetter
    })
  }, [initialSymptoms, searchTerm, selectedAge, selectedLetter])

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      {/* Compact Toolbar */}
      <CompactToolbar
        surgeries={surgeries}
        currentSurgerySlug={currentSurgerySlug}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedLetter={selectedLetter}
        onLetterChange={setSelectedLetter}
        selectedAge={selectedAge}
        onAgeChange={setSelectedAge}
        resultsCount={filteredSymptoms.length}
        totalCount={initialSymptoms.length}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-nhs-dark-blue mb-3">
            Symptom Signposting
          </h1>
          <p className="text-base text-nhs-grey max-w-2xl mx-auto">
            Find the right guidance for your symptoms. Select your surgery above to see 
            customized information, or browse the general symptom database.
          </p>
        </div>

        {/* Symptoms Grid */}
        {filteredSymptoms.length > 0 ? (
          <VirtualizedGrid
            symptoms={filteredSymptoms}
            surgerySlug={currentSurgerySlug}
            columns={{
              xl: 4,
              lg: 3,
              md: 2,
              sm: 1
            }}
          />
        ) : (
          <div className="text-center py-12">
            <div className="text-nhs-grey text-lg mb-4">
              No symptoms found matching your criteria.
            </div>
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedLetter('All')
                setSelectedAge('All')
              }}
              className="nhs-button-secondary"
            >
              Clear Filters
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
