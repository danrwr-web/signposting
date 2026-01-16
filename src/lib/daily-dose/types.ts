import type { DailyDoseQuestionType, DailyDoseRole } from './constants'

export type DailyDoseContentBlock =
  | {
      type: 'paragraph'
      text: string
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
  org: string
  url: string
  publishedDate?: string
}

export type DailyDoseCardPayload = {
  id: string
  title: string
  topicId: string
  topicName?: string
  roleScope: DailyDoseRole[]
  contentBlocks: DailyDoseContentBlock[]
  sources: DailyDoseSource[]
  reviewByDate?: string | null
  version: number
  status: string
  tags?: string[]
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
}

export type DailyDoseQuizQuestion = DailyDoseQuestion & {
  order: number
}

export type DailyDoseCardResult = {
  cardId: string
  correctCount: number
  questionCount: number
}
