# Signposting Webapp – Technical Summary

## 1. Tech Stack Overview

### Core Technologies
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.3+
- **Database**: PostgreSQL (via Prisma ORM)
  - Production: Neon Postgres
  - Local Dev: SQLite (optional, but production uses PostgreSQL)
- **ORM**: Prisma 6.18.0
- **Authentication**: NextAuth.js 4.24.5 (Credentials provider with JWT sessions)
- **Styling**: Tailwind CSS 3.3.6 with NHS Design System palette
- **UI Components**: Custom React components
- **Rich Text Editing**: TipTap 3.7.2 (ProseMirror-based)
- **Deployment**: Vercel
- **Testing**: Jest 30.2.0 + React Testing Library

### Key Dependencies
- `bcryptjs`: Password hashing
- `zod`: Runtime validation and API contracts
- `react-hot-toast`: Toast notifications
- `react-markdown`: Markdown rendering
- `isomorphic-dompurify`: HTML sanitisation
- `xlsx`: Excel file parsing for bulk imports
- `server-only`: Enforces server-side only imports

### External Integrations
- **Azure OpenAI**: AI-powered instruction improvement and explanation generation
  - Endpoint: `AZURE_OPENAI_ENDPOINT`
  - API Key: `AZURE_OPENAI_API_KEY`
  - Deployment: `AZURE_OPENAI_DEPLOYMENT`
  - Cost tracking: Token usage logged to `TokenUsageLog` table

---

## 2. Folder Structure

```
signposting-1/
├── src/
│   ├── app/                    # Next.js App Router pages and API routes
│   │   ├── (auth)/             # Auth-specific routes (admin-login, super-login)
│   │   ├── admin/              # Global admin dashboard (superuser only)
│   │   ├── api/                # API route handlers (85+ files)
│   │   ├── s/[id]/             # Surgery-specific routes
│   │   │   ├── admin/          # Surgery admin dashboard
│   │   │   ├── appointments/   # Appointments directory
│   │   │   ├── clinical-review/ # Clinical review workflow
│   │   │   └── dashboard/     # Surgery dashboard
│   │   ├── super/              # Superuser utilities
│   │   ├── symptom/[id]/      # Symptom detail pages
│   │   ├── page.tsx            # Landing page (redirects authenticated users)
│   │   └── layout.tsx          # Root layout with providers
│   ├── components/             # React components (30+ components)
│   │   ├── appointments/       # Appointments directory components
│   │   ├── rich-text/          # TipTap rich text editor
│   │   └── [ComponentName].tsx
│   ├── context/                # React Context providers
│   │   └── SurgeryContext.tsx  # Surgery selection context
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Shared utilities and helpers
│   │   ├── auth.ts             # NextAuth configuration
│   │   ├── rbac.ts             # Role-based access control
│   │   ├── prisma.ts           # Prisma client singleton
│   │   ├── features.ts         # Feature flag logic
│   │   ├── staffTypes.ts       # Staff type utilities
│   │   └── api-contracts.ts    # Zod schemas for API validation
│   ├── server/                 # Server-only utilities
│   │   ├── effectiveSymptoms.ts # Symptom merging logic
│   │   ├── highlights.ts       # Text highlighting rules
│   │   └── updateRequiresClinicalReview.ts
│   ├── types/                  # TypeScript type definitions
│   └── middleware.ts           # Next.js middleware for route protection
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/              # Database migrations
│   └── seed.ts                 # Database seeding script
├── public/                      # Static assets (images, logos)
├── scripts/                     # Utility scripts (migrations, data creation)
└── docs/                        # Documentation (user guides, migration notes)
```

### Key Directories

- **`src/app/api/`**: Contains 85+ API route files organised by feature:
  - `/admin/*`: Admin-only endpoints (symptoms, users, surgeries, clinical review, appointments)
  - `/appointments/*`: Appointment directory endpoints
  - `/symptoms/*`: Public symptom endpoints
  - `/auth/*`: Authentication endpoints
  - `/features/*`: Feature flag management
  - `/highlights/*`: Text highlighting configuration
  - `/image-icons/*`: Image icon management
  - `/suggestions/*`: User feedback/suggestions
  - `/engagement/*`: Analytics endpoints

- **`src/components/`**: Reusable UI components including:
  - `SymptomCard.tsx`: Symptom display cards
  - `ClinicalReviewPanel.tsx`: Clinical review workflow UI
  - `SymptomLibraryExplorer.tsx`: File-explorer style symptom management
  - `EngagementAnalytics.tsx`: Analytics dashboard
  - `RichTextEditor.tsx`: TipTap-based editor
  - `appointments/`: Appointments directory components (AppointmentCard, AppointmentEditModal, AppointmentCsvUpload, StaffTypesManager)

- **`src/lib/`**: Core business logic and utilities:
  - `rbac.ts`: Permission checking and role management
  - `effectiveSymptoms.ts`: Merges base symptoms with overrides
  - `features.ts`: Feature flag evaluation
  - `api-contracts.ts`: Zod schemas for type-safe API validation

---

## 3. Database Schema (Prisma)

### Core Models

