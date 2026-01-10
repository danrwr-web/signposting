import { inferWorkflowIconKey } from '../inferWorkflowIconKey'

describe('inferWorkflowIconKey', () => {
  it('uses chat for Advice & Guidance', () => {
    expect(inferWorkflowIconKey({ name: 'Advice & Guidance' })).toBe('chat')
  })

  it('uses envelope for clinic letters', () => {
    expect(inferWorkflowIconKey({ name: 'Clinic Letters' })).toBe('envelope')
  })

  it('uses arrowDownTray for discharge summaries', () => {
    expect(inferWorkflowIconKey({ name: 'Discharge Summaries' })).toBe('arrowDownTray')
  })

  it('uses beaker for blood tests', () => {
    expect(inferWorkflowIconKey({ name: 'Blood Test Requests' })).toBe('beaker')
  })

  it('uses shieldCheck for firearms licensing', () => {
    expect(inferWorkflowIconKey({ name: 'Firearms Licensing Request' })).toBe('shieldCheck')
  })

  it('falls back to document', () => {
    expect(inferWorkflowIconKey({ name: 'Something else entirely' })).toBe('document')
  })
})

