# NHS Signposting Web App

A responsive NHS-style signposting web application built with Next.js 15, TypeScript, and Tailwind CSS. The app provides role-based access control (RBAC) for healthcare admin teams to manage symptom signposting across multiple surgeries.

## Features

- **Role-Based Access Control (RBAC)**: Three-tier permission system (Superuser, Admin, Standard)
- **Multi-tenant Architecture**: Each surgery can have customized symptom information
- **Base Data + Overrides**: Base symptoms with per-surgery overrides
- **Excel Import**: Upload Excel files to seed/refresh base symptom data
- **Rich Text Editor**: TipTap-powered editor for formatting instructions with colors and highlighting
- **Image Icons**: Upload images that appear on symptom cards when specific phrases are detected
- **Advanced Highlighting**: Custom highlight rules with phrase matching and color customization
- **Search & Filtering**: Search symptoms and filter by age group
- **Engagement Tracking**: Track symptom views and user suggestions
- **Admin Dashboards**: Global and per-surgery administration
- **High-Risk Quick Access**: Dedicated buttons for urgent conditions (Anaphylaxis, Stroke, Chest Pain, Sepsis, Meningitis)
- **Performance Optimized**: API caching, batched requests, and optimized database queries
- **NHS Styling**: Clean, accessible design following NHS guidelines
- **Authentication**: NextAuth.js with credentials provider

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Prisma + SQLite (dev) / PostgreSQL/Neon (prod)
- **Authentication**: NextAuth.js with credentials provider
- **Rich Text Editing**: TipTap with ProseMirror
- **Excel Parsing**: SheetJS (xlsx)
- **Image Optimization**: Next.js Image component
- **UI Components**: Custom components with NHS styling
- **Testing**: Jest + React Testing Library
- **Performance**: API response caching, batched requests, optimized queries

## Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nhs-signposting
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
```

Edit `.env.local` with your configuration:
```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth Configuration
NEXTAUTH_SECRET="your-secret-here-change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"

# App Configuration
NEXT_PUBLIC_APP_VERSION="Beta v1.0"

# Feature Flags
DONATIONS_ENABLED="false"
```

4. Set up the database:
```bash
# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Seed with sample data
npm run db:seed
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Authentication

The application uses NextAuth.js with a credentials provider for authentication. All authentication is session-based using JWT tokens stored securely in HTTP-only cookies.

### Login Process

1. Users authenticate via `/login` with email and password
2. Passwords are stored as bcrypt hashes in the database
3. Successful authentication creates a NextAuth session with user role information
4. Sessions are protected by middleware that enforces role-based access control

### Security Features

- **Password Hashing**: All passwords are hashed using bcrypt with salt rounds of 12
- **Session Management**: JWT-based sessions with secure HTTP-only cookies
- **Server-Side Validation**: All admin routes and API endpoints verify authentication server-side
- **No Hardcoded Credentials**: All authentication uses database-stored credentials
- **Role-Based Access**: Permissions checked on every request using RBAC helpers

## Role-Based Access Control (RBAC)

The application implements a three-tier permission system with server-side enforcement:

### User Roles

1. **Superuser (Global)**
   - Can manage all surgeries and users
   - Can create other superusers, admins, and standard users
   - Access to global admin dashboard (`/admin`) and superuser dashboard (`/super`)
   - Can switch between any surgery
   - Access to all admin API routes requiring superuser privileges

2. **Admin (Per-Surgery)**
   - Can manage users within their assigned surgery
   - Can invite/add/remove users to their surgery
   - Can set per-surgery roles (ADMIN or STANDARD)
   - Can set/remove user's default surgery
   - Access to surgery admin dashboard (`/s/[surgeryId]/admin`)
   - Access to surgery-specific admin API routes

3. **Standard (Per-Surgery)**
   - Can use the toolkit within their assigned surgery
   - Cannot see admin links or access admin routes
   - Access to surgery dashboard (`/s/[surgeryId]`)

### RBAC Implementation

All admin pages and API routes use server-side RBAC helpers located in `src/lib/rbac.ts`:

