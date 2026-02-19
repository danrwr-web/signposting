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

function blockToText(block: DailyDoseContentBlock): string | null {
  if (block.type === 'paragraph' || block.type === 'text' || block.type === 'callout' || block.type === 'reveal') {
    return block.text?.trim() || null
  }
  if (block.type === 'steps' || block.type === 'do-dont') {
    return block.items?.length ? block.items.join(' ').trim() : null
  }
  return null
}

function buildQuestionContext(
  card: DailyDoseCardPayload,
  options: { blockIndex?: number; source: 'content' | 'interaction' }
): string | undefined {
  const blocks = card.contentBlocks || []
  let textParts: string[] = []
  if (card.title?.trim()) textParts.push(card.title.trim())

  if (options.source === 'content' && options.blockIndex !== undefined) {
    for (let i = 0; i < options.blockIndex; i++) {
      const t = blockToText(blocks[i])
      if (t) textParts.push(t)
    }
  } else {
    for (const block of blocks) {
      if (block.type === 'question') continue
      const t = blockToText(block)
      if (t) textParts.push(t)
    }
  }

  const joined = textParts.join(' ').trim()
  return joined || undefined
}

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
      context: buildQuestionContext(card, { blockIndex: index, source: 'content' }),
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
      context: buildQuestionContext(card, { source: 'interaction' }),
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
