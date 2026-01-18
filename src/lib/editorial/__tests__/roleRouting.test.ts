import { inferRoleFromPrompt, resolveTargetRole } from '../roleRouting'

describe('roleRouting', () => {
  it('infers ADMIN from reception prompts', () => {
    expect(inferRoleFromPrompt('Create cards for reception and triage staff.')).toBe('ADMIN')
  })

  it('resolves to GP when prompt is explicit and role is default', () => {
    expect(resolveTargetRole({ promptText: 'Create cards for GPs about suicide risk.', requestedRole: 'ADMIN' })).toBe(
      'GP'
    )
  })

  it('keeps explicit override when role is not ADMIN', () => {
    expect(resolveTargetRole({ promptText: 'Reception workflow for signposting.', requestedRole: 'GP' })).toBe('GP')
  })
})
