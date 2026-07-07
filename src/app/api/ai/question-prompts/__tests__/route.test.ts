import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSessionUser } from '@/lib/rbac'
import { isFeatureEnabledForUser } from '@/lib/features'
import { callAzureOpenAI } from '@/server/azureOpenAI'

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/lib/features', () => ({
  isFeatureEnabledForUser: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    tokenUsageLog: { create: jest.fn() },
  },
}))

jest.mock('@/server/azureOpenAI', () => ({
  callAzureOpenAI: jest.fn(),
  extractJson: jest.fn((raw: string) => {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }),
  AzureOpenAIError: class AzureOpenAIError extends Error {
    status = 500
    clientMessage = 'AI unavailable'
  },
}))

const mockedGetSessionUser = getSessionUser as jest.Mock
const mockedIsFeatureEnabled = isFeatureEnabledForUser as jest.Mock
const mockedCallAzureOpenAI = callAzureOpenAI as jest.Mock

const createRequest = (body: any) =>
  ({
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest)

const aiResponse = (content: object) => ({
  content: JSON.stringify(content),
  model: 'gpt-4o-mini',
  usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
})

const baseBody = {
  symptomName: 'Cough',
  instructionsText: 'If breathless, call 999. Otherwise book a routine appointment.',
}

describe('POST /api/ai/question-prompts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetSessionUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' })
    mockedIsFeatureEnabled.mockResolvedValue(true)
    mockedCallAzureOpenAI.mockResolvedValue(
      aiResponse({ symptom: 'Cough', ageGroup: 'Adult', groups: [{ label: 'Red flags', questions: ['Are you breathless?'] }] })
    )
  })

  it('rejects requests with neither ageGroup nor allAges', async () => {
    const res = await POST(createRequest(baseBody))
    expect(res.status).toBe(400)
    expect(mockedCallAzureOpenAI).not.toHaveBeenCalled()
  })

  it('keeps the age-specific prompt when ageGroup is provided', async () => {
    const res = await POST(createRequest({ ...baseBody, ageGroup: 'Adult' }))
    expect(res.status).toBe(200)

    const prompt = mockedCallAzureOpenAI.mock.calls[0][0].messages[1].content as string
    expect(prompt).toContain('AGE GROUP: "Adult"')
    expect(prompt).not.toContain('covers ALL AGES')
    expect(prompt).not.toContain('age-establishing question')
  })

  it('uses the all-ages prompt framing when allAges is set', async () => {
    mockedCallAzureOpenAI.mockResolvedValueOnce(
      aiResponse({ symptom: 'Cough', ageGroup: 'All ages', groups: [{ label: 'Red flags', questions: ['How old is the patient?'] }] })
    )
    const res = await POST(createRequest({ ...baseBody, allAges: true }))
    expect(res.status).toBe(200)

    const prompt = mockedCallAzureOpenAI.mock.calls[0][0].messages[1].content as string
    expect(prompt).toContain('covers ALL AGES')
    expect(prompt).toContain('age-establishing question')
    expect(prompt).not.toContain('AGE GROUP: "undefined"')

    const json = await res.json()
    expect(json.ageGroup).toBe('All ages')
  })

  it('falls back to "All ages" when the AI omits ageGroup in all-ages mode', async () => {
    mockedCallAzureOpenAI.mockResolvedValueOnce(
      aiResponse({ symptom: 'Cough', groups: [{ label: 'Red flags', questions: ['How old is the patient?'] }] })
    )
    const res = await POST(createRequest({ ...baseBody, allAges: true }))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.ageGroup).toBe('All ages')
  })
})
