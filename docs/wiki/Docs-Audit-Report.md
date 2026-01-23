# Documentation Audit Report

*Internal maintainer artefact — generated January 2026*

---

## Summary

This report documents a comprehensive audit of the Signposting Toolkit documentation to verify accuracy, completeness, and link integrity.

**Scope:**
- All markdown files under `/docs` and `/docs/wiki`
- Internal links, anchors, and image references
- Navigation block consistency
- Terminology and version alignment
- Content coverage for all audience groups

---

## Inventory

### Page counts

| Location | Count | Notes |
|----------|-------|-------|
| `/docs/*.md` | 6 | Main docs pages |
| `/docs/wiki/*.md` | 13 | Wiki pages |
| `/docs/archive/*.md` | 4 | Archived (intentionally orphaned) |
| **Total** | 23 | |

### Pages by category

**Main docs:**
- README.md (entry page)
- RELEASE_NOTES.md
- PROJECT_SUMMARY.md
- PRODUCT_OVERVIEW.md
- ROADMAP.md
- Admin Toolkit – Architecture & Behaviour Overview.md (internal architecture doc)

**Wiki pages:**
- Home.md, Getting-Started.md, User-Guide.md
- Symptom-Library.md, Clinical-Governance.md, AI-Features.md
- Appointment-Directory.md, Workflow-Guidance.md
- High-Risk-&-Highlighting.md, Multi-Surgery-&-RBAC.md
- Admin-Guide.md, Developer-Guide.md, Docs-Maintenance.md

**Archived:**
- USER_GUIDE.md, RTE_MIGRATION.md, MIGRATION_INSTRUCTIONS.md, FRONT_PAGE_COPY.md

---

## Findings

### Links and anchors

| Issue type | Count | Status |
|------------|-------|--------|
| Broken internal links | 0 | ✅ |
| Broken anchors | 0 | ✅ |
| Missing images | 0 | ✅ |
| Orphan pages | 1 | ⚠️ See below |

**Orphan pages:**
- `Admin Toolkit – Architecture & Behaviour Overview.md` — internal architecture document, not linked from main navigation. This is intentional (developer reference).

### Image verification

All referenced images exist in `/docs/wiki/images/`:
- ✅ main_page.png
- ✅ symptom_library.png
- ✅ symptom_instructions.png
- ✅ appointment_directory.png
- ✅ signposting_logo_head.png
- ✅ clinical_review.png (exists but not referenced)

### Navigation blocks

| Page | Complete | Notes |
|------|----------|-------|
| Home.md | ✅ | Standard nav block |
| Getting-Started.md | ✅ | Standard nav block |
| User-Guide.md | ✅ | Standard nav block |
| Symptom-Library.md | ✅ | Standard nav block |
| Clinical-Governance.md | ✅ | Standard nav block |
| AI-Features.md | ✅ | Standard nav block |
| Appointment-Directory.md | ✅ | Standard nav block |
| Workflow-Guidance.md | ✅ | Standard nav block |
| High-Risk-&-Highlighting.md | ✅ | Standard nav block |
| Multi-Surgery-&-RBAC.md | ✅ | Standard nav block |
| Admin-Guide.md | ✅ | Fixed in this audit |
| Developer-Guide.md | ✅ | Includes Docs Maintenance |
| Docs-Maintenance.md | ✅ | Includes Docs Maintenance |

**Note:** Docs-Maintenance link is intentionally only in Developer-Guide and Docs-Maintenance (maintainer artefact).

### Terminology

| Term | Status | Notes |
|------|--------|-------|
| "Practice Handbook" | ✅ | Canonical name used consistently |
| "Admin Toolkit" | ✅ | Only appears as historical context |

### Version alignment

| Location | v1.3 mentioned | Aligned |
|----------|----------------|---------|
| README.md "What's New" | ✅ | ✅ |
| Home.md "What's New" | ✅ | ✅ (Fixed in this audit) |
| RELEASE_NOTES.md | ✅ | ✅ |

---

## Fixed in this pass

| File | Description |
|------|-------------|
| `docs/wiki/Home.md` | Updated "What's New" to include v1.3 and align with README.md |
| `docs/wiki/Home.md` | Updated "Last updated" date from December 2025 to January 2026 |
| `docs/wiki/Admin-Guide.md` | Added missing navigation links (Workflow Guidance, Admin Guide) and standardised nav block format |

---

## Needs attention

### P0 — Broken / misleading (none found)

No critical issues identified.

### P1 — Incomplete / outdated

| File | Issue | Recommendation |
|------|-------|----------------|
| `docs/PRODUCT_OVERVIEW.md` | Does not mention Practice Handbook or Workflow Guidance modules | Update to include all current modules |
| `docs/wiki/Home.md` | "What It Does" section doesn't mention Practice Handbook | Add Practice Handbook to feature list |
| Multiple wiki pages | "Last updated: December 2025" (Symptom-Library, Multi-Surgery-&-RBAC, High-Risk-&-Highlighting, Appointment-Directory, AI-Features) | Update dates if content has changed |

### P2 — Polish / nice-to-have

| File | Issue | Recommendation |
|------|-------|----------------|
| `docs/wiki/images/clinical_review.png` | Exists but not used in any page | Consider adding to Clinical-Governance.md or remove |
| `docs/Admin Toolkit – Architecture & Behaviour Overview.md` | Filename still uses "Admin Toolkit" | Consider renaming to "Practice Handbook – Architecture & Behaviour Overview.md" |
| Archive folder | Contains legacy files | No action needed; intentionally preserved |

---

## Coverage by audience

### A) Practices / PCNs evaluating the toolkit
- ✅ PRODUCT_OVERVIEW.md
- ✅ Home.md
- ✅ README.md
- ⚠️ Could benefit from Practice Handbook mention in PRODUCT_OVERVIEW

### B) Admin / reception staff
- ✅ User-Guide.md
- ✅ Symptom-Library.md
- ✅ Appointment-Directory.md

### C) Surgery admins / governance leads
- ✅ Admin-Guide.md
- ✅ Clinical-Governance.md
- ✅ Getting-Started.md
- ✅ Multi-Surgery-&-RBAC.md

### D) Developers / maintainers
- ✅ Developer-Guide.md
- ✅ PROJECT_SUMMARY.md
- ✅ Docs-Maintenance.md
- ✅ Practice Handbook Architecture doc (orphaned but accessible)

---

## Verification checklist

- [x] All internal links resolve
- [x] All anchors work (including #practice-handbook)
- [x] All images exist and paths are correct
- [x] Navigation blocks are consistent
- [x] Terminology uses "Practice Handbook" canonically
- [x] Version information is aligned across pages
- [x] No duplicate or contradictory content

---

## Next steps

1. Address P1 issues when convenient
2. Review P2 issues during next documentation refresh
3. Run this audit quarterly or after major releases

---

*Report generated: January 2026*
