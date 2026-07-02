'use client'

import { useState, useMemo, useEffect, Suspense, useDeferredValue, useRef, useCallback } from 'react'
import ClinicalReviewNotice from '@/components/ClinicalReviewNotice'
import CompactToolbar from '@/components/CompactToolbar'
import SymptomGrid from '@/components/SymptomGrid'
import BackToTopButton from '@/components/BackToTopButton'
import StickyFilterBar from '@/components/StickyFilterBar'
import TestUserUsage from '@/components/TestUserUsage'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import { CommonReasonsResolvedItem } from '@/lib/commonReasons'
import type { SelectorSurgery } from '@/components/SurgerySelector'
import { useSurgery } from '@/context/SurgeryContext'
import { SymptomChangeInfo, CardData } from '@/components/SymptomCard'
import { getSymptomSearchText } from '@/lib/symptomSearch'
import { SkeletonCardGrid } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

type Letter = 'All' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
type AgeBand = 'All' | 'Under5' | '5to17' | 'Adult'

interface HomePageClientProps {
  surgeries: SelectorSurgery[]
  symptoms: EffectiveSymptom[]
  // When rendered at `/s/[id]`, pass the canonical surgery id from the route.
  // This avoids relying on cookie/localStorage context, which may be stale or point to a different surgery.
  surgeryId?: string
  pendingClinicalReviewCount?: number
  surgeryName?: string
  commonReasonsItems?: CommonReasonsResolvedItem[]
}

function HomePageClientContent({ surgeries, symptoms: initialSymptoms, pendingClinicalReviewCount, surgeryName, surgeryId: routeSurgeryId, commonReasonsItems }: HomePageClientProps) {
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
  // Marks the bottom of the filter toolbar; StickyFilterBar shows once it scrolls out of view
  const toolbarSentinelRef = useRef<HTMLDivElement>(null)

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

  // Filter symptoms based on search, age group, and letter with useMemo for performance.
  // Search text is derived from the content the user is actually shown (stripped
  // instructionsHtml, falling back to legacy markdown) — see getSymptomSearchText.
  const lowerSearch = useMemo(() => deferredSearchTerm.trim().toLowerCase(), [deferredSearchTerm])
  const searchTextBySymptom = useMemo(
    () => new Map(symptoms.map(symptom => [symptom, getSymptomSearchText(symptom)])),
    [symptoms]
  )
  const filteredSymptoms = useMemo(() => {
    return symptoms.filter(symptom => {
      const matchesSearch = !lowerSearch ||
        (searchTextBySymptom.get(symptom) ?? '').includes(lowerSearch)
      
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
  }, [symptoms, searchTextBySymptom, lowerSearch, deferredSelectedAge, deferredSelectedLetter])

  const renderSkeletonGrid = () => (
    <SkeletonCardGrid count={8} lines={3} />
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
        totalCount={symptoms.length}
        showSurgerySelector={showSurgerySelector}
        onShowSurgerySelector={setShowSurgerySelector}
        symptoms={symptoms}
        commonReasonsItems={commonReasonsItems}
      />
      <div ref={toolbarSentinelRef} aria-hidden="true" />

      {/* Slim search + A-Z bar, shown once the toolbar has scrolled out of view */}
      <StickyFilterBar
        sentinelRef={toolbarSentinelRef}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedLetter={selectedLetter}
        onLetterChange={setSelectedLetter}
        symptoms={symptoms}
        resultsCount={filteredSymptoms.length}
        totalCount={symptoms.length}
      />

      {/* Clinical Review Notice — visible to all roles; tier depends on pending count */}
      {surgeryName && (
        <ClinicalReviewNotice pendingCount={pendingClinicalReviewCount ?? 0} surgeryName={surgeryName} />
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
          <SymptomGrid
            symptoms={filteredSymptoms}
            surgeryId={surgeryId || undefined}
            changesMap={changesMap}
            cardData={cardData}
          />
        ) : (
          <EmptyState
            illustration="search"
            title="No symptoms found"
            description="No symptoms match your current filters. Try adjusting your search or clearing all filters."
            action={{
              label: 'Clear Filters',
              onClick: () => {
                setSearchTerm('')
                setSelectedLetter('All')
                setSelectedAge('All')
              },
              variant: 'secondary',
            }}
          />
        )}
      </main>

      <BackToTopButton />
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
