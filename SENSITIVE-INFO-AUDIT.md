# Sensitive Information Audit Report

This document lists all potentially sensitive information found in the repository that should be reviewed or removed before making the repository public.

---

## 🔴 CRITICAL — Must Remove/Replace

### 1. Email Addresses (Personal/Work)
**Location:** Multiple files
**Risk:** PII, spam, phishing

- `d.webber-rookes2@nhs.net` — Found in:
  - `docs/wiki/Home.md` (line 89)
  - `wiki/Home.md` (line 89)
  - `docs/PRODUCT_OVERVIEW.md` (line 58)
  - `src/app/LandingPageClient.tsx` (lines 419, 422, 480)
  - `src/app/privacy/page.tsx` (lines 80, 100)

- `dan.rwr@gmail.com` — Found in:
  - `src/app/admin/AdminPageClient.tsx` (line 926-927) — Hardcoded email check
  - `src/app/api/admin/upload-excel/route.ts` (line 21) — Hardcoded email restriction
  - `src/app/api/seed/route.ts` (line 57, 103)
  - `src/app/api/seed-simple/route.ts` (line 46, 95)
  - `src/app/api/seed-minimal/route.ts` (line 23)
  - `src/app/api/create-user/route.ts` (line 17)
  - `src/app/api/fix-user-passwords/route.ts` (line 27)
  - `src/app/test-user-lockout/page.tsx` (line 82)

**Recommendation:**
- Replace with generic placeholders: `admin@example.com` or `contact@signposting-toolkit.com`
- For public-facing pages, consider using a generic contact form or support email

---

### 2. Personal Names
**Location:** Multiple documentation files
**Risk:** PII

- "Dr Daniel Webber-Rookes" — Found in:
  - `README.md` (line 112)
  - `docs/PROJECT_SUMMARY.md` (line 4)
  - `docs/USER_GUIDE.md` (multiple references)
  - `src/app/privacy/page.tsx` (line 26)
  - `src/components/TestUserUsage.tsx` (line 84)
  - `src/app/test-user-lockout/page.tsx` (line 79)

**Recommendation:**
- Replace with generic: "Project Maintainer" or "Development Team"
- Or keep author attribution but consider if this is desired for public repo

---

### 3. Surgery/Organization Names
**Location:** Multiple files
**Risk:** Internal business information

- "Ide Lane Surgery" — Found in:
  - `README.md` (line 112)
  - `docs/PROJECT_SUMMARY.md` (line 4)
  - `docs/USER_GUIDE.md` (multiple references, including operational details)
  - `docs/RELEASE_NOTES.md` (line 54)
  - `src/app/LandingPageClient.tsx` (line 122)
  - `src/app/privacy/page.tsx` (lines 16, 26, 65)
  - `prisma/seed.ts` (multiple references)
  - `src/app/api/seed*.ts` files (multiple)
  - `start-dev.ps1` and `start-dev.bat` (default surgery slug)

**Recommendation:**
- Replace with generic placeholders: "Example Surgery" or "Sample Practice"
- Remove specific operational details about Ide Lane's workflow in `docs/USER_GUIDE.md`
- Replace default surgery slug with generic value

---

### 4. Database File with Potential Data
**Location:** `prisma/dev.db`
**Risk:** May contain test data or development information

- SQLite database file exists
- **MUST be in .gitignore** (verify it is)
- Should not be committed to repository

**Recommendation:**
- Verify `.gitignore` includes `*.db` or `prisma/dev.db`
- Ensure no database files are tracked in git

---

## 🟡 MEDIUM — Review and Consider Removing

### 5. Hardcoded Email Checks in Authorization
**Location:** Code files
**Risk:** Security through obscurity, maintenance issues

- `src/app/admin/AdminPageClient.tsx` (lines 926-928) — Checks for specific email
- `src/app/api/admin/upload-excel/route.ts` (line 21) — Restricts to specific email
- `src/app/api/fix-user-passwords/route.ts` (line 27) — Checks for specific email

**Recommendation:**
- Replace with role-based or environment variable-based checks
- Use proper RBAC instead of hardcoded emails

---

### 6. Test/Demo User Emails in Seed Scripts
**Location:** Seed and API files
**Risk:** May create confusion or expose test accounts

- `src/app/api/seed*.ts` files contain:
  - `admin@idelane.com`
  - `user@idelane.com`
  - `superuser@example.com`

**Recommendation:**
- These are acceptable for seed scripts, but ensure they're clearly documented as test data
- Consider using obviously fake emails: `test-admin@example.com`

---

### 7. Development Script Defaults
**Location:** `start-dev.ps1`, `start-dev.bat`
**Risk:** Reveals internal naming conventions

- Default surgery slug: `ide-lane`

**Recommendation:**
- Change to generic: `example-surgery` or `demo-surgery`

---

## 🟢 LOW — Generally Acceptable but Review

### 8. Example Environment Variables
**Location:** `env.example`, `README.md`
**Status:** ✅ Acceptable
- These are examples/placeholders and are fine to keep
- No real credentials exposed

### 9. Generic Test Data
**Location:** Seed scripts
**Status:** ✅ Generally acceptable
- Generic test symptoms and appointments are fine
- Ensure no real patient data or real appointment details

### 10. Git Commit Messages
**Location:** Git history
**Risk:** May contain sensitive information in commit messages

**Recommendation:**
- Review git history for any commits with sensitive data
- Consider using `git filter-repo` or BFG Repo-Cleaner if needed
- Or start fresh with a cleaned history

---

## ✅ Already Safe

- ✅ `.env.local` files are in `.gitignore`
- ✅ `env.example` only contains placeholders
- ✅ No hardcoded API keys found
- ✅ No database connection strings with real credentials
- ✅ Documentation refers to environment variables correctly

---

## 📋 Action Items Summary

### Before Making Public:

1. **Replace all email addresses:**
   - `d.webber-rookes2@nhs.net` → Generic contact email
   - `dan.rwr@gmail.com` → `admin@example.com` or use environment variable

2. **Replace personal/surgery names:**
   - "Dr Daniel Webber-Rookes" → "Project Maintainer" or keep if desired
   - "Ide Lane Surgery" → "Example Surgery" or generic placeholder

3. **Update authorization checks:**
   - Remove hardcoded email checks
   - Use proper RBAC or environment variables

4. **Update seed/development scripts:**
   - Replace surgery names with generic examples
   - Update default slugs to generic values

5. **Remove internal operational details:**
   - Review `docs/USER_GUIDE.md` for Ide Lane-specific workflow details
   - Make generic or remove

6. **Verify database files:**
   - Ensure `prisma/dev.db` is in `.gitignore`
   - Remove from git if already tracked

7. **Review git history:**
   - Check for sensitive data in commit messages
   - Consider history cleanup if needed

---

## 🔍 Verification Commands

```bash
# Check if dev.db is tracked
git ls-files | grep -i "\.db$"

# Check gitignore
cat .gitignore | grep -i "db"

# Search for remaining email addresses (after cleanup)
grep -r "d\.webber\|dan\.rwr\|@nhs\.net\|@gmail" --exclude-dir=node_modules

# Search for surgery name (after cleanup)
grep -r "Ide Lane" --exclude-dir=node_modules
```

---

_Last updated: December 2025_

