import { POST as postProfile } from '../profile/route'
import { POST as postStart } from '../session/start/route'
import { POST as postComplete } from '../session/complete/route'
import { POST as postPublish } from '../admin/cards/[id]/publish/route'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    dailyDoseProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    dailyDoseSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    dailyDoseTopic: {
      findMany: jest.fn(),
    },
    dailyDoseCard: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    dailyDoseUserCardState: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    dailyDoseCardVersion: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

const mockedGetSessionUser = getSessionUser as jest.MockedFunction<typeof getSessionUser>

const createJsonRequest = (body: object) =>
  ({
    json: jest.fn().mockResolvedValue(body),
  } as any)

describe('Daily Dose flow smoke tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('supports onboarding → session → completion', async () => {
    mockedGetSessionUser.mockResolvedValue({
      id: 'user-1',
      globalRole: 'USER',
      defaultSurgeryId: 'surgery-1',
      memberships: [{ surgeryId: 'surgery-1', role: 'ADMIN' }],
    } as any)

    ;(prisma.dailyDoseProfile.upsert as jest.Mock).mockResolvedValue({
      id: 'profile-1',
      onboardingCompleted: true,
      role: 'ADMIN',
    })

    const profileRequest = createJsonRequest({
      surgeryId: 'surgery-1',
      role: 'ADMIN',
      preferences: { weekdayOnlyStreak: true, chosenFocusTopicIds: [], baselineConfidence: 3 },
      onboardingCompleted: true,
    })
    const profileResponse = await postProfile(profileRequest)
    expect(profileResponse.status).toBe(200)

    ;(prisma.dailyDoseProfile.findUnique as jest.Mock).mockResolvedValue({
      id: 'profile-1',
      onboardingCompleted: true,
      role: 'ADMIN',
      preferences: { chosenFocusTopicIds: [] },
    })
    ;(prisma.dailyDoseSession.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.dailyDoseTopic.findMany as jest.Mock).mockResolvedValue([
      { id: 'topic-1', name: 'Demo', roleScope: ['ADMIN'], ordering: 0 },
    ])
    ;(prisma.dailyDoseCard.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'card-1',
        title: 'Demo card',
        topicId: 'topic-1',
        topic: { name: 'Demo' },
        roleScope: ['ADMIN'],
        contentBlocks: [
          {
            type: 'question',
            questionType: 'MCQ',
            prompt: 'Pick one',
            options: ['A', 'B'],
            correctAnswer: 'A',
            rationale: 'Because demo.',
          },
        ],
        sources: [{ title: 'Demo', org: 'Demo', url: 'https://example.com' }],
        reviewByDate: null,
        version: 1,
        status: 'PUBLISHED',
        tags: [],
        updatedAt: new Date(),
      },
    ])
    ;(prisma.dailyDoseUserCardState.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.dailyDoseSession.create as jest.Mock).mockResolvedValue({ id: 'session-1' })

    const startRequest = createJsonRequest({
      surgeryId: 'surgery-1',
    })
    const startResponse = await postStart(startRequest)
    expect(startResponse.status).toBe(200)

    ;(prisma.dailyDoseSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      completedAt: null,
    })

    const tx = {
      dailyDoseSession: { update: jest.fn() },
      dailyDoseUserCardState: { update: jest.fn(), create: jest.fn() },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback(tx))

    const completeRequest = createJsonRequest({
      sessionId: 'session-1',
      surgeryId: 'surgery-1',
      cardResults: [{ cardId: 'card-1', correctCount: 1, questionCount: 1 }],
    })
    const completeResponse = await postComplete(completeRequest)
    expect(completeResponse.status).toBe(200)
  })

  it('publishes cards for use in sessions', async () => {
    mockedGetSessionUser.mockResolvedValue({
      id: 'admin-1',
      globalRole: 'SUPERUSER',
      defaultSurgeryId: 'surgery-1',
      memberships: [{ surgeryId: 'surgery-1', role: 'ADMIN' }],
    } as any)

    ;(prisma.dailyDoseCard.findUnique as jest.Mock).mockResolvedValue({
      id: 'card-1',
      surgeryId: 'surgery-1',
      status: 'APPROVED',
      version: 1,
      title: 'Demo card',
      roleScope: ['ADMIN'],
      topicId: 'topic-1',
      contentBlocks: [],
      sources: [],
      reviewByDate: null,
      tags: [],
      approvedBy: null,
      approvedAt: null,
    })

    const tx = {
      dailyDoseCardVersion: { create: jest.fn() },
      dailyDoseCard: { update: jest.fn().mockResolvedValue({ status: 'PUBLISHED' }) },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback(tx))

    const publishRequest = new Request(
      'https://example.com/api/daily-dose/admin/cards/card-1/publish?surgeryId=surgery-1',
      { method: 'POST' }
    )
    const publishResponse = await postPublish(publishRequest as unknown as Request, {
      params: Promise.resolve({ id: 'card-1' }),
    })

    expect(publishResponse.status).toBe(200)
    expect(tx.dailyDoseCard.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED' }) })
    )
  })
})
