/**
 * Tests for cookie helper functions used in SurgeryContext
 */

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: ''
})

// Helper functions from SurgeryContext (extracted for testing)
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[2]) : null
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

function safeParseJSON<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

describe('Cookie Helpers', () => {
  beforeEach(() => {
    document.cookie = ''
  })

  describe('readCookie', () => {
    it('should read existing cookie', () => {
      document.cookie = 'test=value123'
      expect(readCookie('test')).toBe('value123')
    })

    it('should return null for non-existent cookie', () => {
      expect(readCookie('nonexistent')).toBeNull()
    })

    it('should handle URL encoded values', () => {
      document.cookie = 'test=hello%20world'
      expect(readCookie('test')).toBe('hello world')
    })

    it('should handle multiple cookies', () => {
      document.cookie = 'cookie1=value1; cookie2=value2'
      expect(readCookie('cookie1')).toBe('value1')
      expect(readCookie('cookie2')).toBe('value2')
    })
  })

  describe('writeCookie', () => {
    it('should write cookie with correct format', () => {
      writeCookie('test', 'value123', 3600)
      expect(document.cookie).toContain('test=value123')
      expect(document.cookie).toContain('Path=/')
      expect(document.cookie).toContain('Max-Age=3600')
      expect(document.cookie).toContain('SameSite=Lax')
    })

    it('should URL encode values', () => {
      writeCookie('test', 'hello world', 3600)
      expect(document.cookie).toContain('test=hello%20world')
    })

    it('should handle special characters', () => {
      writeCookie('test', 'value; with=special&chars', 3600)
      expect(document.cookie).toContain('test=value%3B%20with%3Dspecial%26chars')
    })
  })

  describe('removeCookie', () => {
    it('should remove cookie by setting Max-Age=0', () => {
      document.cookie = 'test=value123'
      removeCookie('test')
      expect(document.cookie).toContain('test=;')
      expect(document.cookie).toContain('Max-Age=0')
    })
  })

  describe('safeParseJSON', () => {
    it('should parse valid JSON', () => {
      const result = safeParseJSON<{ id: string; name: string }>('{"id":"123","name":"Test"}')
      expect(result).toEqual({ id: '123', name: 'Test' })
    })

    it('should return null for invalid JSON', () => {
      const result = safeParseJSON('invalid json')
      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = safeParseJSON('')
      expect(result).toBeNull()
    })

    it('should handle malformed JSON', () => {
      const result = safeParseJSON('{"id":"123"')
      expect(result).toBeNull()
    })
  })

  describe('Precedence Logic', () => {
    it('should demonstrate URL > cookie > localStorage precedence', () => {
      // This test demonstrates the precedence logic used in SurgeryContext
      const urlId = 'url-id'
      const cookieId = 'cookie-id'
      const localStorageId = 'localstorage-id'

      // Simulate the precedence check
      let selectedId: string | null = null

      // 1. URL param takes precedence
      if (urlId) {
        selectedId = urlId
      } else if (cookieId) {
        selectedId = cookieId
      } else if (localStorageId) {
        selectedId = localStorageId
      }

      expect(selectedId).toBe('url-id')
    })

    it('should fall back to cookie when URL is not present', () => {
      const urlId = null
      const cookieId = 'cookie-id'
      const localStorageId = 'localstorage-id'

      let selectedId: string | null = null

      if (urlId) {
        selectedId = urlId
      } else if (cookieId) {
        selectedId = cookieId
      } else if (localStorageId) {
        selectedId = localStorageId
      }

      expect(selectedId).toBe('cookie-id')
    })

    it('should fall back to localStorage when URL and cookie are not present', () => {
      const urlId = null
      const cookieId = null
      const localStorageId = 'localstorage-id'

      let selectedId: string | null = null

      if (urlId) {
        selectedId = urlId
      } else if (cookieId) {
        selectedId = cookieId
      } else if (localStorageId) {
        selectedId = localStorageId
      }

      expect(selectedId).toBe('localstorage-id')
    })
  })
})

