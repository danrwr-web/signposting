'use client'

import { useState, useMemo, useEffect, Suspense, useDeferredValue, useRef, useCallback } from 'react'
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
  // When rendered at `/s/[id]`, pass the canonical surgery id from the route.
  // This avoids relying on cookie/localStorage context, which may be stale or point to a different surgery.
  surgeryId?: string
  requiresClinicalReview?: boolean
  surgeryName?: string
  workflowGuidanceEnabled?: boolean
  commonReasonsItems?: EffectiveSymptom[]
}

function HomePageClientContent({ surgeries, symptoms: initialSymptoms, requiresClinicalReview, surgeryName, surgeryId: routeSurgeryId, workflowGuidanceEnabled, commonReasonsItems }: HomePageClientProps) {
  const { surgery, currentSurgeryId, setSurgery } = useSurgery()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLetter, setSelectedLetter] = useState<Letter>('All')
  const [selectedAge, setSelectedAge] = useState<AgeBand>('All')
  const [showSurgerySelector, setShowSurgerySelector] = useState(false)
  const [symptoms, setSymptoms] = useState<EffectiveSymptom[]>(initialSymptoms)
  const [isLoadingSymptoms, setIsLoadingSymptoms] = useState(false)
  const symptomCache = useRef<Record<string, EffectiveSymptom[]>>({})
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

  const deferredSearchTerm = useDeferredValue(searchTerm)
  const deferredSelectedLetter = useDeferredValue(selectedLetter)
  const deferredSelectedAge = useDeferredValue(selectedAge)

  // Auto-show surgery selector if no surgery is selected and surgeries are available
  useEffect(() => {
    if (!surgery && surgeries.length > 0) {
      setShowSurgerySelector(true)
    }
  }, [surgery, surgeries.length])

  // If we are on a surgery-scoped route, ensure the client-side surgery context matches it.
  useEffect(() => {
    if (!routeSurgeryId) return
    if (currentSurgeryId === routeSurgeryId) return
    const match = surgeries.find(s => s.id === routeSurgeryId)
    if (match) {
      setSurgery({ id: match.id, slug: match.slug || match.id, name: match.name })
    }
  }, [routeSurgeryId, currentSurgeryId, surgeries, setSurgery])


  // Use the canonical surgery identifier used in `/s/[id]` routes.
  // Avoid using the human-readable `surgery.slug` so we don't generate inconsistent `?surgery=` links.
  const surgeryId = routeSurgeryId || currentSurgeryId

  const getCacheKey = useCallback((id: string) => `signposting:symptoms:${id}`, [])

  // Cache the initial payload against whichever key we have available
  useEffect(() => {
    const key = surgeryId || 'initial'
    if (!symptomCache.current[key]) {
      symptomCache.current[key] = initialSymptoms
    }
  }, [initialSymptoms, surgeryId])

  // Load cached symptoms from localStorage when surgery changes
  useEffect(() => {
    if (!surgeryId || typeof window === 'undefined') return
    const key = getCacheKey(surgeryId)
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw) as { updatedAt: number; symptoms: EffectiveSymptom[] }
      if (!parsed?.updatedAt || !Array.isArray(parsed.symptoms)) return
      const isFresh = Date.now() - parsed.updatedAt < CACHE_TTL_MS
      if (!isFresh) return
      symptomCache.current[surgeryId] = parsed.symptoms
      setSymptoms(parsed.symptoms)
    } catch (error) {
      console.error('Failed to read cached symptoms', error)
    }
  }, [getCacheKey, surgeryId])

  // Fetch symptoms when surgery changes
  useEffect(() => {
    if (surgeryId) {
      setIsLoadingSymptoms(true)
      const key = surgeryId
      const cached = symptomCache.current[key]
      if (cached) {
        setSymptoms(cached)
      }

      const controller = new AbortController()

      fetch(`/api/symptoms?surgery=${surgeryId}`, { cache: 'no-store', signal: controller.signal })
        .then(response => response.json())
        .then(data => {
          if (data.symptoms && Array.isArray(data.symptoms)) {
            // Ensure symptoms are sorted alphabetically
            const sortedSymptoms = data.symptoms.sort((a: any, b: any) => a.name.localeCompare(b.name))
            setSymptoms(sortedSymptoms)
            symptomCache.current[key] = sortedSymptoms
            if (typeof window !== 'undefined') {
              try {
                const payload = JSON.stringify({ updatedAt: Date.now(), symptoms: sortedSymptoms })
                window.localStorage.setItem(getCacheKey(key), payload)
              } catch (error) {
                console.error('Failed to cache symptoms to localStorage', error)
              }
            }
          }
        })
        .catch(error => {
          console.error('Error fetching symptoms:', error)
          // Keep the initial symptoms if fetch fails
        })
        .finally(() => {
          setIsLoadingSymptoms(false)
        })

      return () => controller.abort()
    }
  }, [surgeryId, getCacheKey])

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
  const lowerSearch = useMemo(() => deferredSearchTerm.trim().toLowerCase(), [deferredSearchTerm])
  const filteredSymptoms = useMemo(() => {
    return symptoms.filter(symptom => {
      const matchesSearch = !lowerSearch || 
        symptom.name.toLowerCase().includes(lowerSearch) ||
        (symptom.briefInstruction && symptom.briefInstruction.toLowerCase().includes(lowerSearch)) ||
        (symptom.instructions && symptom.instructions.toLowerCase().includes(lowerSearch))
      
      // Age filtering based on ageGroup field
      const matchesAge = deferredSelectedAge === 'All' || (() => {
        if (deferredSelectedAge === 'Under5') {
          return symptom.ageGroup === 'U5'
        }
        if (deferredSelectedAge === '5to17') {
          return symptom.ageGroup === 'O5'
        }
        if (deferredSelectedAge === 'Adult') {
          return symptom.ageGroup === 'Adult'
        }
        return true
      })()
      
      const matchesLetter = deferredSelectedLetter === 'All' || 
        symptom.name.trim().toUpperCase().startsWith(deferredSelectedLetter)
      
      return matchesSearch && matchesAge && matchesLetter
    })
  }, [symptoms, lowerSearch, deferredSelectedAge, deferredSelectedLetter])

  const renderSkeletonGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" role="status" aria-live="polite">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm animate-pulse">
          <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-32 bg-gray-100 rounded mb-2" />
          <div className="h-3 w-full bg-gray-100 rounded mb-1" />
          <div className="h-3 w-5/6 bg-gray-100 rounded mb-1" />
          <div className="h-3 w-2/3 bg-gray-100 rounded" />
        </div>
      ))}
      <span className="sr-only">Loading symptoms</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      {/* Compact Toolbar */}
      <CompactToolbar
        surgeries={surgeries}
        currentSurgeryId={surgeryId}
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
        workflowGuidanceEnabled={workflowGuidanceEnabled}
        symptoms={symptoms}
        commonReasonsItems={commonReasonsItems}
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
          renderSkeletonGrid()
        ) : filteredSymptoms.length > 0 && surgeries.length > 0 ? (
          <VirtualizedGrid
            symptoms={filteredSymptoms}
            surgeryId={surgeryId || undefined}
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
