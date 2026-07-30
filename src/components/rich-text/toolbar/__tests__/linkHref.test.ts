import { normalizeHref } from '@/components/rich-text/toolbar/linkHref'

describe('normalizeHref', () => {
  it('keeps https, http and mailto links', () => {
    expect(normalizeHref('https://nhs.uk/page')).toBe('https://nhs.uk/page')
    expect(normalizeHref('http://intranet.local/doc')).toBe('http://intranet.local/doc')
    expect(normalizeHref('mailto:reception@example.nhs.uk')).toBe('mailto:reception@example.nhs.uk')
  })

  it('keeps internal uploaded-PDF links unchanged', () => {
    expect(normalizeHref('/api/admin-toolkit/files/clx123abc')).toBe('/api/admin-toolkit/files/clx123abc')
  })

  it('converts bare e-mail addresses to mailto', () => {
    expect(normalizeHref('reception@example.nhs.uk')).toBe('mailto:reception@example.nhs.uk')
  })

  it('assumes https for bare domains', () => {
    expect(normalizeHref('nhs.uk/conditions')).toBe('https://nhs.uk/conditions')
  })

  it('rejects dangerous or unsupported schemes', () => {
    expect(normalizeHref('javascript:alert(1)')).toBeNull()
    expect(normalizeHref('data:text/html,x')).toBeNull()
    expect(normalizeHref('ftp://example.com/x')).toBeNull()
  })

  it('rejects other relative paths and empty input', () => {
    expect(normalizeHref('/etc/passwd')).toBeNull()
    expect(normalizeHref('/api/admin-toolkit/files/')).toBeNull()
    expect(normalizeHref('/api/admin-toolkit/files/abc/../x')).toBeNull()
    expect(normalizeHref('  ')).toBeNull()
  })
})
