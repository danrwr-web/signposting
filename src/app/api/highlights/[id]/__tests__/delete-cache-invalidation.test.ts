import { NextRequest } from 'next/server'
import { DELETE } from '../route'
import { prisma } from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { getSession } from '@/server/auth'
import { HIGHLIGHTS_TAG, getCachedHighlightsTag, deleteHighlightRule } from '@/server/highlights'

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

jest.mock('@/server/auth', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    highlightRule: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/server/highlights', () => {
  const actual = jest.requireActual('@/server/highlights')
  return {
    ...actual,
    deleteHighlightRule: jest.fn(),
  }
})

const makeReq = (url: string) => ({ url } as unknown as NextRequest)

describe('DELETE /api/highlights/[id] cache invalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('revalidates the global and surgery highlight tags', async () => {
    ;(getSession as jest.Mock).mockResolvedValueOnce({
      type: 'surgery',
      id: 'user-1',
      surgeryId: 's1',
    })

    ;(prisma.highlightRule.findUnique as jest.Mock).mockResolvedValueOnce({
      surgeryId: 's1',
    })

    ;(deleteHighlightRule as jest.Mock).mockResolvedValueOnce(undefined)

    const res = await DELETE(makeReq('http://localhost/api/highlights/hr-1'), {
      params: Promise.resolve({ id: 'hr-1' }),
    })

    expect(res.status).toBe(200)
    expect(deleteHighlightRule).toHaveBeenCalledWith('hr-1')

    expect(revalidateTag).toHaveBeenCalledWith(HIGHLIGHTS_TAG)
    expect(revalidateTag).toHaveBeenCalledWith(getCachedHighlightsTag('s1'))
  })
})