#### **User**
- `id`: String (CUID)
- `email`: String (unique)
- `name`: String?
- `password`: String? (bcrypt hash)
- `globalRole`: String (`"USER"` | `"SUPERUSER"`)
- `defaultSurgeryId`: String? (FK to Surgery)
- `isTestUser`: Boolean (for usage limits)
- `symptomUsageLimit`: Int? (null = unlimited)
- `symptomsUsed`: Int (counter)
- **Relations**: memberships (UserSurgery[]), defaultSurgery, clinicalReviews, symptomReviewStatuses, userFeatureFlags

#### **Surgery**
- `id`: String (CUID)
- `name`: String (unique)
- `slug`: String? (optional, for backward compatibility)
- `adminEmail`: String? (unique)
- `adminPassHash`: String? (bcrypt hash)
- `requiresClinicalReview`: Boolean (default: true)
- `lastClinicalReviewAt`: DateTime?
- `lastClinicalReviewerId`: String? (FK to User)
- `enableDefaultHighRisk`: Boolean (default: true)
- `enableBuiltInHighlights`: Boolean (default: true)
- `enableImageIcons`: Boolean (default: true)
- **Relations**: users (UserSurgery[]), defaultUsers, highRiskLinks, defaultHighRiskButtons, highlightRules, symptomOverrides, customSymptoms, suggestions, events, symptomReviews, symptomStatuses, surgeryFeatureFlags, appointmentTypes, appointmentStaffTypes

#### **UserSurgery** (Junction Table)
- `id`: String (CUID)
- `userId`: String (FK to User)
- `surgeryId`: String (FK to Surgery)
- `role`: String (`"STANDARD"` | `"ADMIN"`)
- **Unique**: [userId, surgeryId]

#### **BaseSymptom**
- `id`: String (CUID)
- `slug`: String (unique)
- `name`: String
- `ageGroup`: String (`'U5'` | `'O5'` | `'Adult'`)
- `briefInstruction`: String?
- `highlightedText`: String?
- `instructions`: String? (legacy markdown)
- `instructionsJson`: String? (ProseMirror JSON as string)
- `instructionsHtml`: String? (HTML with colour support)
- `linkToPage`: String?
- `variants`: Json? (age/scenario-tailored advice)
- `isDeleted`: Boolean (soft delete)
- `lastEditedBy`: String?
- `lastEditedAt`: DateTime?
- **Relations**: overrides (SurgerySymptomOverride[]), events (EngagementEvent[])

#### **SurgerySymptomOverride**
- `id`: String (CUID)
- `surgeryId`: String (FK to Surgery)
- `baseSymptomId`: String (FK to BaseSymptom)
- Fields mirror BaseSymptom (all nullable to override selectively)
- `isHidden`: Boolean (if true, symptom hidden for this surgery)
- `lastEditedBy`: String?
- `lastEditedAt`: DateTime?
- **Unique**: [surgeryId, baseSymptomId]

#### **SurgeryCustomSymptom**
- `id`: String (CUID)
- `surgeryId`: String (FK to Surgery)
- `slug`: String (unique per surgery)
- Fields mirror BaseSymptom
- `isDeleted`: Boolean (soft delete)
- **Unique**: [surgeryId, slug]

#### **SymptomReviewStatus**
- `id`: String (CUID)
- `surgeryId`: String (FK to Surgery)
- `symptomId`: String (effective symptom ID - base or custom)
- `ageGroup`: String? (`"U5"` | `"O5"` | `"Adult"` | null)
- `status`: SymptomReviewState (`PENDING` | `APPROVED` | `CHANGES_REQUIRED`)
- `lastReviewedAt`: DateTime?
- `lastReviewedById`: String? (FK to User)
- `reviewNote`: String? (optional note from reviewer)
- **Unique**: [surgeryId, symptomId, ageGroup]

#### **SurgerySymptomStatus**
- `id`: String (CUID)
- `surgeryId`: String (FK to Surgery)
- `baseSymptomId`: String? (FK to BaseSymptom)
- `customSymptomId`: String? (FK to SurgeryCustomSymptom)
- `isEnabled`: Boolean (default: true)
- `isOverridden`: Boolean (default: false)
- `lastEditedAt`: DateTime?
- `lastEditedBy`: String?

#### **EngagementEvent**
- `id`: String (CUID)
- `surgeryId`: String? (FK to Surgery)
- `baseId`: String (FK to BaseSymptom)
- `userEmail`: String?
- `event`: String (e.g., `"view_symptom"`)
- `createdAt`: DateTime

#### **Suggestion**
- `id`: String (CUID)
- `surgeryId`: String? (FK to Surgery)
- `baseId`: String? (FK to BaseSymptom)
- `symptom`: String (user-typed symptom name)
- `userEmail`: String?
- `text`: String (suggestion text)
- `createdAt`: DateTime
- **Note**: `status` and `updatedAt` fields commented out in schema (TODO: re-add)

#### **HighlightRule**
- `id`: String (CUID)
- `surgeryId`: String? (null = global rule)
- `phrase`: String (text to highlight)
- `textColor`: String (default: `"#FFFFFF"`)
- `bgColor`: String (default: `"#6A0DAD"` purple)
- `isEnabled`: Boolean (default: true)
- **Unique**: [surgeryId, phrase]

