# CLAUDE.md

This file provides guidance for AI assistants working with the **Signposting Toolkit** (nhs-signposting) codebase.

## Project Overview

A web-based signposting and care-navigation toolkit for UK NHS GP reception teams. It provides structured, clinically-approved guidance to help route patients to the right service. The application is multi-tenant (each "surgery" is an isolated tenant) with role-based access control, clinical governance workflows, AI-assisted content editing, workflow canvases, and a practice handbook (Admin Toolkit).

## Quick Reference

```bash
# Development
npm install          # Install deps (runs postinstall to generate Prisma client)
npm run dev          # Start Next.js dev server on localhost:3000

# Testing
npm test             # Run Jest test suite
npm run test:watch   # Jest in watch mode

# Validation
npm run typecheck    # TypeScript type checking (tsc --noEmit)
npm run lint         # ESLint (next lint)

# Database
npm run db:generate  # Generate Prisma client
npm run db:push      # Sync schema to database (dev only)
npm run db:migrate:dev    # Create migration (dev)
npm run db:migrate:deploy # Apply migrations (production)
npm run db:seed      # Seed initial data

# Build
npm run build        # Production build (runs prisma generate first)
npm run build:dev    # Dev build (generates + pushes schema + builds)
```

## Tech Stack

| Layer          | Technology                                       |
|----------------|--------------------------------------------------|
| Framework      | Next.js 15 (App Router) + React 18               |
| Language       | TypeScript 5 (strict mode)                        |
| Database       | PostgreSQL (Neon Postgres) via Prisma 6            |
| Auth           | NextAuth 4 (credentials provider, JWT sessions)   |
| Styling        | Tailwind CSS 3 with NHS color palette              |
| Rich Text      | TipTap (ProseMirror-based)                         |
| Workflow Canvas| React Flow 11                                      |
| Testing        | Jest 30 + Testing Library + ts-jest                |
| AI             | Azure OpenAI (gpt-4o-mini)                         |
| Deployment     | Vercel (serverless)                                |
| Validation     | Zod 4                                              |

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Login pages (admin-login, super-login)
│   ├── admin/              # Superuser admin dashboard
│   ├── api/                # REST API route handlers (~50 endpoint dirs)
│   ├── s/[id]/             # Surgery-scoped pages (main app shell)
│   │   ├── signposting/    # Symptom directory
│   │   ├── admin/          # Surgery admin settings
│   │   ├── admin-toolkit/  # Practice Handbook
│   │   ├── clinical-review/# Approval workflows
│   │   ├── appointments/   # Appointment directory
│   │   ├── workflow/       # Workflow canvas
│   │   ├── analytics/      # Usage analytics
│   │   └── dashboard/      # Surgery dashboard
│   ├── super/              # Superuser dashboard
│   └── symptom/[id]/       # Public symptom detail
├── components/             # React components (organized by feature)
│   ├── ui/                 # Shared UI primitives (Button, Input, Dialog, etc.)
│   ├── admin/              # Admin table, kebab menu, search
│   ├── admin-toolkit/      # Practice Handbook UI
│   ├── appointments/       # Appointment management
│   ├── editor/             # SafeTipTapEditor
│   ├── marketing/          # Landing page components
│   ├── workflow/           # Workflow canvas nodes & icons
│   └── __tests__/          # Component tests
├── context/                # React Context providers
│   ├── SurgeryContext.tsx   # Current surgery state
│   ├── CardStyleContext.tsx # Card display preferences
│   └── NavigationPanelContext.tsx
├── hooks/                  # Custom React hooks
├── lib/                    # Shared utilities
│   ├── auth.ts             # NextAuth configuration
│   ├── rbac.ts             # Role-based access control
│   ├── prisma.ts           # Prisma client singleton
│   ├── api-contracts.ts    # Shared TypeScript types for APIs
│   ├── features.ts         # Feature flag resolution
│   ├── highlighting.ts     # Highlight rule engine
│   ├── adminToolkitPermissions.ts  # Admin Toolkit RBAC
│   └── sanitizeHtml.ts     # HTML sanitization
├── server/                 # Server-only utilities
│   ├── effectiveSymptoms.ts    # Resolve base + overrides + custom symptoms
│   ├── effectiveWorkflows.ts   # Resolve workflow templates & instances
│   ├── adminToolkit.ts         # Admin Toolkit queries
│   ├── highlights.ts           # Compute active highlight rules
│   └── aiCustomiseInstructions.ts  # AI integration
├── navigation/             # Navigation module definitions
├── types/                  # TypeScript type extensions
│   ├── global.d.ts
│   └── next-auth.d.ts      # NextAuth session type augmentation
└── middleware.ts            # Route protection & RBAC enforcement
```

Key non-src directories:
- `prisma/` - Database schema (`schema.prisma`, ~1050 lines) and seed script
- `scripts/` - Build helpers and data migration scripts
- `docs/` - User/admin documentation (GitHub Pages)
- `public/images/` - Logos, favicons, OG images

## Architecture

### Multi-Tenancy

Every surgery is an isolated tenant identified by a UUID. Routes under `/s/[id]/` are scoped to a specific surgery. Data isolation is enforced at the query level via `surgeryId` filters throughout Prisma queries.

### Authentication & Authorization

Three-level role hierarchy:
1. **SUPERUSER** - Full system access across all surgeries
2. **ADMIN** - Surgery-level admin (manages symptoms, users, settings for their surgery)
3. **STANDARD** - Regular user within a surgery

Key auth patterns:
- `getSessionUser()` in `src/lib/rbac.ts` - retrieves authenticated user with memberships
- `can(user).manageSurgery(surgeryId)` - permission checks via `PermissionChecker`
- `requireAuth()`, `requireSuperuser()`, `requireSurgeryAdmin(surgeryId)` - guard functions that throw on failure
- Middleware at `src/middleware.ts` enforces route-level protection

### API Route Pattern

API routes use Next.js App Router `route.ts` files. Standard pattern:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, can } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const user = await getSessionUser()
  if (!user || !can(user).viewSurgery(id)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  // ... query and return data
}
```

