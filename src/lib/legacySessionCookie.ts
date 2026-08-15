/**
 * Signing and verification for the legacy `session` cookie.
 *
 * That cookie predates NextAuth in this codebase and is still issued by
 * /super-login, and still read by `getSession()` in
 * src/server/auth.ts for routes such as /api/highlights and /api/image-icons.
 *
 * It used to be plain JSON: `{"type":"superuser","id":"…"}`. httpOnly stops a
 * script reading it, but nothing stopped a caller *writing* one, so anyone
 * could present `session={"type":"superuser"}` and be treated as a superuser
 * by every route that trusts it — enough to write global highlight rules and
 * image icons, which reach every practice.
 *
 * The value is now `<base64url(payload)>.<hex HMAC-SHA256>` keyed on
 * NEXTAUTH_SECRET. Verification is deliberately dependency-free and uses Web
 * Crypto only, so the same code runs in the edge middleware and in Node.
 *
 * Note: this invalidates cookies issued before the change. Anyone signed in via
 * /super-login signs in once more; NextAuth sessions are
 * unaffected.
 */

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Comparison whose duration does not depend on where the first mismatch is. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))
}

/** Encode and sign a session payload for storage in the cookie. */
export async function signLegacySession(payload: string, secret: string): Promise<string> {
  if (!secret) throw new Error('Cannot sign a session cookie without NEXTAUTH_SECRET.')
  const encoded = toBase64Url(encoder.encode(payload))
  return `${encoded}.${await hmac(encoded, secret)}`
}

/**
 * Verify a cookie value and return the payload it carries, or null.
 *
 * Fails closed: a missing secret, a malformed value, an unsigned legacy value
 * or a bad signature all return null, and the caller treats the request as
 * having no legacy session.
 */
export async function verifyLegacySession(
  value: string | undefined | null,
  secret: string | undefined
): Promise<string | null> {
  if (!value || !secret) return null

  const separator = value.lastIndexOf('.')
  if (separator <= 0) return null

  const encoded = value.slice(0, separator)
  const signature = value.slice(separator + 1)
  if (!encoded || !signature) return null

  try {
    const expected = await hmac(encoded, secret)
    if (!timingSafeEqual(signature, expected)) return null
    return fromBase64Url(encoded)
  } catch {
    return null
  }
}
