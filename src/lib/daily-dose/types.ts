import type { DailyDoseQuestionType, DailyDoseRole } from './constants'

export type DailyDoseContentBlock =
  | {
      type: 'paragraph'
      text: string
    }
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'callout'
      text: string
    }
  | {
      type: 'steps'
      items: string[]
    }
  | {
      type: 'do-dont'
      items: string[]
    }
  | {
      type: 'reveal'
      text: string
    }
  | {
      type: 'question'
      questionType: DailyDoseQuestionType
      prompt: string
      options: string[]
      correctAnswer: string
      rationale: string
      difficulty?: number
    }

export type DailyDoseSource = {
  title: string
  org?: string
  publisher?: string
  url: string
  publishedDate?: string
  accessedDate?: string
}

export type DailyDoseCardPayload = {
  id: string
  title: string
  topicId: string
  topicName?: string
  roleScope: DailyDoseRole[]
  contentBlocks: DailyDoseContentBlock[]
  interactions?: DailyDoseInteraction[]
  sources: DailyDoseSource[]
  reviewByDate?: string | null
  version: number
  status: string
  tags?: string[]
}

export type DailyDoseInteraction = {
  type: 'mcq' | 'true_false' | 'choose_action'
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export type DailyDoseQuestion = {
  cardId: string
  topicId: string
  questionType: DailyDoseQuestionType
  prompt: string
  options: string[]
  correctAnswer: string
  rationale: string
  difficulty?: number
  blockIndex: number
  source: 'content' | 'interaction'
  questionId?: string // Deterministic ID for tracking
}

export type DailyDoseQuizQuestion = DailyDoseQuestion & {
  order: number
}

export type DailyDoseCardResult = {
  cardId: string
  correctCount: number
  questionCount: number
  questionIds?: string[] // Question IDs answered in this session
}
