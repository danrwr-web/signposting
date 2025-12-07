# Developer Guide

This guide provides an overview of the Signposting Toolkit architecture, key folders, data model, and development workflow. It's designed to help developers understand the codebase and work safely within it.

---

## Architecture Overview

### Technology Stack

- **Next.js 15** — App Router with Server Components
- **TypeScript** — Strict type checking throughout
- **Prisma ORM** — Database access layer
- **Neon Postgres** — Managed PostgreSQL database
- **NextAuth** — Authentication (Credentials Provider + JWT)
- **Tailwind CSS** — Styling with NHS design tokens
- **Azure OpenAI** — AI features (server-side only)

### Rendering Strategy

The application uses a mix of:
- **Server Components** — Default for data fetching and rendering
- **Client Components** — For interactive UI (marked with `'use client'`)
- **Server Actions** — For data mutations (preferred over API routes)

---

## Key Folders

### `/src/app`

Next.js App Router structure:

- **`page.tsx`** — Pages and routes
- **`layout.tsx`** — Layouts and nested layouts
- **`route.ts`** — API route handlers
- **`(auth)`** — Authentication-related routes
- **`admin`** — Admin dashboard pages
- **`api`** — API endpoints (prefer Server Actions for mutations)
- **`s/[id]`** — Surgery-specific routes
- **`symptom`** — Symptom detail pages

### `/src/components`

React components organised by feature:

- **`admin/`** — Admin dashboard components
- **`appointments/`** — Appointment directory components
- **`rich-text/`** — Rich text editor components
- **Core components** — Shared UI components (cards, buttons, modals)

### `/src/lib`

Utility libraries and shared code:

- **`prisma.ts`** — Prisma client instance
- **`rbac.ts`** — Role-based access control utilities
- **`auth.ts`** — NextAuth configuration
- **`features.ts`** — Feature flag logic
- **`highlighting.ts`** — Highlight engine logic
- **`effectiveSymptoms.ts`** — Symptom resolution logic
- **`excel-parser.ts`** — CSV/Excel parsing utilities

### `/src/server`

Server-only utilities (marked with `'server-only'`):

- **`highlights.ts`** — Highlight rule management
- **`effectiveSymptoms.ts`** — Effective symptom resolution
- **`aiCustomiseInstructions.ts`** — AI instruction generation
- **`auth.ts`** — Server-side auth utilities
- **`updateRequiresClinicalReview.ts`** — Clinical review workflow

### `/prisma`

Database schema and migrations:

- **`schema.prisma`** — Database schema definition
- **`migrations/`** — Database migration files
- **`seed.ts`** — Database seeding script

---

## Data Model Summary

### Core Models

#### User & Authentication
- **`User`** — User accounts with global roles
- **`UserSurgery`** — Junction table for user-surgery memberships
- **`Session`** — NextAuth session management
- **`Account`** — NextAuth account providers

#### Surgeries
- **`Surgery`** — GP practice/surgery entities
- **`SurgerySymptomOverride`** — Local symptom modifications
- **`SurgeryCustomSymptom`** — Surgery-only symptoms

#### Symptoms
- **`BaseSymptom`** — Central symptom library
- **`SymptomReviewStatus`** — Clinical review states
- **`SymptomHistory`** — Change audit trail

#### Appointments
- **`AppointmentType`** — Appointment types per surgery
- **`AppointmentStaffType`** — Staff team definitions

#### Features & Configuration
- **`Feature`** — Feature definitions
- **`SurgeryFeatureFlag`** — Surgery-level feature toggles
- **`UserFeatureFlag`** — User-level feature overrides
- **`HighlightRule`** — Custom highlight rules
- **`ImageIcon`** — Icon definitions

#### Engagement
- **`EngagementEvent`** — Usage tracking
- **`Suggestion`** — User suggestions for improvements

---

## Server Actions

Server Actions are preferred for data mutations. They provide:
- Type safety
- Automatic revalidation
- Simpler client code
- Better error handling

### Where Server Actions Are Used

- Symptom updates and overrides
- Clinical review approvals
- Appointment directory CRUD
- Highlight rule management
- Feature flag updates
- User management

### Pattern

```typescript
'use server'

import 'server-only'
import { prisma } from '@/lib/prisma'

export async function updateSymptom(data: UpdateSymptomData) {
  // Server-side validation
  // RBAC checks
  // Database update
  // Return result
}
```

---

## Key Logic Locations

### Symptoms

- **Effective Symptom Resolution** — `src/server/effectiveSymptoms.ts`
  - Merges base symptoms with overrides and customs
  - Handles age group filtering
  - Manages clinical review status

- **Symptom Display** — `src/components/SymptomCard.tsx`, `src/components/InstructionView.tsx`
  - Card rendering
  - Instruction display
  - Highlight application

### Overrides

- **Override Management** — `src/app/api/symptoms/route.ts` (API routes)
- **Override Resolution** — `src/server/effectiveSymptoms.ts`

### Highlighting

- **Highlight Engine** — `src/lib/highlighting.ts`
  - Applies built-in and custom rules
  - HTML generation with CSS classes

- **Highlight Management** — `src/server/highlights.ts`
  - CRUD operations for highlight rules
  - Surgery-specific rule resolution