#### **HighRiskLink**
- `id`: String (CUID)
- `surgeryId`: String (FK to Surgery)
- `label`: String (e.g., `"Anaphylaxis"`, `"Stroke"`)
- `symptomSlug`: String?
- `symptomId`: String?
- `orderIndex`: Int (default: 0)
- **Unique**: [surgeryId, label]

#### **DefaultHighRiskButtonConfig**
- `id`: String (CUID)
- `surgeryId`: String? (null = system-wide default)
- `buttonKey`: String (e.g., `"anaphylaxis"`, `"stroke"`)
- `label`: String (display label)
- `symptomSlug`: String
- `isEnabled`: Boolean (default: true)
- `orderIndex`: Int (default: 0)
- **Unique**: [surgeryId, buttonKey]

#### **ImageIcon**
- `id`: String (CUID)
- `phrase`: String (phrase to match in briefInstruction)
- `filePath`: String (path to uploaded image)
- `imageUrl`: String (URL for serving)
- `alt`: String? (alt text)
- `width`: Int?
- `height`: Int?
- `cardSize`: String (`"small"` | `"medium"` | `"large"`)
- `instructionSize`: String (`"small"` | `"medium"` | `"large"`)
- `isEnabled`: Boolean (default: true)
- `surgeryId`: String? (null = global icon)
- `createdBy`: String (superuser email)
- **Unique**: [phrase, surgeryId]

#### **Feature** (Feature Flags)
- `id`: String (CUID)
- `key`: String (unique, e.g., `"ai_instructions"`, `"ai_training"`)
- `name`: String
- `description`: String?
- **Relations**: surgeryFlags, userFlags

#### **SurgeryFeatureFlag**
- `id`: String (CUID)
- `surgeryId`: String (FK to Surgery)
- `featureId`: String (FK to Feature)
- `enabled`: Boolean (default: false)
- **Unique**: [surgeryId, featureId]

#### **UserFeatureFlag**
- `id`: String (CUID)
- `userId`: String (FK to User)
- `featureId`: String (FK to Feature)
- `enabled`: Boolean (default: false)
- **Unique**: [userId, featureId]

#### **SymptomHistory** (Audit Trail)
- `id`: String (CUID)
- `symptomId`: String
- `source`: String (`'base'` | `'override'` | `'custom'`)
- `previousText`: String? (deprecated)
- `newText`: String (deprecated)
- `previousBriefInstruction`: String?
- `newBriefInstruction`: String?
- `previousInstructionsHtml`: String?
- `newInstructionsHtml`: String?
- `editorName`: String?
- `editorEmail`: String?
- `modelUsed`: String? (AI model or `"REVERT"`)
- `changedAt`: DateTime

#### **SurgeryOnboardingProfile**
- One-to-one with each `Surgery`; stores onboarding answers as `profileJson` (JSON)
- `profileJson` includes an `appointmentModel` object with archetypes such as routine continuity GP, GP triage within 48h, urgent same-day phone, urgent same-day F2F, and other clinician direct bookings. Each archetype captures `enabled`, `localName`, `clinician role`, and a one-sentence `description`
- Tracks completion status via `completed` and `completedAt`

#### **TokenUsageLog** (AI Cost Tracking)
- `id`: String (CUID)
- `createdAt`: DateTime
- `userEmail`: String?
- `route`: String (e.g., `"improveInstruction"`, `"explainInstruction"`)
- `modelUsed`: String
- `promptTokens`: Int
- `completionTokens`: Int
- `totalTokens`: Int
- `estimatedCostUsd`: Float

#### **AppointmentType**
- `id`: String (CUID)
- `surgeryId`: String? (FK to Surgery, null = system-wide)
- `name`: String
- `staffType`: String? (e.g., "PN" | "HCA" | "Dr" | "All")
- `durationMins`: Int?
- `colour`: String? (hex or tailwind token)
- `notes`: String?
- `isEnabled`: Boolean (default: true)
- `isDefault`: Boolean (default: false)
- `lastEditedBy`: String?
- `lastEditedAt`: DateTime?

#### **AppointmentStaffType**
- `id`: String (CUID)
- `surgeryId`: String? (null = system-wide default)
- `label`: String (display label, e.g., "Practice Nurse", "Health Care Assistant")
- `normalizedLabel`: String (normalised for matching)
- `defaultColour`: String? (hex or tailwind token)
- `orderIndex`: Int (default: 0)
- `isBuiltIn`: Boolean (default: false)
- `isEnabled`: Boolean (default: true)
- **Unique**: [surgeryId, normalizedLabel]

#### **NextAuth Models**
- `Account`: OAuth account linking
- `Session`: User sessions
- `VerificationToken`: Email verification tokens

### Enums

- `SymptomReviewState`: `PENDING` | `APPROVED` | `CHANGES_REQUIRED`

