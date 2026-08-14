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

  it('allows the write with the legacy session cookie', async () => {
    // /admin-login and /super-login issue this cookie, and routes such as
    // /api/highlights authorise from it. Requiring a NextAuth token only would
    // lock those users out of pages that work today.
    const res = await middleware(request('/api/highlights', { cookie: 'session=%7B%22type%22%3A%22superuser%22%7D' }))

    expect(res?.status).not.toBe(401)
  })
})

describe('endpoints that must stay public', () => {
  it.each([
    ['/api/auth/callback/credentials', 'NextAuth callback — sign-in breaks entirely without it'],
    ['/api/auth/signin', 'NextAuth sign-in'],
    ['/api/auth/session', 'NextAuth session'],
    ['/api/auth/surgery-login', 'legacy practice admin login'],
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
