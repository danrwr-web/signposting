# AI Features

## Navigation

- [Home](Home)
- [Symptom Library](Symptom-Library)
- [Clinical Governance](Clinical-Governance)
- [AI Features](AI-Features)
- [Appointment Directory](Appointment-Directory)
- [High-Risk & Highlighting](High-Risk-&-Highlighting)
- [Multi-Surgery & RBAC](Multi-Surgery-&-RBAC)
- [Developer Guide](Developer-Guide)

The Signposting Toolkit includes AI-powered tools to help improve symptom instructions and generate safe triage questions. All AI-generated content requires mandatory clinical review before publication, ensuring safety and clinical oversight.

---

## Overview

The AI features are designed to support, not replace, clinical judgement. They assist with:
- Improving clarity and readability
- Generating appropriate triage questions
- Maintaining consistent tone and structure

All AI output is subject to the same clinical governance requirements as manually-written content.

---

## AI Instruction Editor

The AI Instruction Editor helps improve the clarity and tone of symptom instructions while maintaining clinical accuracy.

### How It Works

1. **Admin Initiates Request**
   - Admin clicks "Customise Instructions" on a symptom
   - AI processes the current instructions
   - Generates improved version

2. **AI Generation**
   - AI rewrites for clarity
   - Maintains clinical accuracy
   - Preserves key information
   - Uses plain English principles

3. **Draft Creation**
   - Suggestion stored as DRAFT
   - Original content remains unchanged
   - Admin can preview changes

4. **Clinical Review Required**
   - Draft automatically enters PENDING state
   - Must be reviewed before publishing
   - Reviewer can approve, modify, or reject

5. **Publication**
   - Only after clinical approval
   - Original version retained in history
   - Full audit trail maintained

### Features

- **Clarity Improvement** — Rewrites complex sentences
- **Tone Consistency** — Maintains NHS style guide
- **Plain English** — Ensures readability (reading age 9-12)
- **Clinical Preservation** — Keeps medical accuracy
- **Undo Capability** — Can revert to previous version

### Safety Checks

- Never publishes automatically
- Always requires human review
- Original content preserved
- Change history tracked

---

## AI Suggested Questions

AI Suggested Questions generates grouped triage-style questions to help staff gather information safely and consistently.

### Question Categories

Generated questions are organised into logical groups:

1. **Red Flags**
   - Critical symptoms requiring immediate attention
   - Safety indicators
   - Urgency markers

2. **Urgency/Timing**
   - How quickly care is needed
   - Time-sensitive factors
   - Appointment priority

3. **Pathway Suitability**
   - Which service is appropriate
   - Referral criteria
   - Alternative options

### How It Works

1. **Generate Questions**
   - Admin clicks "Get Questions to Ask"
   - AI analyses symptom context
   - Generates relevant question sets

2. **Review Required**
   - Questions enter PENDING state
   - Must be clinically reviewed
   - Can be edited during review

3. **Approval**
   - Clinician reviews for safety
   - Verifies appropriateness
   - Approves or modifies

4. **Usage**
   - Available on symptom pages
   - Staff can reference when needed
   - Supports consistent triage

### Safety Considerations

- Questions screened for appropriateness
- No automatic publication
- Clinical review mandatory
- Can be rejected or modified

---

## Smart Symptom Updates

When base library content is updated centrally, surgeries can choose to adopt updates or keep their local versions.

### Update Detection
- System detects base library changes
- Surgeries notified of available updates
- Comparison shows differences

### Update Process
- Admin reviews changes
- Can accept, modify, or decline
- Accepted changes enter review workflow
- Local customisations preserved

### Benefits
- Stay current with best practice
- Maintain local adaptations
- Choose what to adopt
- Complete control over updates

---

## Feature Flags

AI features can be enabled or disabled at multiple levels:

### Control Levels
- **Superuser** — Global feature control
- **Surgery** — Per-practice enablement
- **User** — Individual user overrides (if surgery enabled)

### Current Features
- `ai_instructions` — AI Instruction Editor
- `ai_questions` — AI Suggested Questions
- `smart_symptom_updates` — Smart update notifications

### Management
- Surgery admins can enable/disable
- Superusers control globally
- Features respect review workflow regardless of flag status

---

## AI Safety Principles

### Core Principles

1. **Human in the Loop**
   - All AI output reviewed by clinicians
   - No automatic publication
   - Human judgement always final

2. **Clinical Governance**
   - Same review process as manual content
   - Audit trail maintained
   - Reviewer accountability

3. **Transparency**
   - Clear indication of AI-generated content
   - Original versions preserved
   - Change history visible

4. **Accuracy Preservation**
   - Clinical facts maintained
   - No unsupported changes
   - Medical accuracy prioritised

5. **Reversibility**
   - Can undo AI changes
   - Previous versions accessible
   - No permanent modifications

---

## AI Technology

### Platform
- Azure OpenAI (secure server-side calls)
- Server-side processing only
- No client-side AI operations
- Secure API integration

### Privacy & Security
- No patient data used
- Secure server communication
- Audit logging of all AI usage
- Token usage tracking

---

## Best Practices

### For Admins
- Review AI suggestions carefully
- Modify before approval if needed
- Test with staff before publishing
- Use for clarity, not clinical decisions

### For Reviewers
- Verify clinical accuracy
- Check for appropriateness
- Ensure plain English
- Approve only when confident

### For Staff
- AI questions are guides, not scripts
- Use clinical judgement
- Report concerns via suggestions
- Understand AI supports, not replaces

---

## Limitations

### What AI Cannot Do
- Replace clinical judgement
- Make clinical decisions
- Bypass review workflow
- Access patient data

### What AI Can Do
- Improve clarity
- Suggest questions
- Maintain consistency
- Support efficiency

---

## Related Pages

- [Clinical Governance](Clinical-Governance) — How AI content is reviewed
- [Symptom Library](Symptom-Library) — Where AI tools are used
- [Developer Guide](Developer-Guide) — Technical implementation

---

## Screenshots

_Screenshots will be added here. To reference an image, use:_

`![Description](images/example.png)`

---

_Last updated: December 2025_