### Database Connection
- **Provider**: PostgreSQL (production), SQLite optional for local dev
- **Connection**: `DATABASE_URL` environment variable
- **Migrations**: Prisma migrations in `/prisma/migrations/`
- **Auto-migration**: Runs on Vercel deployments via `postinstall` script

---

## 4. API Endpoints

### Authentication Endpoints

- **`POST /api/auth/[...nextauth]`**: NextAuth.js handler (login, session management)
- **`POST /api/auth/super-login`**: Superuser login endpoint
- **`POST /api/auth/surgery-login`**: Surgery-specific login
- **`GET /api/auth/logout`**: Logout endpoint

### Public Symptom Endpoints

- **`GET /api/symptoms`**: Get effective symptoms for current surgery
  - Query params: `letter` (A-Z filter), `q` (search query), `surgery` (surgery slug)
  - Returns: Filtered list of effective symptoms
  - Cached: 60s public cache

- **`GET /api/symptoms/[id]`**: Get specific symptom by ID
- **`GET /api/symptoms/by-name`**: Get symptom by name (case-insensitive)
- **`POST /api/symptoms/create`**: Create new symptom (admin only)
- **`POST /api/symptoms/promote`**: Promote custom symptom to base (superuser only)

### Admin Symptom Management

- **`GET /api/admin/symptoms`**: Get all symptoms (superuser) or surgery-specific (admin)
  - Query params: `letter`, `q` (search)
- **`POST /api/admin/symptoms`**: Create base symptom (superuser) or custom symptom (admin)
- **`DELETE /api/admin/symptoms`**: Soft delete symptom
  - Body: `{ scope: "BASE" | "SURGERY", baseSymptomId?, surgeryId?, customSymptomId? }`
- **`PATCH /api/admin/symptoms/[id]`**: Update symptom
- **`POST /api/admin/symptoms/[id]`**: Duplicate symptom
- **`DELETE /api/admin/symptoms/[id]`**: Delete symptom

### Symptom Overrides

- **`GET /api/admin/overrides`**: Get all overrides for surgery
- **`POST /api/admin/overrides`**: Create/update override
- **`DELETE /api/admin/overrides`**: Delete override

### Clinical Review Endpoints

- **`GET /api/admin/clinical-review-data`**: Get review status data for surgery
- **`POST /api/admin/clinical-review`**: Reset all review statuses to PENDING
  - Body: `{ action: "RESET_ALL", surgeryId: string }`
- **`POST /api/admin/clinical-review/bulk-approve`**: Bulk approve symptoms
- **`POST /api/admin/review-status`**: Update individual symptom review status
  - Body: `{ surgeryId, symptomId, ageGroup?, newStatus, reviewNote? }`

### AI Customisation
- **`POST /api/surgeries/[surgeryId]/ai/customise-instructions`**: Uses the surgery’s onboarding profile and appointment model with Azure OpenAI to generate surgery-specific instruction overrides; writes to `SurgerySymptomOverride` and `SymptomHistory`, and marks all generated changes as `PENDING` in `SymptomReviewStatus` for clinical review before use

### Admin Metrics / Setup Checklist
- **`GET /api/admin/metrics`**: Aggregates setup checklist status (onboarding, appointment model, AI customisation presence, pending clinical review count) and suggestions/clinical review counts to power the Setup Checklist tab and admin badges
- **`POST /api/admin/complete-review`**: Complete clinical review (remove warning banner)
- **`POST /api/admin/request-rereview`**: Request re-review (reset to PENDING)

### User Management

- **`GET /api/admin/users`**: List all users (superuser only)
- **`POST /api/admin/users`**: Create user
- **`PATCH /api/admin/users/[id]`**: Update user
- **`DELETE /api/admin/users/[id]`**: Delete user
- **`POST /api/admin/users/[id]/reset-password`**: Reset user password
- **`GET /api/admin/users/[id]/memberships`**: Get user's surgery memberships
- **`POST /api/admin/users/[id]/memberships`**: Add membership
- **`PATCH /api/admin/users/[id]/memberships/[membershipId]`**: Update membership role
- **`DELETE /api/admin/users/[id]/memberships/[membershipId]`**: Remove membership

### Surgery Management

- **`GET /api/admin/surgeries`**: List all surgeries (superuser only)
- **`POST /api/admin/surgeries`**: Create surgery
- **`PATCH /api/admin/surgeries/[id]`**: Update surgery
- **`DELETE /api/admin/surgeries/[id]`**: Delete surgery
- **`PATCH /api/admin/surgery-settings`**: Update surgery settings (high-risk buttons, highlights, image icons)

### Surgery-Specific Endpoints

- **`GET /api/s/[surgeryId]/members`**: List surgery members
- **`POST /api/s/[surgeryId]/members`**: Add member to surgery
- **`PATCH /api/s/[surgeryId]/members/[userId]`**: Update member role
- **`DELETE /api/s/[surgeryId]/members/[userId]`**: Remove member
- **`POST /api/s/[surgeryId]/members/[userId]/reset-password`**: Reset member password

### Feature Flags

