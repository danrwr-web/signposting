# NHS Signposting Web App

A responsive NHS-style signposting web application built with Next.js 15, TypeScript, and Tailwind CSS. The app provides role-based access control (RBAC) for healthcare admin teams to manage symptom signposting across multiple surgeries.

## Features

- **Role-Based Access Control (RBAC)**: Three-tier permission system (Superuser, Admin, Standard)
- **Multi-tenant Architecture**: Each surgery can have customized symptom information
- **Base Data + Overrides**: Base symptoms with per-surgery overrides
- **Excel Import**: Upload Excel files to seed/refresh base symptom data
- **Search & Filtering**: Search symptoms and filter by age group
- **Engagement Tracking**: Track symptom views and user suggestions
- **Admin Dashboards**: Global and per-surgery administration
- **NHS Styling**: Clean, accessible design following NHS guidelines
- **Authentication**: NextAuth.js with credentials provider

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Prisma + SQLite (dev) / PostgreSQL (prod)
- **Authentication**: NextAuth.js with credentials provider
- **Excel Parsing**: SheetJS (xlsx)
- **UI Components**: Custom components with NHS styling
- **Testing**: Jest + React Testing Library

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

## Role-Based Access Control (RBAC)

The application implements a three-tier permission system:

### User Roles

1. **Superuser (Global)**
   - Can manage all surgeries and users
   - Can create other superusers, admins, and standard users
   - Access to global admin dashboard (`/admin`)
   - Can switch between any surgery

2. **Admin (Per-Surgery)**
   - Can manage users within their assigned surgery
   - Can invite/add/remove users to their surgery
   - Can set per-surgery roles (ADMIN or STANDARD)
   - Can set/remove user's default surgery
   - Access to surgery admin dashboard (`/s/[surgeryId]/admin`)

3. **Standard (Per-Surgery)**
   - Can use the toolkit within their assigned surgery
   - Cannot see admin links or access admin routes
   - Access to surgery dashboard (`/s/[surgeryId]/dashboard`)

### Surgery Persistence Precedence

The application follows this precedence for determining which surgery context to use:

1. **URL Parameter** (`/s/[surgeryId]`) - Highest priority
2. **Cookie** - Stored surgery preference
3. **localStorage** - Browser-stored preference
4. **User's Default Surgery** - Fallback to user's assigned default surgery

### Authentication Flow

1. **Unauthenticated users** → Redirected to `/login`
2. **Superusers** → Redirected to `/admin` (global dashboard)
3. **Non-superusers** → Redirected to `/s/[surgeryId]/dashboard` where `surgeryId` is their `defaultSurgeryId`

### Test Accounts

The seed script creates these test accounts (password = email address):

- `superuser@example.com` - Superuser
- `admin@idelane.com` - Admin of Ide Lane Surgery
- `user@idelane.com` - Standard user of Ide Lane Surgery

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

### Data Resolution

The app uses a sophisticated data resolution system:

1. **Base Data**: All symptoms start with base data from Excel imports
2. **Overrides**: Surgeries can override specific fields for their context
3. **Inheritance**: Empty override fields inherit from base data
4. **Effective Data**: Final data shown to users is the merged result

## Usage

### For End Users

1. **Select Surgery**: Use the dropdown in the header to choose your surgery
2. **Browse Symptoms**: View symptoms in a responsive grid layout
3. **Search & Filter**: Use the search box and age filters to find relevant information
4. **High-Risk Quick Access**: Use red buttons for urgent conditions (Anaphylaxis, Stroke, Chest Pain, Sepsis, Meningitis)
5. **View Details**: Click on symptoms to see detailed instructions with enhanced highlighting
6. **Suggest Improvements**: Use the suggestion button to provide feedback

### For Administrators

### Access
- **URL**: `/admin`
- **Passcode**: `admin123` (configurable via environment variables)

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

1. Open the admin panel at `/admin` (passcode: `admin123`)
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

## API Endpoints

### Public APIs
- `GET /api/symptoms` - Get effective symptoms for current surgery
- `GET /api/symptoms/[id]` - Get specific symptom details
- `POST /api/suggestions` - Submit user suggestions

### Admin APIs
- `POST /api/admin/upload-excel` - Upload Excel file
- `GET/POST/DELETE /api/admin/overrides` - Manage symptom overrides
- `GET /api/engagement/top` - Get engagement analytics

## Deployment

### Environment Variables

For production deployment, set these environment variables:

```env
# Database (use PostgreSQL for production)
DATABASE_URL="postgresql://user:password@localhost:5432/nhs_signposting"

# Default surgery
DEFAULT_SURGERY_SLUG="your-default-surgery"

# Admin authentication
ADMIN_PASSCODE="your-secure-passcode"

# NextAuth (if implementing proper auth)
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="https://your-domain.com"
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

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure DATABASE_URL is correct
2. **Excel Upload**: Check file format and column names
3. **Authentication**: Verify ADMIN_PASSCODE in environment
4. **Build Errors**: Run `npm run db:generate` after schema changes

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
