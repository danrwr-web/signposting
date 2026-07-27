import type { SuggestionRes } from '@/lib/api-contracts'

export interface TriageUser {
  id: string
  name: string | null
  email: string
}

export interface TriageSuggestion extends SuggestionRes {
  submittedBy: TriageUser | null
  respondedBy: TriageUser | null
}
