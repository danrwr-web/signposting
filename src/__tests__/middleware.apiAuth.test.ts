/**
 * Middleware gate on API writes.
 *
 * The middleware previously only covered /admin and /s/, so any /api route that
 * forgot its own auth check was reachable by anyone — including one that deleted
 * every user, surgery and base symptom. These tests pin the two things that
 * matter: anonymous writes are refused, and the sign-in path stays open.
 */
import { NextRequest } from 'next/server'
import middleware from '@/middleware'
import { signLegacySession } from '@/lib/legacySessionCookie'

const SECRET = 'test-secret-value'

const getToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => getToken(...args),
}))

// withAuth is only exercised on /admin and /s/ paths, which these tests avoid.
jest.mock('next-auth/middleware', () => ({
  withAuth: () => jest.fn(),
}))

type RequestOptions = { method?: string; cookie?: string; host?: string }

function request(pathname: string, { method = 'POST', cookie, host = 'app.signpostingtool.co.uk' }: RequestOptions = {}) {
  const headers = new Headers({ host })
  if (cookie) headers.set('cookie', cookie)
  return new NextRequest(`https://${host}${pathname}`, { method, headers })
}

beforeEach(() => {
  jest.clearAllMocks()
  getToken.mockResolvedValue(null)
  process.env.NEXTAUTH_SECRET = SECRET
})

describe('API write gate', () => {
  it('refuses an anonymous write with 401 rather than letting it through', async () => {
    const res = await middleware(request('/api/admin/surgeries'))

    expect(res?.status).toBe(401)
    await expect(res?.clone().json()).resolves.toEqual({ error: 'Authentication required' })
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('refuses anonymous %s', async (method) => {
    const res = await middleware(request('/api/admin/users/abc', { method }))
    expect(res?.status).toBe(401)
  })

  it('refuses a route that has no auth check of its own', async () => {
    // The class of bug this exists to contain: a handler that forgets to check.
    const res = await middleware(request('/api/image-icons'))
    expect(res?.status).toBe(401)
  })

  it('allows the write once a NextAuth session is present', async () => {
    getToken.mockResolvedValue({ sub: 'user-1' })

    const res = await middleware(request('/api/admin/surgeries'))

    expect(res?.status).not.toBe(401)
  })

  it('allows the write with a validly signed legacy session cookie', async () => {
    // /super-login issues this cookie, and routes such as
    // /api/highlights authorise from it. Requiring a NextAuth token only would
    // lock those users out of pages that work today.
    const signed = await signLegacySession(JSON.stringify({ type: 'superuser', id: 'u1' }), SECRET)

    const res = await middleware(request('/api/highlights', { cookie: `session=${signed}` }))

    expect(res?.status).not.toBe(401)
  })

  it('refuses a validly signed legacy cookie from the removed practice login', async () => {
    // /admin-login issued `type: 'surgery'` cookies. Removing that login does
    // not revoke the ones already issued — they stay correctly signed until
    // they expire — so the holder could keep making practice-level writes.
    const signed = await signLegacySession(
      JSON.stringify({ type: 'surgery', id: 's1', surgeryId: 's1' }),
      SECRET
    )

    const res = await middleware(request('/api/highlights', { cookie: `session=${signed}` }))

    expect(res?.status).toBe(401)
  })

  it('refuses a forged legacy cookie', async () => {
    // The cookie is set by the client, so accepting mere presence would let
    // any caller walk through the gate with `session=x`.
    for (const value of ['x', '{"type":"superuser"}', 'abc.def']) {
      const res = await middleware(request('/api/highlights', { cookie: `session=${encodeURIComponent(value)}` }))
      expect(res?.status).toBe(401)
    }
  })

  it('refuses a legacy cookie signed with a different secret', async () => {
    const signed = await signLegacySession(JSON.stringify({ type: 'superuser', id: 'u1' }), 'wrong-secret')

    const res = await middleware(request('/api/highlights', { cookie: `session=${signed}` }))

    expect(res?.status).toBe(401)
  })
})

describe('endpoints that must stay public', () => {
  it.each([
    ['/api/auth/callback/credentials', 'NextAuth callback — sign-in breaks entirely without it'],
    ['/api/auth/signin', 'NextAuth sign-in'],
    ['/api/auth/session', 'NextAuth session'],
    ['/api/auth/super-login', 'legacy superuser login'],
    ['/api/demo-request', 'public marketing form'],
    ['/api/cron/refresh-practice-data', 'Vercel Cron, authenticated by CRON_SECRET'],
  ])('allows anonymous POST to %s (%s)', async (path) => {
    const res = await middleware(request(path))
    expect(res?.status).not.toBe(401)
  })
})

describe('scope of the gate', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('does not gate %s', async (method) => {
    // Some pages render for anonymous visitors and fetch API data to do it.
    // Gating reads here would change read behaviour as a side effect.
    const res = await middleware(request('/api/highlights', { method }))
    expect(res?.status).not.toBe(401)
  })

  it('does not gate non-API paths', async () => {
    const res = await middleware(request('/login', { method: 'POST' }))
    expect(res?.status).not.toBe(401)
  })

  it('gates on the app host and the marketing host alike', async () => {
    const res = await middleware(request('/api/admin/surgeries', { host: 'signpostingtool.co.uk' }))
    expect(res?.status).toBe(401)
  })
})
