import { ageGroupBadgeClasses, formatAgeGroupLabel, formatAgeGroupDescription } from '@/lib/ageGroups'

interface AgeGroupBadgeProps {
  ageGroup: string | null | undefined
  size?: 'xs' | 'sm'
  className?: string
}

/**
 * Coloured pill showing which age band a symptom applies to
 * (Under 5 / 5–17 / Adult). Matches the SymptomCard directory palette.
 */
export default function AgeGroupBadge({ ageGroup, size = 'xs', className }: AgeGroupBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-sm' : 'px-2 py-0.5 text-xs'
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${sizeClasses} ${ageGroupBadgeClasses(ageGroup)} ${className || ''}`}
      title={`This version of the symptom applies to ${formatAgeGroupDescription(ageGroup)}.`}
    >
      {formatAgeGroupLabel(ageGroup)}
    </span>
  )
}
