import type { BadgeColor } from '@/components/ui'

export function ageGroupBadgeColor(ageGroup: string): BadgeColor {
  if (ageGroup === 'Adult') return 'blue'
  if (ageGroup === 'O5') return 'green'
  return 'purple'
}
