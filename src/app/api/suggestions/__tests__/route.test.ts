import { NextRequest } from 'next/server'
import { GET, POST, PATCH } from '../route'
import { prisma } from '@/lib/prisma'
import { getSessionUser, can } from '@/lib/rbac'
import { sendSuggestionNotificationEmail } from '@/lib/email'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    suggestion: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userSurgery: {
      count: jest.fn(),
    },
  },
}))

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
  can: jest.fn(),
}))

jest.mock('@/lib/email', () => ({
  sendSuggestionNotificationEmail: jest.fn(),
}))

const mockedGetSessionUser = getSessionUser as jest.MockedFunction<typeof getSessionUser>
const mockedCan = can as unknown as jest.MockedFunction<typeof can>
const mockedSendEmail = sendSuggestionNotificationEmail as jest.MockedFunction<
  typeof sendSuggestionNotificationEmail
>

const baseUser = { id: 'u1', email: 'user@example.com', globalRole: 'USER', memberships: [] }

const dbSuggestion = {
  id: 'sug1',
  type: 'FEATURE',
  status: 'PENDING',
  surgeryId: 'sur-1',
  baseId: null,
  symptom: null,
  title: 'Dark mode',
  text: 'Please add dark mode',
  pageContext: '/s/sur-1/signposting',
  userEmail: 'user@example.com',
  submittedByUserId: 'u1',
  response: null,
  respondedByUserId: null,
  respondedAt: null,
  responseViewedAt: null,
  redirectedFromType: null,
  redirectedAt: null,
  legacyAuditJson: null,
  createdAt: new Date('2026-07-01T10:00:00Z'),
  updatedAt: new Date('2026-07-01T10:00:00Z'),
  surgery: { id: 'sur-1', name: 'Test Surgery', slug: 'test' },
}

const makeGetReq = (query = '') =>
  ({ url: `http://localhost/api/suggestions${query}` } as unknown as NextRequest)

const makeBodyReq = (body: unknown) =>
  ({
    url: 'http://localhost/api/suggestions',
    json: async () => body,
  } as unknown as NextRequest)

const mockChecker = (overrides: Record<string, unknown> = {}) => {
  mockedCan.mockReturnValue({
    isSuperuser: () => false,
    viewSurgery: () => true,
    getAdminSurgeryIds: () => [],
    ...overrides,
  } as any)
}

