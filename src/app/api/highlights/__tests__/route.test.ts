import { POST } from '../route'
import { PATCH } from '../[id]/route'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/server/auth'

jest.mock('next/cache', () => ({
  // Used by highlight mutations for cache invalidation.
  revalidateTag: jest.fn(),
  // Used by server caching helpers in some modules.
  unstable_cache: (fn: any) => fn,
  unstable_noStore: jest.fn(),
}))

jest.mock('@/server/auth', () => ({
  getSession: jest.fn(),
}))

type StoredRule = {
  id: string
  surgeryId: string | null
  phrase: string
  textColor: string
  bgColor: string
  isEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

let store: StoredRule[] = []
let idSeq = 1

jest.mock('@/lib/prisma', () => {
  const mock = {
    highlightRule: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          store.find((r) => {
            const sameScope = (r.surgeryId ?? null) === (where?.surgeryId ?? null)
            const samePhrase = r.phrase === where?.phrase
            const notId = where?.id?.not ? r.id !== where.id.not : true
            return sameScope && samePhrase && notId
          }) ?? null
        )
      }),
      findUnique: jest.fn(async ({ where, select }: any) => {
        const found = store.find((r) => r.id === where?.id) ?? null
        if (!found) return null
        if (!select) return found
        const shaped: any = {}
        for (const key of Object.keys(select)) {
          shaped[key] = (found as any)[key]
        }
        return shaped
      }),
      create: jest.fn(async ({ data }: any) => {
        const now = new Date()
        const rule: StoredRule = {
          id: `hr-${idSeq++}`,
          surgeryId: data.surgeryId ?? null,
          phrase: data.phrase,
          textColor: data.textColor,
          bgColor: data.bgColor,
          isEnabled: data.isEnabled ?? true,
          createdAt: now,
          updatedAt: now,
        }
        store.push(rule)
        return rule
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = store.findIndex((r) => r.id === where?.id)
        if (idx === -1) throw new Error('Not found')
        store[idx] = {
          ...store[idx],
          ...data,
          updatedAt: new Date(),
        }
        return store[idx]
      }),
    },
    surgery: {
      findUnique: jest.fn(),
    },
  }

  return { prisma: mock }
})

const asJsonRequest = (body: any) => ({ json: async () => body } as unknown as NextRequest)

describe('Highlight rules API', () => {
  beforeEach(() => {
    store = []
    idSeq = 1
    jest.clearAllMocks()

    ;(getSession as jest.Mock).mockResolvedValue({
      type: 'surgery',
      id: 'user-1',
      email: 'admin@example.com',
      surgeryId: 's1',
    })
  })

  it('creates a rule, edits the same rule (no 409), and duplicate create returns 409', async () => {
    const createRes = await POST(
      asJsonRequest({
        phrase: '  Pharmacy  ',
        textColor: '#ffffff',
        bgColor: '#000000',
        isEnabled: true,
        surgeryId: 's1',
        isGlobal: false,
      })
    )

    expect(createRes.status).toBe(201)
    const createJson = await createRes.json()
    expect(createJson.rule.phrase).toBe('pharmacy')
    expect(store).toHaveLength(1)

    const ruleId = store[0].id

    const updateRes = await PATCH(
      asJsonRequest({
        phrase: 'Pharmacy',
        textColor: '#111111',
        bgColor: '#222222',
        isEnabled: true,
      }),
      { params: Promise.resolve({ id: ruleId }) }
    )

    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.id).toBe(ruleId)
    expect(updated.phrase).toBe('pharmacy')
    expect(updated.textColor).toBe('#111111')

    const dupRes = await POST(
      asJsonRequest({
        phrase: 'pharmacy',
        textColor: '#ffffff',
        bgColor: '#000000',
        isEnabled: true,
        surgeryId: 's1',
        isGlobal: false,
      })
    )

    expect(dupRes.status).toBe(409)
    const dupJson = await dupRes.json()
    expect(dupJson.error).toMatch(/already exists/i)

    expect((prisma as any).highlightRule.findFirst).toHaveBeenCalled()
  })
})