- **`GET /api/features`**: List all features (superuser/admin only)
- **`GET /api/surgeryFeatures`**: Get surgery-level feature flags
- **`POST /api/surgeryFeatures`**: Update surgery feature flags
- **`GET /api/userFeatures`**: Get user-level feature flags
- **`POST /api/userFeatures`**: Update user feature flags
- **`GET /api/my/features`**: Get enabled features for current user

### Highlighting

- **`GET /api/highlights`**: Get highlight rules for surgery
- **`POST /api/highlights`**: Create highlight rule
- **`PATCH /api/highlights/[id]`**: Update highlight rule
- **`DELETE /api/highlights/[id]`**: Delete highlight rule

### High-Risk Buttons

- **`GET /api/highrisk`**: Get high-risk buttons for surgery
- **`GET /api/admin/highrisk`**: Get all high-risk links (admin)
- **`POST /api/admin/highrisk`**: Create high-risk link
- **`PATCH /api/admin/highrisk`**: Update high-risk links order
- **`PATCH /api/admin/highrisk/[id]`**: Update specific link
- **`DELETE /api/admin/highrisk/[id]`**: Delete link
- **`GET /api/admin/default-highrisk-buttons`**: Get default button configs
- **`POST /api/admin/default-highrisk-buttons`**: Create default button
- **`PATCH /api/admin/default-highrisk-buttons`**: Update default buttons
- **`DELETE /api/admin/default-highrisk-buttons`**: Delete default button

### Image Icons

- **`GET /api/image-icons`**: Get image icons for surgery
- **`POST /api/image-icons`**: Upload/create image icon
- **`PATCH /api/image-icons/[id]`**: Update image icon
- **`DELETE /api/image-icons/[id]`**: Delete image icon

### Appointments Directory

- **`GET /api/appointments`**: Get appointment types for surgery
  - Query params: `surgeryId` (required), `q` (search query)
  - Returns: Filtered list of enabled appointment types

- **`GET /api/appointments/staff-types`**: Get staff types for surgery
  - Query params: `surgeryId` (required)
  - Returns: List of staff types (system-wide and surgery-specific)

- **`GET /api/admin/appointments`**: Get all appointments for surgery (admin)
- **`POST /api/admin/appointments`**: Create appointment type
- **`PATCH /api/admin/appointments/[id]`**: Update appointment type
- **`DELETE /api/admin/appointments/[id]`**: Delete appointment type
- **`POST /api/admin/appointments/import`**: Bulk import appointments from CSV

- **`GET /api/admin/appointments/staff-types`**: Get all staff types (admin)
- **`POST /api/admin/appointments/staff-types`**: Create staff type
- **`PATCH /api/admin/appointments/staff-types/[id]`**: Update staff type
- **`DELETE /api/admin/appointments/staff-types/[id]`**: Delete staff type

### Suggestions (User Feedback)

- **`GET /api/suggestions`**: Get suggestions (admin only)
- **`POST /api/suggestions`**: Submit suggestion (public)
- **`DELETE /api/suggestions`**: Delete suggestion
- **`PATCH /api/suggestions`**: Update suggestion status

### Engagement Analytics

- **`GET /api/engagement/top`**: Get top symptoms by engagement
- **`GET /api/aiUsageSummary`**: Get AI usage/cost summary (superuser only)

### AI Endpoints

- **`POST /api/improveInstruction`**: Improve instruction using AI (feature flag gated)
- **`POST /api/explainInstruction`**: Generate patient-friendly explanation (feature flag gated)
- **`GET /api/revertInstruction`**: Get instruction history for revert
- **`PATCH /api/revertInstruction`**: Revert instruction to previous version
- **`PATCH /api/updateInstruction`**: Update instruction content

### Utility Endpoints

- **`GET /api/effectiveSymptoms`**: Get effective symptoms (server-side helper)
- **`GET /api/symptom-card-data`**: Get symptom card display data
- **`GET /api/symptomPreview`**: Preview symptom content
- **`GET /api/surgeries/list`**: List surgeries (public)
- **`GET /api/user/profile`**: Get current user profile
- **`POST /api/user/change-password`**: Change user password

### Debug/Development Endpoints

- **`GET /api/debug`**: Debug endpoint
- **`GET /api/debug-session`**: Debug session data
- **`GET /api/debug-users`**: Debug user data
- **`POST /api/test-db`**: Test database connection
- **`POST /api/test-surgery`**: Test surgery creation
- **`POST /api/create-user`**: Create test user
- **`POST /api/seed`**: Seed database (protected)
- **`POST /api/seed-minimal`**: Minimal seed
- **`POST /api/seed-simple`**: Simple seed
- **`POST /api/admin/clear-all-data`**: Clear all data (superuser only)
- **`POST /api/admin/fix-test-users`**: Fix test user usage counters
- **`POST /api/admin/test-users/reset-usage`**: Reset test user usage
- **`POST /api/fix-user-passwords`**: Fix password hashes
- **`POST /api/fix-surgery-slugs`**: Fix surgery slugs
- **`POST /api/migrate-passwords`**: Migrate passwords
- **`POST /api/admin/migrate-instructions`**: Migrate instructions format
- **`POST /api/admin/upload-excel`**: Upload symptoms via Excel

### Authentication & RBAC

