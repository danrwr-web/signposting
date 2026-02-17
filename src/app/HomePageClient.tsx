'use client'

import { useState, useMemo, useEffect, Suspense, useDeferredValue, useRef, useCallback } from 'react'
import CompactToolbar from '@/components/CompactToolbar'
import VirtualizedGrid from '@/components/VirtualizedGrid'
import TestUserUsage from '@/components/TestUserUsage'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import { CommonReasonsResolvedItem } from '@/lib/commonReasons'
import type { Surgery } from '@prisma/client'
import { useSurgery } from '@/context/SurgeryContext'
import { SymptomChangeInfo, CardData } from '@/components/SymptomCard'
import { SkeletonCardGrid } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

type Letter = 'All' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
type AgeBand = 'All' | 'Under5' | '5to17' | 'Adult'

interface HomePageClientProps {
  surgeries: Pick<Surgery, 'id' | 'slug' | 'name'>[]
  symptoms: EffectiveSymptom[]
  // When rendered at `/s/[id]`, pass the canonical surgery id from the route.
  // This avoids relying on cookie/localStorage context, which may be stale or point to a different surgery.
  surgeryId?: string
  requiresClinicalReview?: boolean
  surgeryName?: string
  commonReasonsItems?: CommonReasonsResolvedItem[]
}

