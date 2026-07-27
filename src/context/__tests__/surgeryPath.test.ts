import { getSurgeryIdFromPath } from '@/context/SurgeryContext'

describe('getSurgeryIdFromPath', () => {
  it('extracts the surgery id from /s/[id] routes', () => {
    expect(getSurgeryIdFromPath('/s/abc123/admin/setup-checklist')).toBe('abc123')
    expect(getSurgeryIdFromPath('/s/abc123')).toBe('abc123')
    expect(getSurgeryIdFromPath('/s/abc123/')).toBe('abc123')
  })

  it('decodes percent-encoded ids', () => {
    expect(getSurgeryIdFromPath('/s/abc%20123/admin')).toBe('abc 123')
  })

  it('returns null for non-surgery routes', () => {
    expect(getSurgeryIdFromPath('/admin/system/setup-tracker')).toBeNull()
    expect(getSurgeryIdFromPath('/symptom/xyz')).toBeNull()
    expect(getSurgeryIdFromPath('/s/')).toBeNull()
    expect(getSurgeryIdFromPath('/s')).toBeNull()
    expect(getSurgeryIdFromPath('/')).toBeNull()
    expect(getSurgeryIdFromPath(null)).toBeNull()
  })
})
