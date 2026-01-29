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
 * 
 * Navigation structure:
 * - Practice settings (/admin/practice): Surgery-level administration across modules
 *   (includes Users & access, Module access, Practice Handbook admin, Workflow Guidance)
 * - Signposting settings (/admin): Module-specific Signposting configuration
 * - System management (/admin/system): Super Admin only, platform governance
 * 
 * Note: Practice Handbook admin is accessed via Practice settings, NOT directly from
 * the hamburger menu. This keeps configuration tasks in one place.
 */
export const MANAGEMENT_ITEMS: ManagementItem[] = [
  { 
    id: 'practice-settings', 
    label: 'Practice settings', 
    href: '/admin/practice' 
  },
  { 
    id: 'signposting-settings', 
    label: 'Signposting settings', 
    href: '/admin' 
  },
]
