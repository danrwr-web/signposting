/**
 * Navigation registry for app modules and management items.
 * 
 * To add a new module:
 * 1. Add an entry to MODULES array below
 * 2. Update the active module detection logic in UniversalNavigationPanel if needed
 * 3. Ensure the route exists and is accessible
 * 4. Add feature flag if the module should be gated
 */

export interface ModuleItem {
  id: string
  label: string
  href: string
  featureKey?: string // Feature flag key for this module (e.g., 'workflow_guidance')
  alwaysEnabled?: boolean // If true, module is always visible/enabled
  newBadgeUntil?: Date // If set, show "New" badge until this date
}

/**
 * "New" badge expiry dates for modules.
 * After the date passes, the badge will no longer render.
 */
export const DAILY_DOSE_NEW_BADGE_UNTIL = new Date('2026-02-09T23:59:59Z') // 14 days from launch

/**
 * Check if a module's "New" badge should be displayed.
 */
export function shouldShowNewBadge(module: ModuleItem): boolean {
  if (!module.newBadgeUntil) return false
  return new Date() < module.newBadgeUntil
}

export interface ManagementItem {
  id: string
  label: string
  href: string
}

/**
 * Main navigation modules visible to all users.
 * The href should use {surgeryId} placeholder which will be replaced at runtime.
 */
export const MODULES: ModuleItem[] = [
  { 
    id: 'signposting', 
    label: 'Signposting', 
    href: '/s/{surgeryId}', 
    alwaysEnabled: true 
  },
  { 
    id: 'workflow', 
    label: 'Workflow Guidance', 
    href: '/s/{surgeryId}/workflow', 
    featureKey: 'workflow_guidance' 
  },
  { 
    id: 'handbook', 
    label: 'Practice Handbook', 
    href: '/s/{surgeryId}/admin-toolkit', 
    featureKey: 'admin_toolkit' 
  },
  { 
    id: 'daily-dose', 
    label: 'Daily Dose', 
    href: '/s/{surgeryId}/daily-dose', 
    featureKey: 'daily_dose',
    newBadgeUntil: DAILY_DOSE_NEW_BADGE_UNTIL
  },
  { 
    id: 'appointments', 
    label: 'Appointments Directory', 
    href: '/s/{surgeryId}/appointments', 
    alwaysEnabled: true 
  },
  { 
    id: 'help', 
    label: 'Help & Documentation', 
    href: 'https://docs.signpostingtool.co.uk/', 
    alwaysEnabled: true 
  },
]

/**
 * Management/admin navigation items visible only to practice admins and superusers.
 * The href should use {surgeryId} placeholder which will be replaced at runtime.
 */
export const MANAGEMENT_ITEMS: ManagementItem[] = [
  { 
    id: 'edit-handbook', 
    label: 'Edit Handbook', 
    href: '/s/{surgeryId}/admin-toolkit/admin' 
  },
  { 
    id: 'signposting-settings', 
    label: 'Signposting settings', 
    href: '/admin' 
  },
  { 
    id: 'workflow-editor', 
    label: 'Workflow editor', 
    href: '/s/{surgeryId}/workflow/templates' 
  },
  { 
    id: 'user-management', 
    label: 'User & access management', 
    href: '/s/{surgeryId}/admin/users' 
  },
]
