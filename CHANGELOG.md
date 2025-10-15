# Changelog

## [2024-12-19] - Prisma Bundling Fix & Enhanced Features

### Fixed
- **Prisma Client Bundling Error**: Resolved "PrismaClient is unable to run in this browser environment" by:
  - Moving all Prisma calls to server-only modules (`src/server/highlights.ts`)
  - Adding `import 'server-only'` to server files
  - Creating API routes with `export const runtime = 'nodejs'`
  - Updating client components to fetch highlight rules via API instead of direct Prisma access

### Added
- **Enhanced Highlight Rules System**:
  - New `HighlightRule` model with proper validation
  - API endpoints: `GET/POST /api/highlights`, `PATCH/DELETE /api/highlights/[id]`
  - Case-insensitive phrase matching with regex escaping
  - Custom rules take precedence over built-in keywords
  - Pink/Purple keyword highlighting (case-insensitive)

- **A-Z Letter Filter Component**:
  - `AlphabetStrip.tsx` with circular buttons A-Z plus "All"
  - Accessible keyboard navigation (Tab, Arrow keys, Enter/Space)
  - Persistent selection via localStorage
  - Integrated with symptom filtering on main page
  - Results count display with letter context

- **Improved Admin Panel**:
  - Fixed highlight configuration with proper error handling
  - Optimistic updates with rollback on failure
  - Clear success/error toasts
  - Better form validation and user feedback

### Changed
- **Database Schema**:
  - Replaced `CustomHighlight` with `HighlightRule` model
  - Removed surgery-specific highlights (now global)
  - Added proper indexes for performance

- **Highlighting System**:
  - Split into client-side utilities (`src/lib/highlighting.ts`) and server-side data access
  - Pure functions for text processing (no Prisma dependencies)
  - Built-in slot highlighting (green, orange, red, pink/purple)
  - Custom rule application with proper precedence

- **Component Updates**:
  - `InstructionView.tsx`: Fetches highlight rules via API
  - `SymptomCard.tsx`: Uses new highlighting system
  - `AdminPageClient.tsx`: Updated to use new API endpoints
  - `HomePageClient.tsx`: Added alphabet filtering

### Technical Details
- **File Locations**:
  - Server-only: `src/server/highlights.ts`
  - API routes: `src/app/api/highlights/`
  - Client utilities: `src/lib/highlighting.ts`
  - Components: `src/components/AlphabetStrip.tsx`, `src/components/HighlightConfig.tsx`
  - Tests: `src/lib/__tests__/highlighting.test.ts`

- **Dependencies**:
  - Added `server-only` package for server/client boundary enforcement
  - No new external dependencies

### Testing
- Added unit tests for highlighting functionality
- Tests cover regex escaping, rule precedence, and edge cases
- Verified Prisma bundling fix with browser console checks

### Migration Notes
- Run `npx prisma db push` to apply schema changes
- Existing custom highlights will need to be recreated
- No breaking changes to existing symptom data
