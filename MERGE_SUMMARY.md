# Merge Summary: cursor/workflow-dashboard-feature-flag-error-0f5f → feature-workflow-engine

## Overview
This merge brings 7 commits from `cursor/workflow-dashboard-feature-flag-error-0f5f` into `feature-workflow-engine`, adding workflow guidance features, global default workflow inheritance, feature flag improvements, and diagram rendering fixes.

## Commits Being Merged (in order)
1. `5765de0` - feat: Add isFeatureEnabledForSurgery function
2. `b35bf52` - Fix: Correctly count linked workflows by templateId
3. `83fc373` - feat: Add workflow guidance feature and improve template management
4. `71b80b4` - Refactor: Allow viewing global default workflows and add migration script
5. `76c548b` - feat: Add workflow migration script and GitHub Action
6. `39ae235` - feat: Add Workflow Guidance module and documentation
7. `e3c9635` - Fix: Repair broken workflow links and improve diagram rendering

## Files Changed Summary

### Total: 30 files changed, 1020 insertions(+), 118 deletions(-)

### Critical Areas

#### 🔴 Prisma Migrations
- **No new migrations** - All migrations already exist in `feature-workflow-engine`
- Existing migrations remain unchanged

#### 🟡 Feature Flags (`src/lib/features.ts`)
- **Added**: `isFeatureEnabledForSurgery()` function
  - Checks surgery-level feature flags (ignores user-level overrides)
  - Used for workflow guidance feature gating
  - Complements existing `isFeatureEnabledForUser()` function

#### 🟢 Workflow Inheritance (`src/server/effectiveWorkflows.ts`)
- **Enhanced**: Global Default workflow resolution
  - Adds `source` field: `'global' | 'override' | 'custom'`
  - Adds `sourceTemplateId` for tracking override relationships
  - Improved logic for resolving effective workflows:
    1. Global Default workflows (from "global-default-buttons" surgery)
    2. Surgery-specific overrides (local templates with `sourceTemplateId`)
    3. Surgery-only custom workflows (no `sourceTemplateId`)

#### 🔵 Diagram Rendering (`src/components/workflow/WorkflowDiagramClient.tsx`)
- **Fixed**: Arrow rendering for workflow edges
- **Added**: Support for visual indicators based on workflow source:
  - Global Default workflows
  - Override workflows (customised from global)
  - Custom workflows (surgery-specific)
- Arrow styling improvements for better visual distinction

### Key Files Changed

#### Core Workflow Features
- `src/app/s/[id]/workflow/actions.ts` - Enhanced workflow actions (52 changes)
- `src/app/s/[id]/workflow/page.tsx` - Updated workflow landing page (105 changes)
- `src/app/s/[id]/workflow/templates/[templateId]/view/page.tsx` - Improved view page with global default support (161 changes)
- `src/components/workflow/WorkflowDiagramClient.tsx` - Diagram rendering fixes (10 changes)
- `src/components/workflow/WorkflowDiagramClientWrapper.tsx` - Wrapper updates (1 change)

#### Feature Flag Integration
- `src/lib/features.ts` - Added `isFeatureEnabledForSurgery()` (43 additions)

#### Workflow Resolution
- `src/server/effectiveWorkflows.ts` - Enhanced global default inheritance (36 additions)

#### Documentation
- `docs/wiki/Workflow-Guidance.md` - **NEW** comprehensive workflow guidance documentation (65 lines)
- `docs/wiki/Admin-Guide.md` - **NEW** admin guide (42 lines)
- Multiple wiki pages updated with workflow references
- `docs/RELEASE_NOTES.md` - Release notes updated
- `docs/PROJECT_SUMMARY.md` - Project summary updated
- `docs/README.md` - README updated

#### Migration & Infrastructure
- `scripts/migrateWorkflowsToGlobalDefault.ts` - **NEW** migration script (206 lines)
- `.github/workflows/migrate-workflows-to-global-default.yml` - **NEW** GitHub Action (76 lines)
- `INFRASTRUCTURE_NOTES.md` - Infrastructure notes added (60 lines)

#### UI Components
- `src/app/HomePageClient.tsx` - Home page updates (10 changes)
- `src/app/s/[id]/page.tsx` - Surgery page updates (13 changes)
- `src/components/CompactToolbar.tsx` - Toolbar updates (14 changes)

#### Dependencies
- `package-lock.json` - Dependency updates (150 changes)

## Verification Checklist for Preview Deploy

### ✅ Global Default Arrows
- [ ] Navigate to a workflow template that inherits from Global Default
- [ ] Verify arrows/edges render correctly in the diagram
- [ ] Check that Global Default workflows show appropriate visual indicators
- [ ] Confirm arrows point correctly between nodes

### ✅ Ide Lane Arrows  
- [ ] Check workflow diagrams in "Ide Lane" workflows (if applicable)
- [ ] Verify arrow routing and rendering
- [ ] Confirm no broken or misaligned arrows

### ✅ New Override Arrows
- [ ] Create or view a workflow that overrides a Global Default
- [ ] Verify override workflows display distinct arrow styling
- [ ] Check that arrows correctly show the override relationship
- [ ] Confirm custom workflows (non-override) render differently from overrides

### General Workflow Verification
- [ ] Workflow creation flow works correctly
- [ ] Workflow editing preserves node positions
- [ ] Linked workflows display correctly
- [ ] Workflow deletion works as expected
- [ ] Feature flag gating works for workflow guidance

## Build & Test Verification

After merge, verify:
- [ ] `npm run build` completes successfully
- [ ] `npm test` passes (if tests exist)
- [ ] TypeScript compilation succeeds
- [ ] No linting errors
- [ ] Database migrations are compatible

## Merge Recommendation

**Squash Merge** recommended to combine the 7 commits into a single cohesive commit with message:
```
feat: Add workflow guidance, global default inheritance, and diagram rendering fixes

- Add isFeatureEnabledForSurgery() for surgery-level feature flag checks
- Implement Global Default workflow inheritance with override support
- Add workflow guidance module and comprehensive documentation
- Fix workflow diagram arrow rendering and edge routing
- Add migration script and GitHub Action for workflow migration
- Improve workflow template management and viewing capabilities
```