- `requireAuth()` - Ensures user is authenticated
- `requireSuperuser()` - Requires SUPERUSER global role
- `requireSurgeryAdmin(surgeryId)` - Requires ADMIN role for specific surgery (or SUPERUSER)
- `requireSurgeryAccess(surgeryId)` - Requires any membership in surgery (or SUPERUSER)

### Protected Routes

- `/admin/*` - Requires SUPERUSER or ADMIN role (enforced by middleware and page-level checks)
- `/s/[surgeryId]/admin/*` - Requires ADMIN role for specific surgery (enforced by page-level checks)
- `/s/[surgeryId]/clinical-review` - Requires ADMIN role for specific surgery (enforced by page-level checks)
- `/super/*` - Requires SUPERUSER role (enforced by page-level checks)
- `/api/admin/*` - All endpoints verify authentication and appropriate roles server-side

### Clinical Sign-off Workflow

Each surgery must review and approve its own symptom guidance to ensure clinical governance and medico-legal clarity. The clinical review workflow ensures that each practice is responsible for the advice their reception and care navigation team sees.

#### Workflow Overview

1. **Initial State**: When a surgery is first created or after a re-review is requested, all symptoms start with a "PENDING" review status, and the surgery's `requiresClinicalReview` flag is set to `true`.

2. **Warning Banner**: While `requiresClinicalReview` is `true`, all users at that surgery see a visible warning banner on the main surgery page and dashboard stating:
   > "Content for [Surgery Name] is awaiting local clinical review. If you're unsure, please check with a clinician before booking."

3. **Review Process**: 
   - Admins (or superusers) access the clinical review dashboard at `/s/[surgeryId]/clinical-review`
   - For each symptom, they can mark it as:
     - **APPROVED**: Content is clinically appropriate for this surgery
     - **CHANGES_REQUIRED**: Content needs modification (with a link to edit the override)
   - The system tracks who reviewed each symptom and when

4. **Sign-off**: Once all symptoms are reviewed (none remain PENDING), the admin can click "Complete Review and Sign Off", which:
   - Sets `requiresClinicalReview = false`
   - Records the reviewer's identity and timestamp
   - Removes the warning banner for all users at that surgery

5. **Re-review**: At any time, admins can request a re-review, which:
   - Resets all symptoms back to PENDING status
   - Sets `requiresClinicalReview = true` again
   - Triggers the warning banner to reappear
   - Supports annual review cycles and clinical lead turnover

The system records who signed off and when, providing an audit trail for governance and CQC-style assurance.

#### How to Use (Admins and Superusers)

1. Open the Admin dashboard and choose your surgery.
2. Click Clinical Review to view all effective symptoms for that surgery.
3. For each symptom, mark Approved or Needs Change.
4. When everything is reviewed (no items left pending), click Complete Review and Sign Off.
5. To start a new annual review, click Request Re‑review (this resets all statuses to Pending and shows the banner to staff again).

Staff using the signposting tool will see a banner while content is awaiting local clinical review.

### Surgery Persistence Precedence

The application follows this precedence for determining which surgery context to use:

1. **URL Parameter** (`/s/[surgeryId]`) - Highest priority
2. **Cookie** - Stored surgery preference
3. **localStorage** - Browser-stored preference
4. **User's Default Surgery** - Fallback to user's assigned default surgery

### Authentication Flow

1. **Unauthenticated users** → Redirected to `/login`
2. **Superusers** → Redirected to `/admin` (global dashboard)
3. **Non-superusers** → Redirected to `/s/[surgeryId]` where `surgeryId` is their `defaultSurgeryId`

### Test Accounts

The seed script creates these test accounts (password = email address):

- `superuser@example.com` - Superuser
- `admin@idelane.com` - Admin of Ide Lane Surgery
- `user@idelane.com` - Standard user of Ide Lane Surgery

**Note**: Passwords must be set via the admin interface or database seeding. Default passwords should be changed in production.

## Database Schema

### Core Models

#### RBAC Models
- **User**: User accounts with global roles and surgery memberships
- **Surgery**: Individual surgeries/practices with optional slugs for backward compatibility
- **UserSurgery**: Junction table linking users to surgeries with per-surgery roles