All admin endpoints require authentication and appropriate role checks:
- **Superuser**: Access to `/api/admin/*` endpoints
- **Surgery Admin**: Access to surgery-specific admin endpoints
- **Standard User**: Access to public symptom endpoints only

RBAC checks are performed server-side using helpers from `src/lib/rbac.ts`:
- `requireAuth()`: Ensures user is authenticated
- `requireSuperuser()`: Ensures user is superuser
- `requireSurgeryAdmin(surgeryId)`: Ensures user can manage surgery
- `requireSurgeryAccess(surgeryId)`: Ensures user can view surgery

---

## 5. Frontend & UX Flow

### Main Navigation Flow

1. **Landing Page** (`/`):
   - Public landing page with feature overview
   - Authenticated users redirected to their default surgery (`/s/[surgeryId]`)

2. **Login** (`/login`):
   - Credentials-based login form
   - Redirects to default surgery on success

3. **Symptom Library** (`/s/[surgeryId]`):
   - Main signposting tool interface
   - Symptom gallery with search and filtering
   - Age group filters (Under-5, Over-5, Adult)
   - Alphabet strip navigation
   - Symptom cards with brief instructions
   - Click to view full instructions

4. **Symptom Detail** (`/symptom/[id]`):
   - Full instruction page with:
     - Brief instruction summary
     - Detailed instructions (HTML with highlighting)
     - Age-specific variants (if available)
     - High-risk buttons (Anaphylaxis, Stroke, etc.)
     - Link to related pages
     - Image icons (if enabled)
   - Clinical review banner (if `requiresClinicalReview` is true)

5. **Appointments Directory** (`/s/[surgeryId]/appointments`):
   - Reception-friendly appointment catalogue
   - Search and filter appointment types
   - Filter by staff team (Practice Nurse, HCA, GP, etc.)
   - Appointment cards with colour coding
   - Admin features: Create, edit, delete appointments
   - CSV import for bulk appointment management
   - Staff type management (customise staff teams)

6. **Admin Dashboard** (`/admin`):
   - **Superuser**: Global admin dashboard
     - Tabs: Symptom Library, Clinical Review, Data Management, Highlights, High-Risk Buttons, Engagement, Suggestions, Features, System Management, AI Usage
   - **Surgery Admin**: Surgery-specific admin (`/s/[surgeryId]/admin`)
     - Tabs: Symptom Library, Clinical Review, Highlights, High-Risk Buttons, Engagement, Suggestions, Features, User Management, Setup Checklist (feature-flagged by `ai_surgery_customisation`)
     - Setup Checklist shows onboarding completion, appointment model configuration, whether AI customisation has run, pending clinical review count, and an overall “ready to go live” status, with direct links to the onboarding wizard, AI setup, and clinical review
     - Onboarding wizard includes an “Appointment Types & Naming” step (Step 2.5) where surgeries define local appointment archetypes for AI to use

7. **Clinical Review** (`/s/[surgeryId]/clinical-review`):
   - Review dashboard showing all symptoms with review status
   - Filter by status (PENDING, APPROVED, CHANGES_REQUIRED)
   - Bulk approve functionality
   - Individual status updates with notes
   - Request re-review button

8. **Superuser Dashboard** (`/super`):
   - System-wide utilities and analytics

### Key UI Components

- **`HomePageClient`**: Main symptom library interface
  - Symptom grid with virtualisation
  - Search box
  - Age filters
  - Alphabet strip
  - Surgery selector (if user has multiple surgeries)

- **`SymptomCard`**: Individual symptom card display
  - Brief instruction preview
  - Image icon (if enabled)
  - Age group badge
  - Click to view details

- **`SymptomLibraryExplorer`**: File-explorer style symptom management
  - Enable/disable toggles
  - Preview modal
  - Edit functionality
  - Add new symptom button

- **`ClinicalReviewPanel`**: Clinical review workflow UI
  - Status badges (PENDING, APPROVED, CHANGES_REQUIRED)
  - Review actions (approve, request changes)
  - Reviewer notes
  - Bulk operations

- **`EngagementAnalytics`**: Analytics dashboard
  - Top symptoms by views
  - User engagement metrics
  - Time-based filtering

- **`RichTextEditor`**: TipTap-based editor
  - ProseMirror JSON storage
  - HTML output with colour support
  - Highlight preview
  - Undo/redo

- **`InstructionView`**: Instruction display component
  - Renders HTML with highlighting
  - Applies highlight rules automatically
  - Supports colour-coded text (Green/Orange/Red/Pink-Purple slots)

- **`AppointmentsPageClient`**: Appointments directory interface
  - Appointment grid with search and filtering
  - Staff type filter dropdown
  - Admin controls for managing appointments
  - CSV upload functionality

- **`AppointmentCard`**: Individual appointment type card
  - Colour-coded display
  - Staff type badge
  - Duration and notes
  - Edit/delete actions (admin only)

- **`StaffTypesManager`**: Staff type management component
  - Create/edit/delete staff types
  - Customise staff team labels
  - Set default colours for staff types

### State Management