function HomePageClientContent({ surgeries, symptoms: initialSymptoms, requiresClinicalReview, surgeryName, surgeryId: routeSurgeryId, commonReasonsItems }: HomePageClientProps) {
  const { surgery, currentSurgeryId, setSurgery } = useSurgery()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLetter, setSelectedLetter] = useState<Letter>('All')
  const [selectedAge, setSelectedAge] = useState<AgeBand>('All')
  const [showSurgerySelector, setShowSurgerySelector] = useState(false)
  const [symptoms, setSymptoms] = useState<EffectiveSymptom[]>(initialSymptoms)
  const [isLoadingSymptoms, setIsLoadingSymptoms] = useState(false)
  const [changesMap, setChangesMap] = useState<Map<string, SymptomChangeInfo>>(new Map())
  const symptomCache = useRef<Record<string, EffectiveSymptom[]>>({})
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

  const [cardData, setCardData] = useState<CardData | undefined>(undefined)

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
  const surgeryId = routeSurgeryId || currentSurgeryId || undefined

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

  // Fetch symptoms only when the user switches to a different surgery (not on initial load).
  // Also fetch card data (highlights, image icons) and changes in parallel.
  useEffect(() => {
    if (!surgeryId) return

    const controller = new AbortController()
    const isSwitching = surgeryId !== routeSurgeryId

    // Always fetch card data (highlights/icons) for the current surgery
    fetch(`/api/symptom-card-data?surgeryId=${surgeryId}`, { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        setCardData({
          highlightRules: Array.isArray(json.highlights) ? json.highlights : [],
          enableBuiltInHighlights: json.enableBuiltInHighlights ?? true,
          enableImageIcons: json.enableImageIcons ?? true,
          imageIcons: Array.isArray(json.imageIcons) ? json.imageIcons : [],
        })
      })
      .catch(() => {})

    // Helper to fetch changes for a given set of symptoms
    const fetchChanges = (symptomsForChanges: EffectiveSymptom[]) => {
      fetch(
        `/api/symptoms/changes?surgeryId=${surgeryId}&symptomIds=${encodeURIComponent(
          symptomsForChanges.map(s => s.id).join(',')
        )}`,
        { cache: 'no-store', signal: controller.signal }
      )
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data?.changes) { setChangesMap(new Map()); return }
          const newMap = new Map<string, SymptomChangeInfo>()
          for (const [id, info] of Object.entries(data.changes)) {
            const ci = info as { changeType: 'new' | 'updated'; approvedAt: string }
            newMap.set(id, { changeType: ci.changeType, approvedAt: new Date(ci.approvedAt) })
          }
          setChangesMap(newMap)
        })
        .catch(() => setChangesMap(new Map()))
    }

    // Only re-fetch symptoms when switching surgeries — the server already provided initial data
    if (isSwitching) {
      setIsLoadingSymptoms(true)
      const cached = symptomCache.current[surgeryId]
      if (cached) {
        setSymptoms(cached)
      }

      fetch(`/api/symptoms?surgery=${surgeryId}`, { cache: 'no-store', signal: controller.signal })
        .then(response => response.json())
        .then(data => {
          if (data.symptoms && Array.isArray(data.symptoms)) {
            const sortedSymptoms = data.symptoms.sort((a: any, b: any) => a.name.localeCompare(b.name))
            setSymptoms(sortedSymptoms)
            symptomCache.current[surgeryId] = sortedSymptoms
            if (typeof window !== 'undefined') {
              try {
                const payload = JSON.stringify({ updatedAt: Date.now(), symptoms: sortedSymptoms })
                window.localStorage.setItem(getCacheKey(surgeryId), payload)
              } catch { /* quota exceeded, ignore */ }
            }
            // Fetch changes after symptoms arrive so we use the correct IDs
            fetchChanges(sortedSymptoms)
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingSymptoms(false))
    } else {
      // Initial load — initialSymptoms are correct for this surgery
      fetchChanges(initialSymptoms)
    }

    return () => controller.abort()
  }, [surgeryId, routeSurgeryId, getCacheKey, initialSymptoms])

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
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-4 h-4 bg-gray-200 rounded-full animate-pulse" />
        <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <SkeletonCardGrid count={8} lines={3} />
    </div>
  )

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      {/* Compact Toolbar */}
      <CompactToolbar
        variant="toolbar"
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
        {/* Welcome / Context Bar */}
        <div className="flex items-center gap-3 mb-6 px-4 py-3 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-nhs-blue/10 flex-shrink-0">
            <svg className="w-5 h-5 text-nhs-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="min-w-0">
            {surgeryName ? (
              <>
                <h1 className="text-sm font-semibold text-nhs-dark-blue truncate">{surgeryName}</h1>
                <p className="text-xs text-gray-500">How can we help your patient today?</p>
              </>
            ) : (
              <>
                <h1 className="text-sm font-semibold text-nhs-dark-blue">Signposting</h1>
                <p className="text-xs text-gray-500">Search by symptom to find the right service</p>
              </>
            )}
          </div>
          <div className="ml-auto text-xs text-gray-400 hidden sm:block whitespace-nowrap" aria-live="polite">
            {symptoms.length} symptom{symptoms.length !== 1 ? 's' : ''} available
          </div>
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
            changesMap={changesMap}
            cardData={cardData}
          />
        ) : (
          <EmptyState
            illustration="search"
            title="No symptoms found"
            description={
              searchTerm
                ? `No results for "${searchTerm}"${selectedAge !== 'All' || selectedLetter !== 'All' ? ' with the current filters' : ''}. Check for typos or try a broader term.`
                : selectedLetter !== 'All'
                  ? `No symptoms starting with "${selectedLetter}"${selectedAge !== 'All' ? ` for the selected age group` : ''}. Try a different letter or clear your filters.`
                  : 'No symptoms match your current filters. Try adjusting or clearing all filters.'
            }
            action={{
              label: searchTerm ? 'Clear Search' : 'Clear All Filters',
              onClick: () => {
                setSearchTerm('')
                setSelectedLetter('All')
                setSelectedAge('All')
              },
              variant: 'secondary',
            }}
            secondaryAction={
              searchTerm && (selectedAge !== 'All' || selectedLetter !== 'All')
                ? {
                    label: 'Keep search, reset other filters',
                    onClick: () => {
                      setSelectedLetter('All')
                      setSelectedAge('All')
                    },
                  }
                : undefined
            }
          />
        )}
      </main>
    </div>
  )
}

export default function HomePageClient(props: HomePageClientProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-nhs-light-grey">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <SkeletonCardGrid count={8} lines={3} />
        </div>
      </div>
    }>
      <HomePageClientContent {...props} />
    </Suspense>
  )
}