#### Content Models
- **BaseSymptom**: Base symptom data (shared across all surgeries)
- **SurgerySymptomOverride**: Per-surgery customizations of base symptoms
- **SurgeryCustomSymptom**: Surgery-specific custom symptoms
- **Suggestion**: User feedback and suggestions
- **EngagementEvent**: Tracks user interactions
- **ImageIcon**: Images that display on symptom cards when phrases are matched
- **HighlightRule**: Custom highlighting rules for text matching

### Data Resolution

The app uses a sophisticated data resolution system:

1. **Base Data**: All symptoms start with base data from Excel imports
2. **Overrides**: Surgeries can override specific fields for their context
3. **Inheritance**: Empty override fields inherit from base data
4. **Effective Data**: Final data shown to users is the merged result

## Usage

### For End Users

1. **Select Surgery**: Use the dropdown in the header to choose your surgery
2. **Browse Symptoms**: View symptoms in a responsive grid layout with image icons when applicable
3. **Search & Filter**: Use the search box and age filters to find relevant information
4. **High-Risk Quick Access**: Use red buttons for urgent conditions (Anaphylaxis, Stroke, Chest Pain, Sepsis, Meningitis)
5. **View Details**: Click on symptoms to see detailed instructions with enhanced highlighting and images
6. **Suggest Improvements**: Use the suggestion button to provide feedback
7. **Image Icons**: Icons automatically appear on symptom cards and instruction pages when configured phrases are detected

### For Administrators

### Access
- **URL**: `/admin` (for superusers) or `/s/[surgeryId]/admin` (for surgery admins)
- **Authentication**: Login via `/login` with email and password

### Features

#### Data Management Tab
- **Upload Excel**: Import base symptom data from Excel files
- **Add Symptom**: Manually add new symptoms with full form
- **Remove Symptom**: Delete symptoms with confirmation dialog
- **Symptom List**: View all base symptoms in the system

#### Overrides Tab
- **Select Surgery**: Choose which surgery to customize
- **Select Symptom**: Pick symptom to override
- **Field Overrides**: Modify individual fields (symptom, age group, instructions, etc.)
- **Inheritance**: Empty fields inherit from base values
- **Save/Cancel**: Apply changes or revert

#### Highlight Config Tab
- **Custom Rules**: Create highlight rules with trigger phrases
- **Color Picker**: Set text and background colors
- **Surgery-Specific**: Rules can be global or surgery-specific
- **Active/Inactive**: Toggle rules on/off
- **Built-in Info**: View default slot highlighting
- **Image Icons Management**: 
  - **Superusers**: Upload images that appear on symptom cards when phrases are detected
  - **Admins**: Toggle image icons on/off for their surgery
  - **Size Control**: Set individual sizes for symptom cards and instruction pages (Small/Medium/Large)
  - **Phrase Matching**: Icons appear when their phrase appears in brief instructions

#### Engagement Tab
- **Analytics**: Monitor symptom views and user engagement
- **Top Symptoms**: Most viewed symptoms per surgery
- **User Activity**: Track user interactions

#### Suggestions Tab
- **User Feedback**: Review suggestions from users
- **Filter by Surgery**: View suggestions for specific surgeries
- **Export**: Download suggestions as CSV

## Excel File Format

Expected columns in Excel files:

| Column | Required | Description |
|--------|----------|-------------|
| Symptom | Yes | Name of the symptom |
| AgeGroup | Yes | "U5", "O5", or "Adult" |
| BriefInstruction | Yes | Short summary |
| Instructions | Yes | Detailed instructions |
| HighlightedText | No | Important notice (rendered in red) |
| LinkToPage | No | Link to related page |
| CustomID | No | Unique identifier for upserts |

### Sample Excel File

A sample Excel file (`test-symptoms.xlsx`) has been created for testing. You can:

1. Log in to the admin panel at `/admin` with an admin account
2. Go to the "Data Management" tab
3. Upload the `test-symptoms.xlsx` file
4. The system will process and import the symptoms

### Troubleshooting Excel Upload

If you get "Failed to load Excel file" error:

1. **Check file format**: Ensure the file is `.xlsx` or `.xls`
2. **Check column headers**: Must include `Symptom`, `AgeGroup`, `BriefInstruction`, `Instructions`
3. **Check data**: Each row must have values for required columns
4. **Check file size**: Large files may take time to process
5. **Check browser console**: Look for detailed error messages