- **React Context**: `SurgeryContext` for surgery selection
- **React Hooks**: Standard hooks for component state
- **Server Components**: Next.js 15 App Router uses server components by default
- **Client Components**: Marked with `'use client'` directive
- **Session Management**: NextAuth.js handles session state

### Key UI Features

- **Dynamic Highlighting**: Automatic highlighting of keywords (Pharmacy First, Red Slot, etc.)
- **Image Icons**: Optional icons on symptom cards and instruction pages
- **High-Risk Buttons**: Prominent buttons linking to critical symptoms (Anaphylaxis, Stroke, etc.)
- **Clinical Review Banner**: Yellow warning banner when review is pending
- **Responsive Design**: Mobile, tablet, and desktop optimised
- **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation and screen reader support

---

## 6. Authentication & Roles

### Authentication System

- **Provider**: NextAuth.js with Credentials provider
- **Session Strategy**: JWT (stored in HTTP-only cookies)
- **Password Hashing**: bcryptjs (12 salt rounds)
- **Session Management**: Server-side session validation

### Role Types

1. **SUPERUSER** (Global Role):
   - `globalRole: "SUPERUSER"`
   - Access to all surgeries and users
   - Can create/edit/delete base symptoms
   - Can manage feature flags per surgery
   - Access to `/admin` and `/super` routes
   - Can switch between any surgery

2. **ADMIN** (Per-Surgery Role):
   - `globalRole: "USER"` with `UserSurgery.role: "ADMIN"`
   - Manage users within assigned surgery
   - Access to `/s/[surgeryId]/admin` routes
   - Can create/edit/delete custom symptoms
   - Can manage feature flags per user (if surgery flag enabled)
   - Can perform clinical review
   - Can manage symptom library for their surgery

3. **STANDARD** (Per-Surgery Role):
   - `globalRole: "USER"` with `UserSurgery.role: "STANDARD"`
   - Use signposting tool within assigned surgery
   - Access to `/s/[surgeryId]` routes
   - No admin privileges
   - Can submit suggestions

### Access Control Implementation

- **Middleware** (`src/middleware.ts`):
  - Protects `/admin/*` routes (superuser or surgery admin)
  - Protects `/s/[surgeryId]/*` routes (surgery members or superuser)
  - Redirects unauthenticated users to `/login`

- **RBAC Helpers** (`src/lib/rbac.ts`):
  - `getSessionUser()`: Get current user from session
  - `can(user)`: Permission checker instance
  - `requireAuth()`: Throw if not authenticated
  - `requireSuperuser()`: Throw if not superuser
  - `requireSurgeryAdmin(surgeryId)`: Throw if cannot manage surgery
  - `requireSurgeryAccess(surgeryId)`: Throw if cannot view surgery

- **API Route Protection**: All admin endpoints call RBAC helpers before processing

### Test Users

- `isTestUser: true`: Test users have usage limits
- `symptomUsageLimit`: Maximum symptoms that can be viewed (null = unlimited)
- `symptomsUsed`: Counter incremented on symptom view
- Usage checked in `src/lib/test-user-limits.ts`

---

## 7. Deployment & Environment

### Deployment Platform

- **Hosting**: Vercel
- **Database**: Neon Postgres (production)
- **Build**: Next.js production build
- **Migrations**: Auto-run on deployment via `postinstall` script

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"
# For local dev (SQLite): DATABASE_URL="file:./dev.db"

# NextAuth Configuration
NEXTAUTH_SECRET="your-secret-key-change-this"
NEXTAUTH_URL="https://your-domain.com"  # or "http://localhost:3000" for dev

# App Configuration
NEXT_PUBLIC_APP_VERSION="Beta v1.0"

# Feature Flags
DONATIONS_ENABLED="false"

# Database Seeding (for production setup)
SEED_SECRET="your-seed-secret-here"

# Azure OpenAI Configuration (for AI features)
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
AZURE_OPENAI_API_KEY="your-api-key-here"
AZURE_OPENAI_DEPLOYMENT="your-deployment-name"
AZURE_OPENAI_API_VERSION="2024-02-15-preview"

# Cost tracking (defaults based on gpt-4o-mini pricing)
AZURE_OPENAI_COST_INPUT_PER_1K_USD=0.0005
AZURE_OPENAI_COST_OUTPUT_PER_1K_USD=0.0015
USD_TO_GBP_RATE=0.80
```

### Build Configuration

- **`next.config.js`**:
  - Webpack config excludes jsdom from bundling
  - ESLint errors ignored during builds
  - TypeScript errors ignored during builds (⚠️ should be fixed)
  - Prisma client marked as external package

### Database Migrations

- **Location**: `/prisma/migrations/`
- **Auto-deploy**: Runs `prisma migrate deploy` on Vercel via `postinstall` script
- **Manual**: `npm run db:migrate:dev` (development), `npm run db:migrate:deploy` (production)

### External Integrations

- **Azure OpenAI**: Used for:
  - Instruction improvement (`/api/improveInstruction`)
  - Patient-friendly explanations (`/api/explainInstruction`)
  - Training mode quizzes (future)
- **Cost Tracking**: All AI requests logged to `TokenUsageLog` table with estimated USD cost

---

## 8. Current Known Issues / TODOs

### TODO Comments Found

1. **`src/components/EngagementAnalytics.tsx:427`**:
   - `// TODO: Implement CSV export functionality`

