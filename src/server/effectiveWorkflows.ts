import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Effective Workflows Resolution
 * 
 * This module handles resolving "effective workflows" for a surgery by merging:
 * 1. Global Default workflows (from the "global-default-buttons" surgery)
 * 2. Surgery-specific overrides (local templates with sourceTemplateId pointing to global)
 * 3. Surgery-only custom workflows (local templates with no sourceTemplateId)
 * 
 * Approval Visibility Rules:
 * - Admins: Can see both DRAFT and APPROVED workflows (when includeDrafts=true)
 * - Staff: Can only see APPROVED workflows (includeDrafts=false by default)
 * 
 * This ensures staff never see unapproved content, while admins can manage drafts safely.
 */

export interface EffectiveWorkflow {
  id: string
  name: string
  description: string | null
  colourHex: string | null
  isActive: boolean
  landingCategory: string
  workflowType: string
  source: 'global' | 'override' | 'custom'
  sourceTemplateId: string | null // For overrides, points to global template
  approvalStatus: string
  approvedBy: string | null
  approvedAt: Date | null
  lastEditedBy: string | null
  lastEditedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// Global Default surgery ID - used to store shared workflow templates
// These templates are inherited by all surgeries and can be overridden per-surgery
const GLOBAL_SURGERY_ID = 'global-default-buttons'

type WorkflowOptions = {
  includeDrafts?: boolean // Include DRAFT workflows (default: false for staff, true for admin)
  includeInactive?: boolean // Include inactive workflows
}

/**
 * Resolves effective workflows for a surgery:
 * - Starts with Global Default templates
 * - Replaces with local overrides if they exist
 * - Includes surgery-only templates (no sourceTemplateId)
 */
export async function getEffectiveWorkflows(
  surgeryId: string,
  { includeDrafts = false, includeInactive = false }: WorkflowOptions = {}
): Promise<EffectiveWorkflow[]> {
  // Special case: for the Global Default surgery, "global templates" and "local templates" are the same records.
  // Avoid returning duplicates by resolving directly from the global template list.
  if (surgeryId === GLOBAL_SURGERY_ID) {
    const globalTemplates = await prisma.workflowTemplate.findMany({
      where: {
        surgeryId: GLOBAL_SURGERY_ID,
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        colourHex: true,
        isActive: true,
        landingCategory: true,
        workflowType: true,
        approvalStatus: true,
        approvedBy: true,
        approvedAt: true,
        lastEditedBy: true,
        lastEditedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    })

    return globalTemplates
      .filter((t) => includeDrafts || t.approvalStatus === 'APPROVED')
      .map((t) => ({
        ...t,
        source: 'global',
        sourceTemplateId: null,
      }))
  }

  // Fetch global defaults, local overrides, and custom workflows in parallel
  const [globalTemplates, localTemplates] = await Promise.all([
    // Global Default workflows (from the Global Default surgery)
    prisma.workflowTemplate.findMany({
      where: {
        surgeryId: GLOBAL_SURGERY_ID,
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        colourHex: true,
        isActive: true,
        landingCategory: true,
        workflowType: true,
        approvalStatus: true,
        approvedBy: true,
        approvedAt: true,
        lastEditedBy: true,
        lastEditedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    }),
    // Local templates (overrides and custom)
    prisma.workflowTemplate.findMany({
      where: {
        surgeryId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        colourHex: true,
        isActive: true,
        landingCategory: true,
        workflowType: true,
        sourceTemplateId: true,
        approvalStatus: true,
        approvedBy: true,
        approvedAt: true,
        lastEditedBy: true,
        lastEditedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    }),
  ])

  // Build map of global templates by ID
  const globalMap = new Map<string, typeof globalTemplates[0]>(
    globalTemplates.map((t) => [t.id, t])
  )

  // Build map of local overrides by sourceTemplateId
  const overrideMap = new Map<string, typeof localTemplates[0]>()
  const customWorkflows: typeof localTemplates = []

  for (const local of localTemplates) {
    if (local.sourceTemplateId) {
      // This is an override
      overrideMap.set(local.sourceTemplateId, local)
    } else {
      // This is a custom workflow (surgery-only)
      customWorkflows.push(local)
    }
  }

  // Build effective workflows list
  const effective: EffectiveWorkflow[] = []

  // Start with global defaults, replacing with overrides where they exist
  for (const global of globalTemplates) {
    const override = overrideMap.get(global.id)

    if (override) {
      // Use override
      // Filter by approval status: only show APPROVED unless includeDrafts is true
      if (includeDrafts || override.approvalStatus === 'APPROVED') {
        effective.push({
          ...override,
          source: 'override',
          sourceTemplateId: global.id,
        })
      }
    } else {
      // Use global default
      // Filter by approval status: only show APPROVED unless includeDrafts is true
      if (includeDrafts || global.approvalStatus === 'APPROVED') {
        effective.push({
          ...global,
          source: 'global',
          sourceTemplateId: null,
        })
      }
    }
  }

  // Add custom workflows (surgery-only)
  for (const custom of customWorkflows) {
    // Filter by approval status: only show APPROVED unless includeDrafts is true
    if (includeDrafts || custom.approvalStatus === 'APPROVED') {
      effective.push({
        ...custom,
        source: 'custom',
        sourceTemplateId: null,
      })
    }
  }

  return effective
}

/**
 * Get a single effective workflow by ID
 * Resolves whether it's global, override, or custom
 */
export async function getEffectiveWorkflowById(
  id: string,
  surgeryId: string,
  { includeDrafts = false }: WorkflowOptions = {}
): Promise<EffectiveWorkflow | null> {
  // First check if it's a local template (override or custom)
  const local = await prisma.workflowTemplate.findFirst({
    where: {
      id,
      surgeryId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      colourHex: true,
      isActive: true,
      landingCategory: true,
      workflowType: true,
      sourceTemplateId: true,
      approvalStatus: true,
      approvedBy: true,
      approvedAt: true,
      lastEditedBy: true,
      lastEditedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (local) {
    // Check approval status
    if (!includeDrafts && local.approvalStatus !== 'APPROVED') {
      return null
    }

    if (local.sourceTemplateId) {
      // This is an override - fetch the source global template for reference
      const source = await prisma.workflowTemplate.findUnique({
        where: { id: local.sourceTemplateId },
        select: {
          id: true,
          name: true,
          description: true,
        },
      })

      return {
        ...local,
        source: 'override',
        sourceTemplateId: local.sourceTemplateId,
      }
    } else {
      // This is a custom workflow
      return {
        ...local,
        source: 'custom',
        sourceTemplateId: null,
      }
    }
  }

  // Check if it's a global template
  const global = await prisma.workflowTemplate.findFirst({
    where: {
      id,
      surgeryId: GLOBAL_SURGERY_ID,
    },
    select: {
      id: true,
      name: true,
      description: true,
      colourHex: true,
      isActive: true,
      landingCategory: true,
      workflowType: true,
      approvalStatus: true,
      approvedBy: true,
      approvedAt: true,
      lastEditedBy: true,
      lastEditedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (global) {
    // Check if there's an override for this global template
    const override = await prisma.workflowTemplate.findFirst({
      where: {
        surgeryId,
        sourceTemplateId: global.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        colourHex: true,
        isActive: true,
        landingCategory: true,
        workflowType: true,
        approvalStatus: true,
        approvedBy: true,
        approvedAt: true,
        lastEditedBy: true,
        lastEditedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (override) {
      // Use override if approved (or if includeDrafts)
      if (includeDrafts || override.approvalStatus === 'APPROVED') {
        return {
          ...override,
          source: 'override',
          sourceTemplateId: global.id,
        }
      }
      // Override exists but not approved - return null for staff
      return null
    }

    // Use global default
    if (includeDrafts || global.approvalStatus === 'APPROVED') {
      return {
        ...global,
        source: 'global',
        sourceTemplateId: null,
      }
    }
  }

  return null
}

/**
 * Check if workflow guidance feature is enabled for a surgery.
 * Uses the feature flag system (workflow_guidance feature).
 * 
 * @deprecated Use isFeatureEnabledForSurgery from @/lib/features instead
 * This function is kept for backward compatibility during migration.
 */
export async function isWorkflowsEnabled(surgeryId: string): Promise<boolean> {
  // Import here to avoid circular dependency
  const { isFeatureEnabledForSurgery } = await import('@/lib/features')
  return isFeatureEnabledForSurgery(surgeryId, 'workflow_guidance')
}