### Creating Your Own Excel File

1. Open Excel or Google Sheets
2. Create columns: Symptom, AgeGroup, BriefInstruction, Instructions, HighlightedText (optional), LinkToPage (optional), CustomID (optional)
3. Add your symptom data
4. Save as `.xlsx` format
5. Upload through the admin panel

### Enhanced Highlighting System

The application automatically highlights appointment slot types and supports custom highlighting rules:

#### Built-in Slot Types
- **Green Slot**: Highlighted with green background and white text
- **Orange Slot**: Highlighted with orange background and white text  
- **Red Slot**: Highlighted with red background and white text
- **Pink/Purple**: Highlighted with purple background and white text

#### Custom Highlight Rules
- **Trigger Phrase**: Word or phrase to highlight (case-insensitive)
- **Text Color**: Custom text color (hex)
- **Background Color**: Custom background color (hex)
- **Surgery-Specific**: Rules can be global or surgery-specific

#### Where Highlighting Appears
- Symptom cards on the main page
- Detailed instruction pages
- Admin panel symptom lists
- Override management interface

#### Managing Custom Highlights
1. Go to Admin Panel → Highlight Config tab
2. Click "Add Rule" to create new highlight rules
3. Configure trigger phrase and colors
4. Rules are applied immediately across the application

Example: "Book a green slot appointment" will display with "green slot" highlighted in green.

### Image Icons Feature

Superusers can upload images that automatically appear on symptom cards and instruction pages when specific phrases are detected in brief instructions.

#### Features
- **Phrase Matching**: Images appear when their configured phrase appears in brief instructions (case-insensitive)
- **Separate Sizes**: Configure different sizes for symptom cards (small/medium/large) and instruction pages (small/medium/large)
- **Surgery Control**: Admins can enable/disable image icons for their surgery
- **Per-Icon Toggle**: Superusers can enable/disable individual icons
- **Accessibility**: Alt text support for screen readers

#### Usage
1. Go to Admin Panel → Highlights tab
2. Scroll to "Image Icons" section (superuser only)
3. Click "Add Icon" to upload a new image
4. Enter the matching phrase and configure sizes
5. Icons will automatically appear on relevant symptom cards and instruction pages
6. Admins can toggle icons on/off for their surgery without uploading new ones

## API Endpoints

### Public APIs
- `GET /api/symptoms` - Get effective symptoms for current surgery
- `GET /api/symptoms/[id]` - Get specific symptom details
- `POST /api/suggestions` - Submit user suggestions
- `GET /api/highlights` - Get highlight rules for current surgery
- `GET /api/highrisk` - Get high-risk quick access buttons
- `GET /api/symptom-card-data` - Combined endpoint for symptom card data (highlights + icons)
- `GET /api/image-icons` - Get image icon by phrase (client-side) or all icons (superuser)

### Admin APIs
- `POST /api/admin/upload-excel` - Upload Excel file
- `GET/POST/DELETE /api/admin/overrides` - Manage symptom overrides
- `GET /api/engagement/top` - Get engagement analytics
- `POST /api/image-icons` - Upload new image icon (superuser only)
- `PATCH /api/image-icons/[id]` - Update image icon (enable/disable, sizes) (superuser only)
- `DELETE /api/image-icons/[id]` - Delete image icon (superuser only)
- `POST /api/admin/surgery-settings` - Update surgery settings (enableImageIcons, etc.)

## Deployment

### Environment Variables

For production deployment, set these environment variables:

```env
# Database (use PostgreSQL for production)
# Production uses Neon Postgres via Vercel environment variables
DATABASE_URL="postgresql://user:password@localhost:5432/nhs_signposting"

# NextAuth Configuration (required)
NEXTAUTH_SECRET="your-secret-key-change-this-in-production"
NEXTAUTH_URL="https://your-domain.com"

# App Configuration
NEXT_PUBLIC_APP_VERSION="Beta v1.0"

# Feature Flags
DONATIONS_ENABLED="false"
```

### Build and Deploy

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

### Database Migration

For production databases, use Prisma migrations:

```bash
# Create migration
npx prisma migrate dev --name init

# Deploy to production
npx prisma migrate deploy
```