describe('/api/suggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetSessionUser.mockResolvedValue(baseUser as any)
    mockChecker()
    ;(prisma.suggestion.findMany as jest.Mock).mockResolvedValue([dbSuggestion])
    ;(prisma.suggestion.count as jest.Mock).mockResolvedValue(1)
    ;(prisma.suggestion.create as jest.Mock).mockResolvedValue(dbSuggestion)
  })

  describe('POST', () => {
    it('returns 401 when unauthenticated', async () => {
      mockedGetSessionUser.mockResolvedValue(null)
      const res = await POST(makeBodyReq({ type: 'FEATURE', title: 'X', text: 'Y' }))
      expect(res.status).toBe(401)
    })

    it('rejects a FEATURE suggestion without a title', async () => {
      const res = await POST(makeBodyReq({ type: 'FEATURE', text: 'No title here' }))
      expect(res.status).toBe(400)
      expect(prisma.suggestion.create).not.toHaveBeenCalled()
    })

    it('accepts a SYMPTOM_CONTENT suggestion without a title', async () => {
      const res = await POST(
        makeBodyReq({ type: 'SYMPTOM_CONTENT', symptom: 'Headache', text: 'Add more detail' })
      )
      expect(res.status).toBe(201)
    })

    it('rejects when the user cannot view the surgery', async () => {
      mockChecker({ viewSurgery: () => false })
      const res = await POST(
        makeBodyReq({ type: 'FEATURE', title: 'X', text: 'Y', surgeryId: 'other-surgery' })
      )
      expect(res.status).toBe(403)
    })

    it('stores the submitter and sends a notification email', async () => {
      const res = await POST(
        makeBodyReq({ type: 'FEATURE', title: 'Dark mode', text: 'Please add dark mode', surgeryId: 'sur-1' })
      )
      expect(res.status).toBe(201)
      expect(prisma.suggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            submittedByUserId: 'u1',
            userEmail: 'user@example.com',
          }),
        })
      )
      expect(mockedSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'FEATURE', submitterEmail: 'user@example.com' })
      )
    })

    it('sends no email for symptom-content suggestions when the surgery has admins', async () => {
      // Surgery admins see these in their Suggestions tab (badged via
      // suggestionsPendingCount), so no notification email is needed.
      ;(prisma.suggestion.create as jest.Mock).mockResolvedValue({
        ...dbSuggestion,
        type: 'SYMPTOM_CONTENT',
        title: null,
        symptom: 'Headache',
      })
      ;(prisma.userSurgery.count as jest.Mock).mockResolvedValue(2)
      const res = await POST(
        makeBodyReq({ type: 'SYMPTOM_CONTENT', symptom: 'Headache', text: 'Update', surgeryId: 'sur-1' })
      )
      expect(res.status).toBe(201)
      expect(prisma.userSurgery.count).toHaveBeenCalledWith({
        where: { surgeryId: 'sur-1', role: 'ADMIN' },
      })
      expect(mockedSendEmail).not.toHaveBeenCalled()
    })

    it('emails the central team for symptom-content suggestions when the surgery has no admins', async () => {
      // Nobody would see the admin badge, so the central fallback is the only signal.
      ;(prisma.suggestion.create as jest.Mock).mockResolvedValue({
        ...dbSuggestion,
        type: 'SYMPTOM_CONTENT',
        title: null,
        symptom: 'Headache',
      })
      ;(prisma.userSurgery.count as jest.Mock).mockResolvedValue(0)
      const res = await POST(
        makeBodyReq({ type: 'SYMPTOM_CONTENT', symptom: 'Headache', text: 'Update', surgeryId: 'sur-1' })
      )
      expect(res.status).toBe(201)
      expect(mockedSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SYMPTOM_CONTENT' })
      )
    })

    it('still emails the central team for symptom-content suggestions without a surgery', async () => {
      // Without a surgery there are no admins to see the in-app queue, and the
      // central triage hides symptom-content by default — email is the only signal.
      ;(prisma.suggestion.create as jest.Mock).mockResolvedValue({
        ...dbSuggestion,
        type: 'SYMPTOM_CONTENT',
        surgeryId: null,
        surgery: null,
        title: null,
        symptom: 'Headache',
      })
      const res = await POST(
        makeBodyReq({ type: 'SYMPTOM_CONTENT', symptom: 'Headache', text: 'Update' })
      )
      expect(res.status).toBe(201)
      expect(mockedSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SYMPTOM_CONTENT' })
      )
    })

    it('still succeeds when the notification email fails', async () => {
      mockedSendEmail.mockRejectedValue(new Error('SMTP down'))
      const res = await POST(makeBodyReq({ type: 'BUG', title: 'Broken', text: 'It broke' }))
      expect(res.status).toBe(201)
    })
  })

  describe('GET', () => {
    it('returns 401 when unauthenticated', async () => {
      mockedGetSessionUser.mockResolvedValue(null)
      const res = await GET(makeGetReq())
      expect(res.status).toBe(401)
    })

    it('defaults to the caller\'s own suggestions (scope=mine)', async () => {
      const res = await GET(makeGetReq())
      expect(res.status).toBe(200)
      expect(prisma.suggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ submittedByUserId: 'u1' }, { userEmail: 'user@example.com' }],
          }),
        })
      )
    })

    it('scope=surgery restricts non-admins with no admin surgeries to an empty list', async () => {
      const res = await GET(makeGetReq('?scope=surgery'))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual({ suggestions: [], unreadCount: 0 })
    })

    it('scope=surgery limits admins to symptom-content suggestions from their surgeries', async () => {
      mockChecker({ getAdminSurgeryIds: () => ['sur-1'] })
      const res = await GET(makeGetReq('?scope=surgery'))
      expect(res.status).toBe(200)
      expect(prisma.suggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'SYMPTOM_CONTENT',
            surgeryId: { in: ['sur-1'] },
          }),
        })
      )
    })

    it('scope=surgery orders by latest activity so redirected items are not buried', async () => {
      mockChecker({ getAdminSurgeryIds: () => ['sur-1'] })
      await GET(makeGetReq('?scope=surgery'))
      expect(prisma.suggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { updatedAt: 'desc' } })
      )
    })

    it('scope=mine keeps submission order', async () => {
      await GET(makeGetReq())
      expect(prisma.suggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } })
      )
    })

    it('counts unread responses for the caller\'s own suggestions', async () => {
      ;(prisma.suggestion.count as jest.Mock).mockResolvedValueOnce(1).mockResolvedValueOnce(2)
      const res = await GET(makeGetReq())
      const json = await res.json()
      expect(json.unreadResponseCount).toBe(2)
      expect(prisma.suggestion.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          response: { not: null },
          responseViewedAt: null,
        }),
      })
    })

    it('rejects an invalid status filter', async () => {
      const res = await GET(makeGetReq('?status=nonsense'))
      expect(res.status).toBe(400)
    })

    it('never exposes legacy audit data or responder ids to submitters', async () => {
      ;(prisma.suggestion.findMany as jest.Mock).mockResolvedValue([
        {
          ...dbSuggestion,
          legacyAuditJson: '[{"action":"actioned","userEmail":"admin@example.com"}]',
          respondedByUserId: 'super1',
        },
      ])
      const res = await GET(makeGetReq())
      const json = await res.json()
      expect(json.suggestions[0]).not.toHaveProperty('legacyAuditJson')
      expect(json.suggestions[0]).not.toHaveProperty('respondedByUserId')
    })
  })

  describe('PATCH', () => {
    beforeEach(() => {
      ;(prisma.suggestion.findUnique as jest.Mock).mockResolvedValue({
        ...dbSuggestion,
        type: 'SYMPTOM_CONTENT',
      })
      ;(prisma.suggestion.update as jest.Mock).mockResolvedValue({
        ...dbSuggestion,
        type: 'SYMPTOM_CONTENT',
        status: 'DONE',
      })
    })

    it('rejects legacy lowercase status values', async () => {
      const res = await PATCH(makeBodyReq({ suggestionId: 'sug1', status: 'actioned' }))
      expect(res.status).toBe(400)
    })

    it('denies non-admins of the surgery', async () => {
      const res = await PATCH(makeBodyReq({ suggestionId: 'sug1', status: 'DONE' }))
      expect(res.status).toBe(403)
    })

    it('denies surgery admins triaging non-symptom suggestions', async () => {
      mockChecker({ getAdminSurgeryIds: () => ['sur-1'] })
      ;(prisma.suggestion.findUnique as jest.Mock).mockResolvedValue({
        ...dbSuggestion,
        type: 'FEATURE',
      })
      const res = await PATCH(makeBodyReq({ suggestionId: 'sug1', status: 'DONE' }))
      expect(res.status).toBe(403)
    })

    it('lets surgery admins update their symptom-content suggestions', async () => {
      mockChecker({ getAdminSurgeryIds: () => ['sur-1'] })
      const res = await PATCH(makeBodyReq({ suggestionId: 'sug1', status: 'DONE' }))
      expect(res.status).toBe(200)
      expect(prisma.suggestion.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'DONE' } })
      )
    })
  })
})
