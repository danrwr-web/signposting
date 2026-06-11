'use client'

export type GroupableSurgery = {
  id: string
  name: string
  surgeryType?: 'LIVE' | 'TEST' | 'GLOBAL_DEFAULT'
}

/**
 * Renders the <option> elements for a surgery <select>, grouping test and
 * template surgeries under a separate optgroup so they don't mix with live
 * practices. Falls back to a flat list when every surgery is live (or the
 * data source doesn't provide surgeryType).
 */
export default function GroupedSurgeryOptions({ surgeries }: { surgeries: GroupableSurgery[] }) {
  const live = surgeries.filter(s => !s.surgeryType || s.surgeryType === 'LIVE')
  const testAndTemplates = surgeries.filter(s => s.surgeryType && s.surgeryType !== 'LIVE')

  if (testAndTemplates.length === 0) {
    return (
      <>
        {surgeries.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </>
    )
  }

  return (
    <>
      <optgroup label="Live surgeries">
        {live.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </optgroup>
      <optgroup label="Test & templates">
        {testAndTemplates.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </optgroup>
    </>
  )
}