**Note**: The `postinstall` script automatically runs `prisma migrate deploy` during Vercel deployments. Ensure your `DATABASE_URL` environment variable is set correctly.

## Customization

### Adding New Surgeries

1. Use the admin interface to create new surgeries
2. Or add directly to the database:
```sql
INSERT INTO Surgery (name, slug) VALUES ('New Surgery', 'new-surgery');
```

### Styling

The app uses NHS color palette and Inter font. Customize in:
- `tailwind.config.ts` - Color definitions
- `src/app/globals.css` - Global styles
- Component files - Individual component styles

### Adding New Features

1. **New Routes**: Add pages in `src/app/`
2. **New APIs**: Add endpoints in `src/app/api/`
3. **New Components**: Add reusable components in `src/components/`
4. **Database Changes**: Update `prisma/schema.prisma` and run migrations

## Performance Optimizations

The application includes several performance optimizations:

- **API Response Caching**: Public APIs cache responses for 60 seconds with stale-while-revalidate
- **Batched Requests**: Symptom card data is fetched in a single combined endpoint
- **Optimized Queries**: Database queries use selective field selection to reduce payload size
- **No Polling**: Removed automatic refresh intervals to reduce server load
- **Image Optimization**: Next.js Image component handles responsive images and lazy loading
- **Database Indexing**: Strategic indexes on frequently queried fields

### Cache Strategy

Most API endpoints use the following caching strategy:
- **Cache Duration**: 60 seconds (`s-maxage=60`)
- **Stale While Revalidate**: 120 seconds
- **Public Caching**: Responses are cacheable by CDN and browsers

Admin endpoints use `no-store` to ensure fresh data for administrative actions.

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure DATABASE_URL is correct
2. **Excel Upload**: Check file format and column names
3. **Authentication**: Verify NEXTAUTH_SECRET and NEXTAUTH_URL are set correctly
4. **Build Errors**: Run `npm run db:generate` after schema changes
5. **Image Icons Not Appearing**: 
   - Check that the phrase matches text in brief instructions (case-insensitive)
   - Verify that image icons are enabled for the surgery
   - Check that the icon is enabled in the admin panel
6. **Slow Performance**: 
   - Clear browser cache if experiencing stale data
   - Check network tab for API response times
   - Verify database indexes are properly created

### Development Commands

```bash
# Database operations
npm run db:push          # Push schema changes
npm run db:migrate       # Create migration
npm run db:generate      # Generate Prisma client
npm run db:seed          # Seed database

# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

## Security & Access Control (Oct 2025 Update)

**All admin routes and APIs now require authenticated NextAuth sessions with role-based checks.**

### Authentication
- All authentication uses NextAuth.js with credentials provider
- Passwords are stored as bcrypt hashes in the database
- No hardcoded passwords or environment variable fallbacks
- Sessions use JWT tokens stored in secure HTTP-only cookies

### Authorization
- **SUPERUSER**: Global role for managing all surgeries and users
- **ADMIN**: Per-surgery role for managing users within assigned surgery
- **STANDARD**: Per-surgery role for accessing signposting features

### Server-Side Enforcement
- All admin pages (`/admin`, `/s/[surgeryId]/admin`, `/super`) verify authentication and roles server-side
- All admin API routes (`/api/admin/*`) verify authentication and appropriate permissions server-side
- RBAC helpers in `src/lib/rbac.ts` provide consistent permission checking across the application
- Middleware protects routes at the edge, but pages and APIs perform additional server-side verification

### Production Environment
- Production uses Vercel + Neon Postgres
- `DATABASE_URL` environment variable points to Neon database
- No SQLite dependencies in production
- All migrations run automatically via `postinstall` script on Vercel deployments

### Production Readiness Notes

- All admin pages and admin APIs enforce authentication and role checks server-side.
- Development-only migration/diagnostic routes are blocked in production.
- No shared admin passcodes are used.
- No hardcoded superuser credentials are used in authentication.
- Production runs on Vercel with Neon Postgres via DATABASE_URL.
- Each surgery is responsible for clinically approving its own guidance. The system records reviewer identity and timestamp, and shows a banner until sign-off is complete. This supports governance and medico-legal accountability.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Check the troubleshooting section
- Review the API documentation
- Open an issue in the repository
