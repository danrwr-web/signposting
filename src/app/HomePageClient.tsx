'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CompactToolbar from '@/components/CompactToolbar'
import VirtualizedGrid from '@/components/VirtualizedGrid'
import TestUserUsage from '@/components/TestUserUsage'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import { Surgery } from '@prisma/client'
import { useSurgery } from '@/context/SurgeryContext'

type Letter = 'All' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
type AgeBand = 'All' | 'Under5' | '5to17' | 'Adult'

interface HomePageClientProps {
  surgeries: Surgery[]
  symptoms: EffectiveSymptom[]
  requiresClinicalReview?: boolean
  surgeryName?: string
}

function HomePageClientContent({ surgeries, symptoms: initialSymptoms, requiresClinicalReview, surgeryName }: HomePageClientProps) {
  const searchParams = useSearchParams()
  const { surgery, currentSurgerySlug } = useSurgery()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLetter, setSelectedLetter] = useState<Letter>('All')
  const [selectedAge, setSelectedAge] = useState<AgeBand>('All')
  const [showSurgerySelector, setShowSurgerySelector] = useState(false)
  const [symptoms, setSymptoms] = useState<EffectiveSymptom[]>(initialSymptoms)
  const [isLoadingSymptoms, setIsLoadingSymptoms] = useState(false)

  const currentSurgeryId = surgery?.id

  // Auto-show surgery selector if no surgery is selected and surgeries are available
  useEffect(() => {
    if (!surgery && surgeries.length > 0) {
      setShowSurgerySelector(true)
    }
  }, [surgery, surgeries.length])


  // Use surgerySlug from context
  const surgerySlug = currentSurgerySlug

  // Fetch symptoms when surgery changes
  useEffect(() => {
    if (currentSurgeryId && surgerySlug) {
      setIsLoadingSymptoms(true)
      
      // Force fresh data after admin changes
      fetch(`/api/symptoms?surgery=${surgerySlug}&t=${Date.now()}` , { cache: 'no-store' })
        .then(response => response.json())
        .then(data => {
          if (data.symptoms && Array.isArray(data.symptoms)) {
            // Ensure symptoms are sorted alphabetically
            const sortedSymptoms = data.symptoms.sort((a: any, b: any) => a.name.localeCompare(b.name))
            setSymptoms(sortedSymptoms)
          }
        })
        .catch(error => {
          console.error('Error fetching symptoms:', error)
          // Keep the initial symptoms if fetch fails
        })
        .finally(() => {
          setIsLoadingSymptoms(false)
        })
    }
  }, [currentSurgeryId, surgerySlug])

  // Manual refresh function - symptoms are refreshed when surgery changes or user explicitly refreshes
  // Removed automatic polling to reduce server load and improve performance

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
    return symptoms.filter(symptom => {
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
  }, [symptoms, searchTerm, selectedAge, selectedLetter])

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      {/* Compact Toolbar */}
      <CompactToolbar
        surgeries={surgeries}
        currentSurgeryId={currentSurgeryId}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedLetter={selectedLetter}
        onLetterChange={setSelectedLetter}
        selectedAge={selectedAge}
        onAgeChange={setSelectedAge}
        resultsCount={filteredSymptoms.length}
        totalCount={initialSymptoms.length}
        showSurgerySelector={showSurgerySelector}
        onShowSurgerySelector={setShowSurgerySelector}
      />

      {/* Clinical Review Warning Banner */}
      {requiresClinicalReview && surgeryName && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Content for {surgeryName} is awaiting local clinical review.</strong> If you&apos;re unsure, please check with a clinician before booking.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test User Usage Display */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <TestUserUsage />
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-nhs-dark-blue mb-3">
            Find the right place for care
          </h1>
          <p className="text-base text-nhs-grey max-w-2xl mx-auto">
            Search by symptom and we&apos;ll guide you to the appropriate service.
          </p>
        </div>

        {/* Symptoms Grid */}
        {isLoadingSymptoms ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-nhs-grey">Loading symptoms...</div>
          </div>
        ) : filteredSymptoms.length > 0 && surgeries.length > 0 ? (
          <VirtualizedGrid
            symptoms={filteredSymptoms}
            surgerySlug={surgerySlug || undefined}
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

export default function HomePageClient(props: HomePageClientProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-nhs-light-grey flex items-center justify-center">
        <div className="text-nhs-grey">Loading...</div>
      </div>
    }>
      <HomePageClientContent {...props} />
    </Suspense>
  )
}
