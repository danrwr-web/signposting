# Admin Guide

[Home](Home)

[Getting Started](Getting-Started)

[User Guide](User-Guide)

[Symptom Library](Symptom-Library)

[Clinical Governance](Clinical-Governance)

[AI Features](AI-Features)

[Appointment Directory](Appointment-Directory)

[High-Risk & Highlighting](High-Risk-&-Highlighting)

[Multi-Surgery & RBAC](Multi-Surgery-&-RBAC)

[Developer Guide](Developer-Guide)

---

## Managing Workflow Guidance

Administrators can enable Workflow Guidance per surgery using feature flags.

Admin users can:
	•	Create workflows
	•	Edit workflows
	•	Customise Global Default workflows
	•	Approve workflows for staff use

Only approved workflows are visible to non-admin staff.

---

## Quick Access (staff home screen)

The **Quick Access** tab in the Admin Dashboard controls the optional quick access buttons shown on the staff home screen.

- You can choose up to **6** symptoms to show as quick access buttons.
- You can optionally set a short custom label for each button (leave blank to use the full symptom name).

---

## Admin Toolkit

The **Admin Toolkit** is an optional module for storing surgery-specific guidance pages for admin and reception workflows (for example: “how we process documents”, “post route”, or “task buddy system”).

The Admin Toolkit admin page is split into **Items** (day-to-day content editing) and **Structure & Settings** (categories, pinned panel, and rota) tabs for clarity.

### Enabling the module

- The module is controlled by the `admin_toolkit` feature flag (superuser-controlled).
- When enabled, a new **Admin Toolkit** link appears in the top navigation.

### Global defaults starter kit (templates)

We keep a special surgery record, `global-default-buttons`, as the template source for Admin Toolkit starter content.

- A seeding script can populate it with a lightweight starter kit (categories + example pages).
- Surgeries can then be populated by copying from this global defaults surgery (without copying rota or pinned panel text).

### Write access (who can edit)

- Any signed-in member of the surgery can **view** Admin Toolkit pages.
- Editing requires **Admin Toolkit write access** (separate from full Surgery Admin).
- Surgery Admins and Superusers can always edit.

### Restricted pages (approved editors only)

Admins can optionally restrict an individual page so only approved editors (and superusers) can change it.

### Pinned panel and rota

Admin Toolkit pages show an always-visible pinned panel at the bottom, including:

- **GP taking on** (from a simple rota)
- **Task buddy system** (editable text)
- **Post route** (editable text)

