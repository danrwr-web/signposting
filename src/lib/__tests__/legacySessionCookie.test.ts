import { signLegacySession, verifyLegacySession } from '@/lib/legacySessionCookie'

const SECRET = 'test-secret-value'
const payload = JSON.stringify({ type: 'superuser', id: 'user-1' })

describe('signLegacySession / verifyLegacySession', () => {
  it('round-trips a payload', async () => {
    const signed = await signLegacySession(payload, SECRET)
    await expect(verifyLegacySession(signed, SECRET)).resolves.toBe(payload)
  })

  it('produces a value that is not the bare payload', async () => {
    const signed = await signLegacySession(payload, SECRET)
    expect(signed).not.toContain('superuser')
    expect(signed).toMatch(/^[\w-]+\.[0-9a-f]{64}$/)
  })

  it('rejects an unsigned JSON cookie — the pre-existing forgery', async () => {
    // Anyone could previously send this and be treated as a superuser.
    await expect(verifyLegacySession(payload, SECRET)).resolves.toBeNull()
    await expect(verifyLegacySession('x', SECRET)).resolves.toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const signed = await signLegacySession(JSON.stringify({ type: 'surgery', id: 's1' }), SECRET)
    const [, signature] = signed.split('.')
    const escalated = Buffer.from(payload).toString('base64url')

    await expect(verifyLegacySession(`${escalated}.${signature}`, SECRET)).resolves.toBeNull()
  })

  it('rejects a signature made with a different secret', async () => {
    const signed = await signLegacySession(payload, 'another-secret')
    await expect(verifyLegacySession(signed, SECRET)).resolves.toBeNull()
  })

  it('fails closed when the secret is missing', async () => {
    const signed = await signLegacySession(payload, SECRET)
    await expect(verifyLegacySession(signed, undefined)).resolves.toBeNull()
    await expect(verifyLegacySession(signed, '')).resolves.toBeNull()
  })

  it('rejects malformed values without throwing', async () => {
    for (const value of ['', '.', 'abc', 'abc.', '.abc', 'a.b.c']) {
      await expect(verifyLegacySession(value, SECRET)).resolves.toBeNull()
    }
  })

  it('refuses to sign without a secret rather than issuing a forgeable cookie', async () => {
    await expect(signLegacySession(payload, '')).rejects.toThrow('NEXTAUTH_SECRET')
  })

  it('round-trips non-ASCII payloads', async () => {
    const unicode = JSON.stringify({ type: 'surgery', id: 's1', email: 'práctice@example.nhs.uk' })
    const signed = await signLegacySession(unicode, SECRET)
    await expect(verifyLegacySession(signed, SECRET)).resolves.toBe(unicode)
  })
})