Note: `context.params` is a Promise in Next.js 15 and must be awaited.

### Effective Data Resolution

The codebase uses a "base + override" pattern for symptoms and workflows:
- **BaseSymptom** - System-wide definitions
- **SurgerySymptomOverride** - Surgery-specific modifications
- **SurgeryCustomSymptom** - Surgery-created additions
- `effectiveSymptoms()` in `src/server/effectiveSymptoms.ts` merges these layers

### Content Formats

Instructions support multiple formats for backward compatibility:
- `instructions` - Legacy markdown
- `instructionsJson` - ProseMirror JSON (current editing format)
- `instructionsHtml` - Rendered HTML with styling

When modifying symptom content, preserve all three format fields.

### Feature Flags

Database-driven feature flags with two levels:
- `SurgeryFeatureFlag` - Enable/disable per surgery
- `UserFeatureFlag` - User-level override (only if surgery flag is enabled)
- Resolution logic in `src/lib/features.ts`

## Database

### Prisma Schema

The schema is at `prisma/schema.prisma` (~1050 lines, 40+ models). PostgreSQL is required (not SQLite).

Key conventions:
- Cascade deletes on child records when parent is deleted
- `isDeleted` boolean for soft deletes where needed
- `createdAt`/`updatedAt` timestamps on most models
- ProseMirror JSON and variant data stored as `String` (not native JSON)
- Indexes on frequently queried columns (`surgeryId`, `baseSymptomId`, `status`)

### Schema Changes

```bash
npm run db:migrate:dev    # Create a new migration during development
npm run db:push           # Quick schema sync without migration (dev only)
npm run db:migrate:deploy # Apply pending migrations (production)
```

Always run `npm run db:generate` after schema changes to regenerate the Prisma client.

## Code Conventions

### File Naming
- **React components**: PascalCase (e.g., `SymptomCard.tsx`)
- **Utilities/hooks**: camelCase (e.g., `useHighRiskButtons.ts`, `highlighting.ts`)
- **API routes**: kebab-case directories with `route.ts` handler files
- **Tests**: `*.test.ts` or `*.test.tsx` in `__tests__/` directories

### Imports
- Use the `@/*` path alias for all `src/` imports (never `../../../`)
- Server-only modules import `'server-only'` at the top
- Client components use `'use client'` directive

### React Patterns
- Server Components by default; add `'use client'` only for interactive components
- React Context with Provider wrapper pattern for shared state
- Custom hooks in `src/hooks/`
- No higher-order components; prefer hooks and composition

### TypeScript
- Strict mode enabled
- Shared API types in `src/lib/api-contracts.ts`
- NextAuth type extensions in `src/types/next-auth.d.ts`

### Styling
- Tailwind CSS utility classes throughout
- NHS color palette available via `nhs-*` prefixed classes (e.g., `bg-nhs-blue`, `text-nhs-dark-blue`)
- Key colors: `nhs-blue: #005EB8`, `nhs-dark-blue: #003087`, `nhs-green: #00A499`, `nhs-red: #DA020E`

### Shared UI Components (IMPORTANT)

**Always use the shared UI primitives** from `src/components/ui/` instead of writing inline Tailwind for common elements. Import from `@/components/ui`:

```typescript
import { Button, Input, Select, Textarea, FormField, Badge, Card, Dialog, AlertBanner } from '@/components/ui'
```

