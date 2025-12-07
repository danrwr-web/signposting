# Email Address Update Summary

## ✅ Public-Facing Emails Updated

All public-facing email addresses have been replaced with **contact@signpostingtool.co.uk**.

---

## Files Modified

### 1. **src/app/LandingPageClient.tsx**
   - Updated contact email in main CTA section
   - Updated footer contact email

### 2. **src/app/privacy/page.tsx**
   - Updated contact email in "Contact" section
   - Updated footer contact email

### 3. **docs/wiki/Home.md**
   - Updated contact email in "Getting Started" section

### 4. **wiki/Home.md**
   - Updated contact email in "Getting Started" section

### 5. **docs/PRODUCT_OVERVIEW.md**
   - Updated contact email in "To Learn More" section

### 6. **src/app/test-user-lockout/page.tsx**
   - Updated contact email for user inquiries

---

## Before/After Examples

### Example 1: Landing Page
**Before:**
```tsx
<a href="mailto:d.webber-rookes2@nhs.net">d.webber-rookes2@nhs.net</a>
```

**After:**
```tsx
<a href="mailto:contact@signpostingtool.co.uk">contact@signpostingtool.co.uk</a>
```

### Example 2: Documentation
**Before:**
```markdown
For onboarding, demos, or pricing enquiries, contact:  
**d.webber-rookes2@nhs.net**
```

**After:**
```markdown
For onboarding, demos, or pricing enquiries, contact:  
**contact@signpostingtool.co.uk**
```

### Example 3: Privacy Page
**Before:**
```tsx
Email: <a href="mailto:d.webber-rookes2@nhs.net">d.webber-rookes2@nhs.net</a>
```

**After:**
```tsx
Email: <a href="mailto:contact@signpostingtool.co.uk">contact@signpostingtool.co.uk</a>
```

---

## ⚠️ Internal References Left Unchanged

The following files contain email addresses that are **NOT public-facing** and were intentionally left unchanged:

### Internal Authorization Checks (Not Changed)
- `src/app/admin/AdminPageClient.tsx` - Hardcoded authorization check
- `src/app/api/admin/upload-excel/route.ts` - Authorization restriction
- `src/app/api/fix-user-passwords/route.ts` - Internal authorization

**Reason:** These are internal authorization mechanisms, not public-facing contact information. They should be replaced with proper RBAC in a separate refactoring task, not with the contact email.

### Seed/Test Scripts (Not Changed)
- `src/app/api/seed/route.ts`
- `src/app/api/seed-simple/route.ts`
- `src/app/api/seed-minimal/route.ts`
- `src/app/api/create-user/route.ts`

**Reason:** These create development/test user accounts. They are not public-facing contact information and are not shown to end users.

### Audit Documentation (Not Changed)
- `SENSITIVE-INFO-AUDIT.md`

**Reason:** This file documents what needs to be changed, so historical references are appropriate.

---

## ✅ Verification

All public-facing emails have been successfully updated. No personal email addresses remain in:
- Landing/marketing pages
- Privacy/terms pages
- README.md
- Documentation files (docs/ and docs/wiki/)
- User-facing error/info pages

---

_Update completed: December 2025_

