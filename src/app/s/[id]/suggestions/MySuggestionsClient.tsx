'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Card, EmptyState } from '@/components/ui'
import SuggestFeatureDialog from '@/components/SuggestFeatureDialog'
import type { SuggestionRes } from '@/lib/api-contracts'
import {
  SUGGESTION_STATUS_BADGE_COLORS,
  SUGGESTION_STATUS_LABELS,
  SUGGESTION_TYPE_BADGE_COLORS,
  SUGGESTION_TYPE_LABELS,
  formatSuggestionDate,
} from '@/lib/suggestions'

interface MySuggestionsClientProps {
  surgeryId: string
  suggestions: SuggestionRes[]
}

export default function MySuggestionsClient({ surgeryId, suggestions }: MySuggestionsClientProps) {
  const router = useRouter()
  const [showSuggestDialog, setShowSuggestDialog] = useState(false)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">My suggestions</h1>
        <button
          type="button"
          onClick={() => setShowSuggestDialog(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-nhs-blue rounded-md hover:bg-nhs-dark-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
        >
          Suggest a feature
        </button>
      </div>
      <p className="text-sm text-nhs-grey mb-6">
        Feature requests, improvements, and other feedback you&apos;ve submitted, with their current
        status and any responses from the Signposting team.
      </p>

      {suggestions.length === 0 ? (
        <EmptyState
          illustration="clipboard"
          title="No suggestions yet"
          description="Ideas for new features, improvements, or bug reports are always welcome."
          action={{ label: 'Suggest a feature', onClick: () => setShowSuggestDialog(true) }}
        />
      ) : (
        <ul className="space-y-4">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <Card padding="lg">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge color={SUGGESTION_TYPE_BADGE_COLORS[suggestion.type]}>
                    {SUGGESTION_TYPE_LABELS[suggestion.type]}
                  </Badge>
                  <Badge color={SUGGESTION_STATUS_BADGE_COLORS[suggestion.status]} pill>
                    {SUGGESTION_STATUS_LABELS[suggestion.status]}
                  </Badge>
                  <span className="ml-auto text-xs text-nhs-grey">
                    {formatSuggestionDate(suggestion.createdAt)}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-nhs-dark-blue">
                  {suggestion.title || suggestion.symptom || 'Suggestion'}
                </h2>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{suggestion.text}</p>
                {suggestion.response ? (
                  <div className="mt-4 rounded-lg border-l-4 border-nhs-blue bg-blue-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-nhs-dark-blue">
                      Response from the Signposting team
                    </p>
                    <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">
                      {suggestion.response}
                    </p>
                    {suggestion.respondedAt ? (
                      <p className="mt-1 text-xs text-nhs-grey">
                        {formatSuggestionDate(suggestion.respondedAt)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <SuggestFeatureDialog
        open={showSuggestDialog}
        onClose={() => setShowSuggestDialog(false)}
        surgeryId={surgeryId}
        onSubmitted={() => router.refresh()}
      />
    </main>
  )
}
