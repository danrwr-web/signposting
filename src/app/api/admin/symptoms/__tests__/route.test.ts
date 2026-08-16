/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { GET } from '../route'
import { getSessionUser } from '@/lib/rbac'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/rbac', () => {
  const actual = jest.requireActual('@/lib/rbac')
  return { ...actual, getSessionUser: jest.fn() }
})

jest.mock('@/server/effectiveSymptoms', () => ({
  getEffectiveSymptoms: jest.fn(),
  getCachedSymptomsTag: (surgeryId: string, d: boolean) => `symptoms:${surgeryId}:${d}`,
}))

jest.mock('next/cache', () => ({ revalidateTag: jest.fn() }))

jest.mock('@/lib/prisma', () => ({
  prisma: { baseSymptom: { findMany: jest.fn() } },
}))

const mockedSession = getSessionUser as jest.MockedFunction<typeof getSessionUser>
const mockedEffective = getEffectiveSymptoms as jest.MockedFunction<typeof getEffectiveSymptoms>
const mockedBaseFindMany = prisma.baseSymptom.findMany as jest.Mock

const makeReq = (url: string): NextRequest =>
  ({ url: `http://localhost${url}` }) as unknown as NextRequest

const symptom = (id: string, name: string) => ({
  id,
  slug: name.toLowerCase(),
  name,
  ageGroup: 'Adult',
  source: 'base' as const,
})

describe('GET /api/admin/symptoms', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedEffective.mockResolvedValue([symptom('s1', 'Chest pain')] as never)
    mockedBaseFindMany.mockResolvedValue([])
  })

  it('returns the named practice\'s library to a superuser, not the global base list', async () => {
    // The bug this covers: the parameter was accepted and ignored, so a
    // superuser on another practice's AI Setup page was shown — and would have
    // run "Customise ALL" against — every base symptom on the platform,
    // missing that practice's own custom symptoms.
    mockedSession.mockResolvedValue({
      id: 'u1',
      email: 'super@example.com',
      globalRole: 'SUPERUSER',
      memberships: [],
    } as never)

    const res = await GET(makeReq('/api/admin/symptoms?surgeryId=surgery-b'))

    expect(res.status).toBe(200)
    expect(mockedEffective).toHaveBeenCalledWith('surgery-b')
    expect(mockedBaseFindMany).not.toHaveBeenCalled()
  })

  it('uses the named practice, not the member\'s default one', async () => {
    mockedSession.mockResolvedValue({
      id: 'u1',
      email: 'admin@example.com',
      globalRole: 'USER',
      defaultSurgeryId: 'surgery-a',
      memberships: [
        { surgeryId: 'surgery-a', role: 'ADMIN' },
        { surgeryId: 'surgery-b', role: 'ADMIN' },
      ],
    } as never)

    await GET(makeReq('/api/admin/symptoms?surgeryId=surgery-b'))

    expect(mockedEffective).toHaveBeenCalledWith('surgery-b')
  })

  it('refuses a practice the caller is not a member of', async () => {
    mockedSession.mockResolvedValue({
      id: 'u1',
      email: 'admin@example.com',
      globalRole: 'USER',
      defaultSurgeryId: 'surgery-a',
      memberships: [{ surgeryId: 'surgery-a', role: 'ADMIN' }],
    } as never)

    const res = await GET(makeReq('/api/admin/symptoms?surgeryId=surgery-b'))

    expect(res.status).toBe(403)
    expect(mockedEffective).not.toHaveBeenCalled()
  })

  it('falls back to the default practice when no surgery is named', async () => {
    mockedSession.mockResolvedValue({
      id: 'u1',
      email: 'admin@example.com',
      globalRole: 'USER',
      defaultSurgeryId: 'surgery-a',
      memberships: [{ surgeryId: 'surgery-a', role: 'ADMIN' }],
    } as never)

    await GET(makeReq('/api/admin/symptoms'))

    expect(mockedEffective).toHaveBeenCalledWith('surgery-a')
  })

  it('still gives a superuser the global base list when no surgery is named', async () => {
    // /admin relies on this — the change must not alter the unparameterised call.
    mockedSession.mockResolvedValue({
      id: 'u1',
      email: 'super@example.com',
      globalRole: 'SUPERUSER',
      memberships: [],
    } as never)

    await GET(makeReq('/api/admin/symptoms'))

    expect(mockedBaseFindMany).toHaveBeenCalled()
    expect(mockedEffective).not.toHaveBeenCalled()
  })

  it('requires a session', async () => {
    mockedSession.mockResolvedValue(null)

    const res = await GET(makeReq('/api/admin/symptoms?surgeryId=surgery-b'))

    expect(res.status).toBe(401)
    expect(mockedEffective).not.toHaveBeenCalled()
  })
})
