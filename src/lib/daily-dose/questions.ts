import {
  DAILY_DOSE_QUIZ_MAX_QUESTIONS,
  DAILY_DOSE_QUIZ_MIN_QUESTIONS,
} from './constants'
import type {
  DailyDoseCardPayload,
  DailyDoseContentBlock,
  DailyDoseInteraction,
  DailyDoseQuestion,
  DailyDoseQuizQuestion,
} from './types'
import { getQuestionId } from './questionId'

export function extractQuestionsFromBlocks(card: DailyDoseCardPayload): DailyDoseQuestion[] {
  const blocks = card.contentBlocks || []
  const questions: DailyDoseQuestion[] = []

  blocks.forEach((block: DailyDoseContentBlock, index) => {
    if (block.type !== 'question') return
    const question: DailyDoseQuestion = {
      cardId: card.id,
      topicId: card.topicId,
      questionType: block.questionType,
      prompt: block.prompt,
      options: block.options,
      correctAnswer: block.correctAnswer,
      rationale: block.rationale,
      difficulty: block.difficulty,
      blockIndex: index,
      source: 'content',
    }
    question.questionId = getQuestionId(question)
    questions.push(question)
  })

  return questions
}

export function extractQuestionsFromInteractions(card: DailyDoseCardPayload): DailyDoseQuestion[] {
  const interactions = card.interactions ?? []
  return interactions.map((interaction: DailyDoseInteraction, index) => {
    const correctAnswer = interaction.options[interaction.correctIndex] ?? interaction.options[0] ?? ''
    const question: DailyDoseQuestion = {
      cardId: card.id,
      topicId: card.topicId,
      questionType:
        interaction.type === 'true_false'
          ? 'TRUE_FALSE'
          : interaction.type === 'choose_action'
            ? 'SCENARIO'
            : 'MCQ',
      prompt: interaction.question,
      options: interaction.options,
      correctAnswer,
      rationale: interaction.explanation,
      blockIndex: index,
      source: 'interaction',
    }
    question.questionId = getQuestionId(question)
    return question
  })
}

export function buildQuizQuestions(params: {
  coreCard: DailyDoseCardPayload
  recallCards: DailyDoseCardPayload[]
  extraCards: DailyDoseCardPayload[]
}): DailyDoseQuizQuestion[] {
  const pool: DailyDoseQuestion[] = []

  const coreQuestions = [
    ...extractQuestionsFromBlocks(params.coreCard),
    ...extractQuestionsFromInteractions(params.coreCard),
  ]
  pool.push(...coreQuestions)

  params.recallCards.forEach((card) => {
    const questions = [
      ...extractQuestionsFromBlocks(card),
      ...extractQuestionsFromInteractions(card),
    ]
    if (questions.length > 0) {
      pool.push(questions[0])
    }
  })

  if (pool.length < DAILY_DOSE_QUIZ_MAX_QUESTIONS) {
    params.extraCards.forEach((card) => {
      const questions = [
        ...extractQuestionsFromBlocks(card),
        ...extractQuestionsFromInteractions(card),
      ]
      questions.forEach((question) => {
        if (pool.length < DAILY_DOSE_QUIZ_MAX_QUESTIONS) {
          pool.push(question)
        }
      })
    })
  }

  const limited = pool.slice(0, DAILY_DOSE_QUIZ_MAX_QUESTIONS)
  const result = limited.map((question, index) => ({
    ...question,
    order: index + 1,
  }))

  if (result.length < DAILY_DOSE_QUIZ_MIN_QUESTIONS) {
    return result
  }

  return result
}
