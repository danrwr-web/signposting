# Practice Handbook – Architecture & Behaviour Overview

This document describes the **structure, data model, and intended behaviour** of the
**Practice Handbook** module within the Signposting Toolkit.

It is intended as a reference for:
- future development
- UX decisions
- clinical and operational governance
- AI-assisted changes

---

## 1. Purpose of the Practice Handbook

The Practice Handbook is a **staff-facing internal knowledge base** for GP practices.

It supports:

- Clear operational guidance for admin, reception, and clinical support staff
- Fast access to commonly used internal information
- Lightweight governance (ownership, review dates, restricted editors)
- Structured content without forcing “document-style” pages

The Practice Handbook **does not replace clinical signposting**.  
It intentionally sits alongside it, providing internal context, process guidance, and local rules.

> Note: This module was previously referred to as the “Admin Toolkit”.  
> “Practice Handbook” is now the canonical, user-facing name.

---

## 2. Application context & navigation (foundational)

The Practice Handbook is a **first-class module** within the Signposting Toolkit.

### App shell rules
- All Practice Handbook pages render inside the **shared app shell**
- The standard header (logo, surgery context, menu trigger) is always present
- The **universal slide-out navigation panel** is the primary way users move between modules

There is **no separate admin application** or parallel navigation model.

### Navigation intent
- Global navigation lives in the slide-out panel
- Page-level “Back to …” links are retained only where they add local context
- The Handbook must always feel part of the same application as:
  - Signposting
  - Workflow Guidance
  - future modules (e.g. Daily Dose)

---

## 3. High-level structure

The Practice Handbook consists of:

1. **Front page (staff view)**
2. **Items (content)**
3. **Categories & subcategories**
4. **Quick Access buttons**
5. **Pinned panel**
6. **On-take GP rota**
7. **Handbook settings UI** (admin only)

---

## 4. Practice Handbook Items

### 4.1 Item types

Each Practice Handbook item is one of:

- **PAGE**
  - Rich-text guidance
  - Optional structured blocks (e.g. Role Cards)
  - No internal linking required
- **LIST**
  - Simple list-style content (used sparingly)

### 4.2 Core fields (PAGE items)

- `title`
- `categoryId` (parent or subcategory)
- `contentHtml` (main rich-text editor content)
- `contentJson` (structured blocks; see below)
- `warningBadge` (optional, e.g. “Urgent”)
- `lastReviewed` (optional date)
- `restrictedEditors` (optional list of users)

---

## 5. Structured content blocks (PAGE items)

PAGE items may contain structured blocks stored in:

AdminItem.contentJson.blocks[]


### 5.1 ROLE_CARDS block

**Purpose**  
Display static, non-clickable cards describing **job roles or responsibilities**
(e.g. Reception, Admin Support, Data Processing).

**Key characteristics**
- Informational only (no links)
- Visually consistent with Handbook cards
- Optional section within a PAGE

**Editor behaviour**
- Only available for PAGE items
- Auto-expands when:
  - the PAGE already contains Role Cards
- Remains collapsed for empty or new pages

**Display behaviour (staff view)**
- Cards render **above** the main page content
- Styled consistently with Handbook cards:
  - Blue background
  - White text
  - Consistent spacing, radius, and typography

---

## 6. Categories & subcategories

### 6.1 Structure
- Categories are **hierarchical**:
  - Parent categories
  - Optional subcategories (one level deep)
- Stored via `parentCategoryId` (no extra tables)

### 6.2 Behaviour
- Categories:
  - Are manually sortable
  - May contain items and/or subcategories
- Subcategories:
  - Are sortable within their parent
  - Cannot be deleted if they contain items
- Deleting a category is blocked if:
  - It contains items
  - It contains subcategories

### 6.3 UI
- Front page:
  - Category list is sticky on the left
  - Shows item counts
  - Filters the card grid
- Settings UI:
  - Rename
  - Reorder
  - Add subcategories inline

---

## 7. Front page (staff view)

### 7.1 Card grid
- Displays Handbook items as cards
- Cards:
  - Alphabetically ordered **within their category**
  - Styled consistently (blue cards mode)
- Filtering:
  - By category (left sidebar)
  - By search (sticky search bar)

### 7.2 Scrolling model (intentional)
- **Single, natural page scroll**
- No fixed header/footer regions inside the content
- Sticky elements:
  - Search bar (top)
  - Category list (left)
- Avoids:
  - “Scrollable middle with fixed top/bottom” layouts

---

## 8. Quick Access buttons

### 8.1 Purpose
Provide **one-click access** to high-frequency Handbook items
(e.g. GMC Numbers, Extra Jobs).

These replace older hard-coded shortcuts.

### 8.2 Behaviour
- Displayed at the **top of the Handbook front page**
- Open a specific Handbook item
- Do not replace categories or search

### 8.3 Configuration

Stored in:

Surgery.uiConfig.practiceHandbook.quickAccessButtons


Each button includes:
- `targetItemId` (required)
- `label` (optional; defaults to item title)
- `backgroundColor`
- `textColor`
- `order`

### 8.4 UX rules
- Label is optional:
  - If blank, the item title is used
- Reordering:
  - Immediate effect
  - Order persists after refresh
- Colours:
  - Always respected

---

## 9. Pinned panel

### 9.1 Purpose
Display **always-visible operational information** at the bottom of the Handbook front page, such as:
- Task buddy systems
- Post routes or trays
- Static practice-specific notes

### 9.2 Behaviour
- Visually distinct panel
- Appears **at the bottom of the page**
- “Pinned” in the sense of *always present*, not fixed-position
- Edited via Handbook settings

---

## 10. On-take GP rota

### 10.1 Purpose
Provide a simple, human-readable rota for:
- “On-take GP this week”
- Upcoming weeks (read-only preview)

### 10.2 Behaviour
- One GP per week (Monday–Sunday)
- Admin-editable
- Displayed in:
  - Handbook settings
  - Handbook front page (summary)

---

## 11. Handbook settings UI

### 11.1 Tabs
- **Items**
  - Create/edit Handbook items
  - Blank editor by default
  - Explicit selection required to edit existing content
- **Structure & Settings**
  - Categories
  - Quick Access buttons
  - Pinned panel
  - On-take rota

### 11.2 UX principles
- No “last edited item” auto-selection
- Blank editor = “ready to create”
- Changes should:
  - Be explicit
  - Avoid surprising persistence
- Admin actions must never silently overwrite content

---

## 12. Design principles (intentional)

- Calm, NHS-appropriate UI
- Minimal cognitive load for admin staff
- Prefer:
  - Cards over documents
  - Visible structure over hidden navigation
- Avoid:
  - Deep linking between Handbook items
  - Overly clever interactions
  - Dense configuration screens

---

## 13. Non-goals (explicit)

The Practice Handbook is **not**:
- A document management system
- A wiki with cross-linking
- A task management tool
- A replacement for clinical guidance systems

---

## 14. Future-safe considerations (optional)

Potential future extensions (not yet implemented):

- Role Cards as a reusable block type beyond the Handbook
- Per-role visibility rules
- Read receipts or acknowledgement tracking
- Soft versioning / change history
- Drag-and-drop card and category organisation

---

**Last updated:** January 2026  
**Primary design intent:** fast, reliable, low-friction internal guidance for GP practices