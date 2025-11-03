# Codebase Cleanup Analysis Report

Generated: 2025-01-XX

## Methodology

This report analyses the codebase to identify unused files and components. The analysis is conservative—when in doubt, files are marked for manual review rather than deletion.

### Analysis Scope
- **src/app/** - Pages, routes, API routes
- **src/components/** - React components
- **src/lib/** - Utility libraries
- **src/server/** - Server-only utilities
- **src/hooks/** - React hooks
- **src/context/** - React contexts
- **prisma/** - Schema and migrations (listed, not analysed for deletion)

### Criteria for "Probably Unused"
1. File is not imported anywhere in the codebase
2. File is NOT a Next.js route/page/layout (page.tsx, layout.tsx, route.ts)
3. File is NOT a config/schema/migration file

### Criteria for "Needs Manual Review"
Files matching these patterns are flagged for manual review:
- Filename contains: api, route, schema, rbac, features, admin, symptom, highlight
- Exports a Prisma model
- Looks like a utility that could be used in dynamic imports
- Related to recently added features (Symptom Library, Features, AI instructions, Admin layouts)

---

## Definitely Keep

These files are core to the application and should not be deleted:

### Core Pages & Routes
- `src/app/page.tsx` - Home page
- `src/app/layout.tsx` - Root layout
- `src/app/robots.txt/route.ts` - Robots.txt
- `src/app/sitemap.xml/route.ts` - Sitemap
- All `src/app/**/page.tsx` files (Next.js pages)
- All `src/app/api/**/route.ts` files (API endpoints)

### Prisma
- `prisma/schema.prisma` - Database schema
- `prisma/seed.ts` - Seed script
- All files in `prisma/migrations/` - Database migrations

### RBAC & Auth
- `src/lib/rbac.ts` - Role-based access control
- `src/lib/auth.ts` - NextAuth configuration
- `src/lib/roles.ts` - Role utilities
- `src/server/auth.ts` - Server auth utilities
- All files in `src/app/api/auth/**`

### Features & Symptom Library (Recently Added - Keep)
- `src/components/SymptomLibraryExplorer.tsx` - Symptom Library explorer
- `src/components/FeaturesAdmin.tsx` - Features tab (feature flags)
- `src/lib/features.ts` - Feature flag logic
- `src/lib/ensureFeatures.ts` - Feature initialisation
- All files in `src/app/api/features/**`
- All files in `src/app/api/surgeryFeatures/**`
- All files in `src/app/api/userFeatures/**`
- All files in `src/app/api/surgerySymptoms/**`
- All files in `src/app/api/symptomPreview/**`
- All files in `src/app/api/symptoms/**`

### AI Endpoints (Recently Added - Keep)
- `src/app/api/improveInstruction/route.ts` - AI instruction improvement
- `src/app/api/explainInstruction/route.ts` - AI explanation
- `src/app/api/revertInstruction/route.ts` - Instruction revert
- `src/app/api/updateInstruction/route.ts` - Instruction update
- `src/app/api/aiUsageSummary/route.ts` - AI usage analytics

### Admin Layouts (Recently Added - Keep)
- `src/app/admin/**` - All admin pages
- `src/app/s/[id]/admin/users/**` - Surgery users admin
- `src/app/api/admin/**` - All admin API routes

### Highlighting System
- `src/lib/highlighting.ts` - Highlight utilities
- `src/server/highlights.ts` - Server highlight logic
- `src/components/HighlightConfig.tsx` - Highlight configuration
- All files in `src/app/api/highlights/**`

### Core Components (Used)
- `src/components/InstructionView.tsx` - Main instruction display
- `src/components/CompactToolbar.tsx` - Toolbar component
- `src/components/SurgerySelector.tsx` - Surgery selector
- `src/components/SearchBox.tsx` - Search functionality
- `src/components/AgeFilter.tsx` - Age filtering
- `src/components/AlphabetStrip.tsx` - Alphabet navigation
- `src/components/SymptomCard.tsx` - Symptom card display
- `src/components/HighRiskButtons.tsx` - High-risk buttons
- `src/components/HighRiskButtonsList.tsx` - High-risk buttons list
- `src/components/HighRiskButtonsSkeleton.tsx` - Loading skeleton
- `src/components/HighRiskConfig.tsx` - High-risk configuration
- `src/components/DefaultButtonsConfig.tsx` - Default buttons config
- `src/components/CustomButtonForm.tsx` - Custom button form
- `src/components/ImageIconConfig.tsx` - Image icon configuration
- `src/components/LogoSizeControl.tsx` - Logo size control
- `src/components/SimpleHeader.tsx` - Simple header component
- `src/components/SuggestionModal.tsx` - Suggestion modal
- `src/components/NewSymptomModal.tsx` - New symptom modal
- `src/components/SymptomPreviewModal.tsx` - Symptom preview modal
- `src/components/ClinicalReviewActions.tsx` - Clinical review actions
- `src/components/EngagementAnalytics.tsx` - Engagement analytics
- `src/components/SuggestionsAnalytics.tsx` - Suggestions analytics
- `src/components/TestUserUsage.tsx` - Test user usage display
- `src/components/ToggleSwitch.tsx` - Toggle switch component
- `src/components/VirtualizedGrid.tsx` - Virtualized grid
- `src/components/PasswordChangeModal.tsx` - Password change modal
- `src/components/Providers.tsx` - React providers wrapper
- `src/components/rich-text/RichTextEditor.tsx` - TipTap editor (ACTIVELY USED)
- `src/app/HomePageClient.tsx` - Home page client component
- `src/app/LandingPageClient.tsx` - Landing page client
- `src/app/admin/AdminPageClient.tsx` - Admin page client
- `src/app/admin/AdminPageWrapper.tsx` - Admin page wrapper
- `src/app/admin/AdminDashboardClient.tsx` - Admin dashboard
- `src/app/admin/surgeries/SurgeriesClient.tsx` - Surgeries client
- `src/app/admin/users/GlobalUsersClient.tsx` - Global users client
- `src/app/s/[id]/dashboard/SurgeryDashboardClient.tsx` - Surgery dashboard
- `src/app/s/[id]/clinical-review/ClinicalReviewClient.tsx` - Clinical review client
- `src/app/s/[id]/admin/users/SurgeryUsersClient.tsx` - Surgery users client
- `src/app/super/SuperDashboardClient.tsx` - Super dashboard

### Core Libraries
- `src/lib/prisma.ts` - Prisma client
- `src/lib/api-contracts.ts` - API contracts (Zod schemas)
- `src/lib/sanitizeHtml.ts` - HTML sanitisation
- `src/lib/excel-parser.ts` - Excel file parsing (used in upload-excel route)
- `src/lib/test-user-limits.ts` - Test user limit checking
- `src/server/effectiveSymptoms.ts` - Effective symptom resolution
- `src/context/SurgeryContext.tsx` - Surgery context provider

### Hooks
- `src/hooks/useHighRiskButtons.ts` - High-risk buttons hook
- `src/hooks/useScrollReveal.ts` - Scroll reveal hook
- `src/hooks/useSurgerySlug.ts` - Surgery slug hook

### Middleware & Types
- `src/middleware.ts` - Next.js middleware
- `src/types/next-auth.d.ts` - NextAuth type definitions

---

## Probably Unused

These files are not imported anywhere and appear safe to delete:

### Components
1. **src/components/RichTextEditor.tsx**
   - **Reason**: A legacy markdown editor component. The codebase now uses `src/components/rich-text/RichTextEditor.tsx` (TipTap-based editor) instead. No imports found for this file.
   - **Imports**: None found

2. **src/components/Header.tsx**
   - **Reason**: Legacy header component. The codebase uses `SimpleHeader.tsx` instead. No imports found for this file.
   - **Imports**: None found

3. **src/components/SymptomLibrary.tsx**
   - **Reason**: Legacy symptom library component. Replaced by `SymptomLibraryExplorer.tsx`. No imports found for this file.
   - **Imports**: None found

### Hooks
4. **src/hooks/useSurgerySlug.ts**
   - **Reason**: Hook for surgery slug conversion and API URL building. No imports found in the codebase.
   - **Exports**: `useSurgerySlug` hook
   - **Imports**: None found

### Libraries
5. **src/lib/data-resolution.ts**
   - **Reason**: Appears to be legacy data resolution logic. The codebase now uses `src/server/effectiveSymptoms.ts` for effective symptom resolution. No imports found.
   - **Exports**: `EffectiveSymptom` interface, `getEffectiveSymptoms`, `getEffectiveSymptomById`, `logEngagementEvent`
   - **Imports**: None found

6. **src/lib/image-icons.ts**
   - **Reason**: Image icon utilities that are not directly imported. The API routes (`src/app/api/image-icons/route.ts`) use Prisma directly instead of these utilities. Additionally, `getSurgeryImageIconsSetting` is duplicated in `src/server/highlights.ts` (which is actually used). No imports found.
   - **Exports**: `ImageIcon` interface, `getAllImageIcons`, `findImageIconByPhrase`, `getSurgeryImageIconsSetting`
   - **Imports**: None found

7. **src/server/symptoms.ts**
   - **Reason**: Server-side symptom utilities that are not imported anywhere. The codebase uses `src/server/effectiveSymptoms.ts` instead. No imports found.
   - **Exports**: `EffectiveSymptom` interface, `getEffectiveSymptoms`, `getEffectiveSymptomById`, `getEffectiveSymptomBySlug`
   - **Imports**: None found

### Empty API Route Directories
The following directories exist but contain no `route.ts` files (may be incomplete routes or leftover directories):

8. **src/app/api/admin/custom-highlights/[id]/**
   - **Reason**: Directory exists but no route.ts file found. May be an incomplete route.

9. **src/app/api/admin/migrate-content-paragraphs/**
   - **Reason**: Directory exists but no route.ts file found. May be an incomplete migration route.

10. **src/app/api/auth/logout/**
   - **Reason**: Directory exists but no route.ts file found. Logout may be handled elsewhere.

11. **src/app/api/test-default-buttons/**
    - **Reason**: Directory exists but no route.ts file found. Test route may be incomplete.

12. **src/app/api/test-session/**
    - **Reason**: Directory exists but no route.ts file found. Test route may be incomplete.

13. **src/app/api/surge rySymptoms/** (note: space in directory name)
    - **Reason**: Directory name contains a space (likely a typo). No route.ts file found. This appears to be a mistake.

---

## Needs Manual Review

These files/areas need manual investigation before deletion:

### Components (Potential Dynamic Usage)
1. **src/components/SymptomLibrary.tsx** vs **SymptomLibraryExplorer.tsx**
   - **Review**: `SymptomLibrary.tsx` is marked as "Probably Unused" above, but verify it's not used in any dynamic routing or conditional rendering scenarios. Confirm `SymptomLibraryExplorer.tsx` fully replaces it.

### Libraries (Potential Dynamic/API Usage)
2. **src/lib/image-icons.ts**
   - **Review**: While not directly imported, verify if functions like `findImageIconByPhrase` are called dynamically from API routes or used in string-based dynamic imports. The API routes use Prisma directly, but check for any edge cases.

3. **src/lib/data-resolution.ts**
   - **Review**: Legacy data resolution. Check if any migration scripts or one-off utilities reference this. Also verify `logEngagementEvent` isn't called dynamically from analytics code.

4. **src/server/symptoms.ts**
   - **Review**: Legacy symptom resolution. Similar functions exist in `effectiveSymptoms.ts`. Verify no dynamic imports or string-based references.

### API Routes (Incomplete or Test Routes)
5. **Empty API Route Directories**
   - **Review**: The empty directories listed in "Probably Unused" (#7-12) may be:
     - Incomplete features in development
     - Test routes that should be kept for testing
     - Planned features not yet implemented
   - **Recommendation**: Check git history to understand their purpose before deletion.

### Special Note: Duplicate RichTextEditor
6. **src/components/RichTextEditor.tsx** (legacy) vs **src/components/rich-text/RichTextEditor.tsx** (current)
   - **Status**: Marked as "Probably Unused" but verify:
     - No dynamic imports using string paths
     - No test files importing the legacy version
     - The legacy version can be safely removed

### Test Files
7. **All `__tests__/**` directories**
   - **Note**: Test files are not marked for deletion in this report, but verify that any unused components being deleted don't have active tests that should also be cleaned up.

---

## Summary Statistics

- **Total files analysed**: ~168 TypeScript/TSX files in src/
- **Definitely keep**: ~140+ files (core functionality)
- **Probably unused**: 13 items (7 files + 6 empty directories)
- **Needs manual review**: 7 items

---

## Recommendations

### Safe to Delete (After Verification)
1. `src/components/RichTextEditor.tsx` - Legacy editor (replaced by rich-text version)
2. `src/components/Header.tsx` - Legacy header (replaced by SimpleHeader)
3. `src/components/SymptomLibrary.tsx` - Legacy library component (replaced by SymptomLibraryExplorer)
4. `src/hooks/useSurgerySlug.ts` - Unused hook for surgery slug conversion
5. `src/lib/data-resolution.ts` - Legacy data resolution (replaced by effectiveSymptoms)
6. `src/lib/image-icons.ts` - Unused utilities (API routes use Prisma directly)
7. `src/server/symptoms.ts` - Legacy symptom resolution (replaced by effectiveSymptoms)

### Verify Before Deleting
1. Empty API route directories - Check git history and team knowledge

### Action Items
1. **Review**: Manually check each "Needs Manual Review" item
2. **Verify**: Run a full application test suite before deleting
3. **Document**: Update any related documentation if files are deleted
4. **Git**: Check git history for context on questionable files
5. **Test**: After deletions, run full test suite and manual testing

---

## Notes

- All API routes in `src/app/api/**/route.ts` are considered in use (Next.js routing)
- All pages in `src/app/**/page.tsx` are considered in use (Next.js routing)
- Test files in `__tests__/**` are not included in deletion candidates
- Files related to recently added features (Symptom Library, Features, AI, Admin) are explicitly kept

**Next Steps**: Review the "Needs Manual Review" section, then proceed with deletions from "Probably Unused" after verification.

