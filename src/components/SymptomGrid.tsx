'use client'

import { useMemo } from 'react'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import SymptomCard, { SymptomChangeInfo, CardData } from './SymptomCard'
import { useSurgery } from '@/context/SurgeryContext'

interface SymptomGridProps {
  symptoms: EffectiveSymptom[]
  surgeryId?: string
  /** Map of symptom ID to change info (New/Updated badges) */
  changesMap?: Map<string, SymptomChangeInfo>
  /** Pre-fetched card data (highlights, image icons, settings) shared across all cards */
  cardData?: CardData
}

export default function SymptomGrid({
  symptoms,
  surgeryId,
  changesMap,
  cardData
}: SymptomGridProps) {
  const { currentSurgeryId } = useSurgery()

  // Use provided surgeryId or fall back to context.
  // This should match the `/s/[id]` route segment so symptom links remain consistent.
  const effectiveSurgeryId = surgeryId || currentSurgeryId
  // Ensure symptoms are sorted alphabetically
  const sortedSymptoms = useMemo(() =>
    [...symptoms].sort((a, b) => a.name.localeCompare(b.name)),
    [symptoms]
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {sortedSymptoms.map((symptom) => (
        // Every card is rendered — no virtualization or deferred painting. Windowing
        // approaches lag fast scrolling and leave blank gaps where cards should be.
        <div key={symptom.id}>
          <SymptomCard
            symptom={symptom}
            surgeryId={effectiveSurgeryId || undefined}
            changeInfo={changesMap?.get(symptom.id)}
            cardData={cardData}
          />
        </div>
      ))}
    </div>
  )
}