2. **`src/app/help/page.tsx:94`**:
   - `{/* TODO: Implement PDF generation and download functionality */}`

3. **`src/app/api/symptoms/promote/route.ts:46`**:
   - `// TODO: Add audit logging for create/promote actions (SymptomHistory)`

4. **`src/app/api/symptoms/create/route.ts:67-68, 149-150`**:
   - `// TODO: Improve duplicate check with fuzzy matching (Levenshtein/trigram) later`
   - `// TODO: Add audit logging for create/promote actions (SymptomHistory)`

5. **`src/app/api/image-icons/route.ts:175`**:
   - `// TODO: Get actual dimensions from buffer or use a lightweight image library`

6. **`prisma/schema.prisma:176`**:
   - `// TODO: Add these fields back when database schema is updated`
   - Refers to `status` and `updatedAt` fields in `Suggestion` model

### Known Issues

1. **TypeScript Build Errors**: `next.config.js` ignores TypeScript errors during builds (should be fixed)

2. **Suggestion Model**: `status` and `updatedAt` fields commented out in schema but referenced in code

3. **Image Processing**: Image icon uploads don't extract actual dimensions (uses placeholder values)

4. **Duplicate Detection**: Symptom creation doesn't use fuzzy matching for duplicate detection

5. **Audit Logging**: Some symptom creation/promotion actions don't log to `SymptomHistory`

### Technical Debt

- **Slug Support**: Surgery slugs are optional and supported for backward compatibility only. API routes accept both ID and slug, but ID is canonical.

- **Legacy Fields**: `instructions` (markdown) field exists for backward compatibility. Canonical format is `instructionsJson` (ProseMirror JSON) and `instructionsHtml` (HTML).

- **Test User Limits**: Test user usage limits are checked but may need refinement for production use.

---

## 9. Key Files and Entry Points

### Entry Points

- **`src/app/page.tsx`**: Root page (landing or redirect)
- **`src/app/layout.tsx`**: Root layout with providers
- **`src/middleware.ts`**: Route protection middleware
- **`src/app/api/auth/[...nextauth]/route.ts`**: NextAuth handler

### Core Business Logic

- **`src/lib/rbac.ts`**: Role-based access control
- **`src/lib/auth.ts`**: NextAuth configuration
- **`src/lib/features.ts`**: Feature flag evaluation
- **`src/lib/staffTypes.ts`**: Staff type utilities and normalisation
- **`src/server/effectiveSymptoms.ts`**: Symptom merging logic (base + overrides + custom)
- **`src/server/highlights.ts`**: Text highlighting rules
- **`src/lib/api-contracts.ts`**: Zod schemas for API validation

### Database

- **`prisma/schema.prisma`**: Database schema definition
- **`src/lib/prisma.ts`**: Prisma client singleton

### Key Components

- **`src/app/HomePageClient.tsx`**: Main symptom library UI
- **`src/app/admin/AdminPageClient.tsx`**: Admin dashboard
- **`src/app/s/[id]/appointments/AppointmentsPageClient.tsx`**: Appointments directory UI
- **`src/components/ClinicalReviewPanel.tsx`**: Clinical review workflow
- **`src/components/SymptomLibraryExplorer.tsx`**: Symptom management UI
- **`src/components/rich-text/RichTextEditor.tsx`**: TipTap editor

### Configuration

- **`next.config.js`**: Next.js configuration
- **`tsconfig.json`**: TypeScript configuration
- **`tailwind.config.ts`**: Tailwind CSS configuration
- **`package.json`**: Dependencies and scripts
- **`env.example`**: Environment variable template

### Scripts

- **`prisma/seed.ts`**: Database seeding script
- **`scripts/migrateInstructionsToHtml.ts`**: Instruction format migration
- **`scripts/create-sample-engagement.ts`**: Sample engagement data
- **`scripts/create-sample-suggestions.ts`**: Sample suggestions data

---

## Summary

The Signposting Webapp is a comprehensive multi-tenant NHS-style symptom signposting platform built with Next.js 15, TypeScript, Prisma, and PostgreSQL. It provides role-based access control, clinical review workflows, AI-powered features, an appointments directory for reception teams, and extensive customisation options for GP surgeries. The application follows modern best practices with server-side rendering, type-safe API contracts, and WCAG 2.1 AA accessibility compliance.

**Key Strengths**:
- Robust RBAC system with three-tier permissions
- Comprehensive clinical governance with review workflows
- Flexible symptom management (base + overrides + custom)
- Appointments directory with staff team filtering and CSV import
- Feature flag system for gradual rollouts
- AI integration with cost tracking
- Extensive API surface for admin operations

**Areas for Improvement**:
- Complete audit logging for all symptom changes
- Implement fuzzy matching for duplicate detection
- Fix TypeScript build errors (remove ignore flags)
- Add CSV export for analytics
- Complete image dimension extraction for icons
- Re-add suggestion status/updatedAt fields to schema

