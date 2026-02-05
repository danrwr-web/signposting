import type { DailyDoseQuestion } from './types'
import { createHash } from 'crypto'

/**
 * Generate a deterministic question ID from question content.
 * This ensures the same question always gets the same ID, even if it appears
 * in different cards or contexts.
 */
export function generateQuestionId(question: {
  prompt: string
  options: string[]
  correctAnswer: string
  questionType: string
}): string {
  // Normalize the question data for consistent hashing
  const normalized = {
    prompt: question.prompt.trim().toLowerCase(),
    options: question.options.map((opt) => opt.trim().toLowerCase()).sort(),
    correctAnswer: question.correctAnswer.trim().toLowerCase(),
    type: question.questionType,
  }

  const hashInput = JSON.stringify(normalized)
  const hash = createHash('sha256').update(hashInput).digest('hex')
  
  // Return first 16 chars for readability (collision risk is very low)
  return `q_${hash.substring(0, 16)}`
}

/**
 * Extract question ID from a DailyDoseQuestion.
 * Uses the question content to generate a stable ID.
 */
export function getQuestionId(question: DailyDoseQuestion): string {
  return generateQuestionId({
    prompt: question.prompt,
    options: question.options,
    correctAnswer: question.correctAnswer,
    questionType: question.questionType,
  })
}
