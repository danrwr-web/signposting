# Clinical Governance

The Signposting Toolkit includes a robust clinical governance model that ensures all symptom guidance is clinically reviewed and approved before going live. This maintains safety, accountability, and clinical oversight.

---

## Governance Principles

### Clinical Responsibility
- Each surgery is responsible for its own final wording
- Base library is centrally maintained but overrideable
- All AI-generated content must be clinician-reviewed
- Local customisations require local approval

### Safety First
- No symptom goes live without clinical review
- Pending symptoms trigger warnings to all users
- Complete audit trail of all approvals
- Review status clearly visible to staff

---

## Clinical Review Workflow

### States

Symptom guidance can exist in three states:

1. **PENDING** — Awaiting local clinical review
   - Symptom is visible but flagged
   - All users see a warning banner
   - Cannot be fully used until approved

2. **APPROVED** — Clinically signed off
   - Symptom is fully available
   - No warnings displayed
   - Ready for staff use

3. **CHANGES_REQUIRED** — Flagged for updates
   - Review identified issues
   - Requires modification before approval
   - Clear feedback provided

### Review Process

1. **Symptom Creation or Modification**
   - Admin creates or edits symptom
   - System automatically sets status to PENDING
   - Warning appears to all users

2. **Clinical Review**
   - Appointed clinician reviews the content
   - Reviews instructions for safety and accuracy
   - Checks alignment with local pathways

3. **Approval Decision**
   - Approve: Content goes live
   - Request Changes: Feedback provided, returns to editing
   - Reject: Remove or archive

4. **Audit Record**
   - Reviewer identity recorded
   - Date and time of approval logged
   - Changes tracked in history

---

## Who Can Review

### Review Permissions
- Surgery Admins can approve symptoms
- Clinical reviewers designated by surgery
- Superusers have full access to all surgeries

### Responsibilities
- Ensure clinical accuracy
- Verify alignment with local pathways
- Check for safety concerns
- Approve or request changes

---

## AI Content Review

All AI-generated content enters the review workflow automatically:

### AI Instruction Editor
- AI suggestions stored as DRAFT
- Must pass clinical review before publishing
- Reviewer can modify before approval

### AI Suggested Questions
- Generated questions enter PENDING state
- Clinical review ensures safety and appropriateness
- Can be edited or rejected during review

### Safety Checks
- AI output never goes live automatically
- Always requires human clinical oversight
- Reviewer has final say on all content

---

## Audit Trail

The system maintains a complete record of all review activities:

### Recorded Information
- **Reviewer Identity** — Who approved the content
- **Review Date** — When approval occurred
- **Review Notes** — Optional comments or concerns
- **Previous Versions** — History of changes
- **Field Changes** — What was modified

### Benefits
- Accountability for all approvals
- Traceability for clinical governance
- Support for CQC inspections
- Quality assurance documentation

---

## Re-Review Workflow

Symptoms can be re-reviewed at any time:

### Triggers for Re-Review
- Annual review cycle
- Base library updates available
- Clinical pathway changes
- Concerns raised by staff
- CQC or audit requirements

### Re-Review Process
- Admin can request re-review
- Status returns to PENDING
- Warning reappears until approved
- History maintains previous approvals

---

## Pending Symptoms Warning

When symptoms are pending review, all users see a clear warning banner indicating:

- Number of pending symptoms
- Link to review queue
- Impact on system availability

This ensures transparency and encourages timely review.

---

## Role Responsibilities

### Surgery Admin
- Create and edit symptoms
- Submit for clinical review
- Approve or request changes
- Manage review queue

### Clinical Reviewer
- Review pending symptoms
- Ensure clinical accuracy
- Approve or provide feedback
- Maintain safety standards

### Standard Users
- View approved symptoms
- See pending warnings
- Report concerns via suggestions
- Cannot approve content

### Superuser
- Full access to all surgeries
- Can approve any symptom
- System-wide oversight
- Manages base library updates

---

## Governance Model

### Hierarchical Structure
- **Surgery Level** — Each surgery manages its own reviews
- **Base Level** — Central library maintained by superusers
- **User Level** — Individual users cannot override approvals

### Data Isolation
- Each surgery's reviews are independent
- No cross-surgery visibility (except superusers)
- Complete data isolation between practices

---

## Best Practices

### Review Frequency
- Review new symptoms within 48 hours
- Annual review of all symptoms
- Re-review after pathway changes
- Review AI suggestions promptly

### Review Checklist
- ✅ Clinical accuracy verified
- ✅ Local pathways reflected
- ✅ Safety considerations addressed
- ✅ Plain English maintained
- ✅ Age groups appropriate
- ✅ Instructions clear and actionable

---

## Related Pages

- [Symptom Library](Symptom-Library) — How symptoms are structured
- [AI Features](AI-Features) — How AI content enters review
- [Multi-Surgery & RBAC](Multi-Surgery-&-RBAC) — Role permissions and access

---

_Last updated: December 2025_

