import { inferRiskLevel, resolveNeedsSourcing } from '../guards'

describe('editorial guards', () => {
  it('flags high risk content for escalation topics', () => {
    expect(inferRiskLevel('Patient mentions chest pain and collapse')).toBe('HIGH')
    expect(inferRiskLevel('Suicide risk and self-harm disclosure')).toBe('HIGH')
  })

  it('keeps low risk for routine admin content', () => {
    expect(inferRiskLevel('Updating appointment reminders for reception staff')).toBe('LOW')
  })

  it('marks needs sourcing when UK sources are missing', () => {
    expect(resolveNeedsSourcing([], false)).toBe(true)
    expect(resolveNeedsSourcing([{ url: 'https://example.com', title: 'Example' }], false)).toBe(true)
  })

  it('accepts recognised UK sources', () => {
    expect(resolveNeedsSourcing([{ url: 'https://www.nhs.uk/conditions/', title: 'NHS' }], false)).toBe(false)
    expect(resolveNeedsSourcing([{ url: 'https://www.nice.org.uk/guidance', title: 'NICE' }], false)).toBe(false)
  })
})