### AI Features

- **AI Instruction Editor** — `src/server/aiCustomiseInstructions.ts`
- **AI API Routes** — `src/app/api/ai/`
- **Feature Flags** — `src/lib/features.ts`

### Appointments

- **Directory Display** — `src/app/s/[id]/appointments/AppointmentsPageClient.tsx`
- **CSV Import** — `src/components/appointments/AppointmentCsvUpload.tsx`
- **Staff Teams** — `src/lib/staffTypes.ts`

---

## Working Safely

### Database Changes

1. **Always use Prisma migrations**
   - Never edit database directly
   - Create migrations: `npx prisma migrate dev`
   - Test migrations locally first

2. **Idempotent migrations**
   - Migrations should be safe to run multiple times
   - Check if columns/tables exist before creating

3. **Schema changes**
   - Update `schema.prisma`
   - Generate migration
   - Update TypeScript types

### Clinical Review Workflow

When modifying symptoms:
- Always trigger clinical review status check
- Use `updateRequiresClinicalReview` from `src/server/updateRequiresClinicalReview.ts`
- Never bypass review workflow

### RBAC Checks

Always check permissions:
- Use `getSessionUser()` from `src/lib/rbac.ts`
- Verify role before allowing actions
- Server-side validation required (never trust client)

### Feature Flags

Before adding features:
- Check feature flag system in `src/lib/features.ts`
- Add flags at appropriate level (superuser/surgery/user)
- Respect flag hierarchy

### TypeScript

- **Strict mode** — Always enabled
- **No `any` types** — Use proper types
- **Server-only imports** — Mark server files with `'server-only'`
- **Client directives** — Mark client components with `'use client'`

---

## Development Workflow

### Setup

1. Clone repository
2. Install dependencies: `npm install`
3. Set up environment variables (`.env.local`)
4. Run migrations: `npm run db:push`
5. Seed database: `npm run db:seed`
6. Start dev server: `npm run dev`

### Making Changes

1. **Feature Development**
   - Create feature branch
   - Follow existing patterns
   - Add tests where appropriate
   - Update documentation if user-facing

2. **Database Changes**
   - Update schema
   - Create migration
   - Test locally
   - Update seed data if needed

3. **UI Changes**
   - Follow NHS design tokens
   - Ensure accessibility (WCAG 2.1 AA)
   - Test responsive design
   - Verify keyboard navigation

4. **Testing**
   - Run: `npm test`
   - Check linting: Ensure no errors
   - Manual testing in browser
   - Test different user roles

### Code Style

- **British English** spelling (colour, organise, centre)
- **Plain English** comments
- **Accessibility-first** approach
- **Server/client separation** — Clear boundaries
- **Type safety** — No `any` types

---

## Common Patterns

### Server Component Data Fetching

```typescript
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'

export default async function Page() {
  const user = await getSessionUser()
  const data = await prisma.model.findMany({
    where: { surgeryId: user.defaultSurgeryId }
  })
  return <ClientComponent data={data} />
}
```

### Client Component Interaction

```typescript
'use client'

export function ClientComponent({ data }) {
  const handleAction = async () => {
    const result = await serverAction(data)
    // Handle result
  }
  return <button onClick={handleAction}>Action</button>
}
```

### RBAC Protection

```typescript
const user = await getSessionUser()
if (!user || user.globalRole !== 'SUPERUSER') {
  return new Response('Unauthorized', { status: 403 })
}
```

---

## Testing

### Unit Tests

- Located in `src/lib/__tests__/`
- Test utilities and pure functions
- Use Jest

### Integration Tests

- Test API routes
- Test server actions
- Test database interactions

### Manual Testing Checklist

- [ ] Test with different user roles
- [ ] Verify RBAC enforcement
- [ ] Check clinical review workflow
- [ ] Test multi-surgery context
- [ ] Verify accessibility
- [ ] Test responsive design

---

## Deployment

### Vercel

- Works natively with serverless functions
- Prisma migrations run via `postinstall` hook
- Environment variables in Vercel dashboard
- `DATABASE_URL` must be set

### Environment Variables

Required:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — NextAuth secret
- `NEXTAUTH_URL` — Application URL
- `AZURE_OPENAI_ENDPOINT` — AI endpoint (if using)
- `AZURE_OPENAI_API_KEY` — AI key (if using)
- `AZURE_OPENAI_DEPLOYMENT_NAME` — AI deployment (if using)

---

## Troubleshooting

### Common Issues

**NHS Network Blocking**
- May need domain allowlisting
- NCSC filtering can block domains
- Contact IT support

**Login Loop**
- Check `NEXTAUTH_URL` matches deployed domain
- Verify session configuration

**Missing Symptoms**
- Check clinical review status
- Verify user has appropriate permissions
- Check surgery context

**Database Errors**
- Verify `DATABASE_URL` is set
- Check Prisma client generation
- Run migrations: `npm run db:push`

---

## Related Pages

- [Multi-Surgery & RBAC](Multi-Surgery-&-RBAC) — Access control details
- [Clinical Governance](Clinical-Governance) — Review workflow
- [Symptom Library](Symptom-Library) — Symptom system overview

---

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NHS Service Manual](https://service-manual.nhs.uk)

---

_Last updated: December 2025_