| Component | Use instead of | Key props |
|-----------|---------------|-----------|
| `Button` | `<button className="px-4 py-2 bg-nhs-blue...">` | `variant` (`primary`\|`secondary`\|`success`\|`danger`\|`danger-soft`\|`ghost`\|`link`), `size` (`sm`\|`md`\|`lg`), `loading`, `iconLeft`, `iconRight` |
| `Input` | `<input className="w-full px-3 py-2 border...">` | `error` (boolean for red ring) |
| `Select` | `<select className="w-full px-3 py-2 border...">` | `error` (boolean for red ring) |
| `Textarea` | `<textarea className="w-full px-3 py-2 border...">` | `error` (boolean for red ring) |
| `FormField` | Label + input + error `<div>` wrappers | `label`, `error`, `required`, `htmlFor` |
| `Badge` | `<span className="inline-flex px-2 py-0.5 rounded...">` | `color` (10 presets), `size` (`sm`\|`md`\|`lg`), `pill` |
| `Card` | `<div className="bg-white rounded-lg shadow-md...">` | `elevation` (`flat`\|`raised`\|`elevated`\|`floating`), `hoverable`, `padding` |
| `Dialog` | Custom `<div className="fixed inset-0 z-50...">` modals | `open`, `onClose`, `title`, `description`, `width`, `footer`, `initialFocusRef` |
| `AlertBanner` | `<div className="bg-red-50 border-l-4...">` | `variant` (`error`\|`warning`\|`success`\|`info`) |

**Do NOT** create new inline modal/dialog implementations — always use `Dialog`. It handles portal rendering, focus trapping, Escape key, body scroll lock, and ARIA attributes automatically.

### Error Handling
- API routes: try-catch with `NextResponse.json({ error: '...' }, { status: ... })`
- Allow Next.js redirect errors (`NEXT_REDIRECT`) to propagate - do not catch them
- Zod schemas for request body validation

### HTML Sanitization
- Server-side: `sanitize-html` via `src/lib/sanitizeHtml.ts`
- Client-side: `isomorphic-dompurify`
- Always sanitize user-provided HTML before storage or display

## Testing

- **Framework**: Jest 30 with jsdom environment
- **Utilities**: Testing Library (React, jest-dom, user-event)
- **Module aliases**: `@/*` mapped to `src/*` in jest config
- **Test files**: `__tests__/` directories or `*.test.ts(x)` suffix
- **Mocking**: Jest mocks for Prisma, API calls, and Next.js modules
- **Run**: `npm test` (all tests) or `npm run test:watch` (watch mode)

Test files are excluded from the TypeScript compilation (`tsconfig.json` excludes `**/*.test.ts`, `**/__tests__/**`).

## Build & Deployment

- **Hosting**: Vercel (serverless Node.js functions)
- **Database**: Neon Postgres
- **Build command**: `npm run vercel-build` (runs migrations then builds)
- **Build config note**: ESLint and TypeScript errors are ignored during production builds (`next.config.js` has `ignoreDuringBuilds: true` and `ignoreBuildErrors: true`)
- **Postinstall hook**: Generates Prisma client automatically after `npm install`

## Environment Variables

See `env.example` for the full list. Key variables:
- `DATABASE_URL` - PostgreSQL connection string (required)
- `NEXTAUTH_SECRET` - JWT signing secret (required)
- `NEXTAUTH_URL` - Auth callback URL (`http://localhost:3000` for dev)
- `AZURE_OPENAI_*` - Azure OpenAI configuration (for AI features)
- `SMTP_*` - Email delivery configuration

## Key Domain Concepts

- **Surgery** - An NHS GP practice (the primary tenant unit)
- **Symptom** - A patient symptom with triage instructions and age-group variants (U5/O5/Adult)
- **Clinical Review** - Approval workflow where symptoms must be clinically approved before going live
- **Highlight Rule** - Text pattern matching rules that apply colored highlights to instructions
- **High-Risk Link** - Quick-access buttons for urgent/high-risk symptoms
- **Admin Toolkit** - A practice handbook for internal documentation and procedures
- **Workflow** - Document processing workflows built on a React Flow canvas
- **Signposting** - The core act of directing a patient to the right service

## Common Pitfalls

1. **`context.params` must be awaited** - In Next.js 15, route handler params are Promises
2. **PostgreSQL only** - The Prisma schema uses PostgreSQL-specific features; do not change the provider
3. **Server-only imports** - Database and auth utilities use the `'server-only'` package; importing them in client components will cause build errors
4. **Content format consistency** - When updating symptom instructions, update all three format fields (markdown, JSON, HTML)
5. **Surgery scoping** - Always filter queries by `surgeryId` to maintain tenant isolation
6. **Redirect errors** - Next.js `redirect()` throws an error internally; do not wrap calls in try-catch that would swallow `NEXT_REDIRECT`

## Documentation Updates

When making user-facing changes to the application, always check whether the relevant documentation in `docs-site/pages/` needs updating. The mapping is:

- Feature changes → `docs-site/pages/features/`
- Admin/governance changes → `docs-site/pages/governance/`
- Getting started flow changes → `docs-site/pages/getting-started/`
- Developer/technical changes → `docs-site/pages/technical/`
- New releases → update the version banner in `docs-site/pages/index.mdx`

If you've made changes that affect how users interact with the app, update the docs as part of the same commit or PR. Don't wait for a separate docs pass.
