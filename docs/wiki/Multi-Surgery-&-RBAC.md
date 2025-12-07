# Multi-Surgery & RBAC

## Navigation

- [Home](Home)

- [Symptom Library](Symptom-Library)

- [Clinical Governance](Clinical-Governance)

- [AI Features](AI-Features)

- [Appointment Directory](Appointment-Directory)

- [High-Risk & Highlighting](High-Risk-&-Highlighting)

- [Multi-Surgery & RBAC](Multi-Surgery-&-RBAC)

- [Developer Guide](Developer-Guide)

The Signposting Toolkit supports full multi-tenancy, allowing multiple GP surgeries to operate independently on the same platform. Each surgery has complete data isolation, custom configuration, and role-based access control.

---

## Multi-Surgery Architecture

### Data Isolation

Each surgery operates as a completely independent tenant:

- **Separate symptom libraries** — Overrides and custom symptoms
- **Independent appointment directories** — Unique to each surgery
- **Isolated user bases** — No cross-surgery visibility
- **Separate configurations** — Preferences, highlights, high-risk buttons
- **Independent clinical review** — Each surgery manages its own approvals

### Per-Surgery Configuration

Every surgery can customise:

- Symptom library overrides and custom symptoms
- Appointment types and staff teams
- Highlight rules and colour schemes
- High-risk button configuration
- User roles and permissions
- Clinical review settings
- Feature flag preferences

### Surgery Switching

Superusers can switch between surgeries to manage multiple practices. Each surgery maintains its own context and configuration.

---

## Role-Based Access Control (RBAC)

The system uses a three-level access hierarchy to control what users can do.

### User Roles

#### 1. Superuser (Global)

Superusers have system-wide access and can:

- Access all surgeries
- Switch between surgeries
- Manage base symptom library
- Configure system-wide settings
- Create and manage surgeries
- Override any restrictions
- Approve any symptom
- Manage feature flags globally

**Use Case:** Platform administrators, central maintainers

#### 2. Surgery Admin

Surgery Admins manage their practice and can:

- Create and edit symptoms
- Configure appointment directory
- Manage highlight rules
- Configure high-risk buttons
- Approve clinical reviews
- Manage surgery users
- Enable/disable features (if allowed)
- View engagement analytics

**Use Case:** Practice managers, lead clinicians, practice admins

#### 3. Standard User

Standard Users have basic access and can:

- View approved symptoms
- Search symptom library
- Use appointment directory
- Submit suggestions
- View their own preferences
- See pending review warnings
- Cannot approve or edit content

**Use Case:** Reception staff, care navigators, standard users

---

## Permission Model

### Hierarchical Permissions

Permissions cascade hierarchically:

- **Superuser** — All permissions
- **Surgery Admin** — Surgery-level permissions
- **Standard User** — Read-only permissions

### Access Rules

#### Symptom Management
- **Superuser** — Can edit any symptom in any surgery
- **Surgery Admin** — Can edit symptoms in their surgery
- **Standard User** — Can only view approved symptoms

#### Clinical Review
- **Superuser** — Can approve any symptom
- **Surgery Admin** — Can approve symptoms in their surgery
- **Standard User** — Cannot approve

#### Configuration
- **Superuser** — Can configure any surgery
- **Surgery Admin** — Can configure their surgery
- **Standard User** — Personal preferences only

---

## User Management

### User Creation

Users can be created at different levels:

- **Superuser** — Created at platform level
- **Surgery Users** — Created by surgery admins or superusers
- **Self-Registration** — If enabled (future feature)

### User Memberships

A single user can belong to multiple surgeries with different roles:

#### Multi-Surgery Membership

Example:
- User: Jane Smith
- Surgery A: Admin role
- Surgery B: Standard role

This allows users to work across multiple practices while maintaining appropriate permissions for each.

### Default Surgery

Each user has a default surgery that determines:
- Which surgery they see on login
- Default context for operations
- Primary affiliation

---

## Feature Flags

Features can be controlled at multiple levels:

### Flag Hierarchy

1. **Superuser Level** — Global feature control
2. **Surgery Level** — Per-practice enablement
3. **User Level** — Individual overrides (if surgery enabled)

### Current Features

- `ai_instructions` — AI Instruction Editor
- `ai_questions` — AI Suggested Questions  
- `smart_symptom_updates` — Smart update notifications

### Flag Logic

A feature is enabled for a user only if:
1. Feature exists in system
2. Surgery-level flag is enabled (or user is superuser)
3. User-level flag is enabled (or not set, defaults to surgery value)

---

## Data Security

### Isolation Guarantees

- No cross-surgery data access (except superusers)
- Complete separation of user bases
- Independent symptom libraries
- Isolated appointment directories
- Separate clinical review queues

### Authentication

- NextAuth (Credentials Provider)
- Secure JWT sessions
- Server-side validation
- Protected routes enforced

### Audit Trail

All actions are logged with:
- User identity
- Surgery context
- Timestamp
- Action type
- Details of changes

---

## Best Practices

### For Superusers

- Use surgery switching carefully
- Document system-wide changes
- Maintain base library updates
- Coordinate with surgery admins
- Respect data isolation

### For Surgery Admins

- Manage users appropriately
- Assign roles based on responsibilities
- Review permissions regularly
- Train standard users
- Monitor engagement analytics

### For Standard Users

- Understand your permissions
- Submit suggestions for improvements
- Report issues promptly
- Follow clinical review warnings
- Use preferences to customise view

---

## Use Cases

### Single Surgery

A practice operates independently:
- All users belong to one surgery
- Admin manages all configuration
- Standard users have read access
- Complete data isolation

### Multi-Surgery Organisation

A superuser manages multiple practices:
- Switch between surgeries
- Different configurations per surgery
- Independent user bases
- Central base library maintenance

### Shared User

A user works at multiple practices:
- Different roles per surgery
- Context switches automatically
- Appropriate permissions each place
- Unified user experience

---

## Related Pages

- [Clinical Governance](Clinical-Governance) — How roles affect review workflow
- [Developer Guide](Developer-Guide) — Technical RBAC implementation
- [Symptom Library](Symptom-Library) — How permissions affect symptom access

---

## Screenshots

_Screenshots will be added here. To reference an image, use:_

`![Description](images/example.png)`

---

_Last updated: December 2025_

