/**
 * Formats a date as a relative time string for the "Last active" column.
 * 
 * Display values:
 * - "Today"
 * - "Yesterday"
 * - "3 days ago" (2-6 days)
 * - "1 week ago" (7-13 days)
 * - "2 weeks ago" (14-27 days)
 * - Short date format for older dates (e.g., "12 Jan 2025")
 * 
 * Returns "—" if date is null/undefined.
 */
export function formatRelativeDate(date: Date | null | undefined): string {
  if (!date) {
    return '—'
  }

  const now = new Date()
  const dateObj = date instanceof Date ? date : new Date(date)
  
  // Reset times to midnight for day-level comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate())
  
  const diffMs = today.getTime() - targetDay.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  }
  
  if (diffDays === 1) {
    return 'Yesterday'
  }
  
  if (diffDays >= 2 && diffDays <= 6) {
    return `${diffDays} days ago`
  }
  
  if (diffDays >= 7 && diffDays <= 13) {
    return '1 week ago'
  }
  
  if (diffDays >= 14 && diffDays <= 27) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} weeks ago`
  }

  // For older dates, use short date format (e.g., "12 Jan 2025")
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
