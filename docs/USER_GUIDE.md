# 🏥 Signposting Toolkit – User Guide
**Version:** 1.0 (Web Release, November 2025)  
**Author:** Dr Daniel Webber-Rookes  
**Date:** November 2025

---

## 1. Introduction

The **Signposting Toolkit** was developed at **Ide Lane Surgery, Exeter**, to support the administrative team in safely and efficiently navigating patient requests. It provides clear, structured guidance on what to ask, how to prioritise, and when to escalate to a clinician.

The toolkit enables consistent, accurate signposting to the most appropriate service — whether that's a GP, nurse, pharmacist, or self-care option — while ensuring patient safety and continuity of care remain at the centre of our approach.

Now available as a browser-based web application, the toolkit no longer requires PowerApps or Excel. It includes over 200 preloaded symptoms and enhanced AI features to support staff training and content management.

---

## 2. Purpose of the Toolkit

The toolkit was designed to:

- Empower non-clinical staff to triage safely within defined boundaries  
- Improve consistency in how incoming requests are handled  
- Reduce unnecessary GP appointments by appropriate redirection  
- Support continuity by matching patients to the right clinician  
- Save time by providing instant access to symptom-specific guidance  

It is **not** a clinical decision-support system and does not replace professional judgement. All use is governed by local policies and subject to clinical oversight.

---

## 3. New in Version 1.0

### 3.1 Symptom Library

A new, intuitive interface allows admins and superusers to manage the symptom library directly from the Admin dashboard. The library functions like a file explorer, enabling you to:

- **Enable or disable** any symptom for your surgery
- **Preview** full guidance even for disabled symptoms via a preview drawer
- **Search and filter** symptoms for easy navigation
- Make informed decisions about which symptoms to activate based on local needs

### 3.2 AI Tools

Two powerful AI features are now available (when enabled by your surgery):

- **Generate Explanation** – Automatically produces a plain-English explanation for any symptom's guidance, helping translate clinical text into patient-friendly language.

- **Training Mode** – Helps staff test their understanding through short practice questions and simulated triage scenarios to reinforce learning.

All AI functionality runs securely via Azure OpenAI, with no patient data stored. Usage tracking is visible to superusers for transparency.

### 3.3 Feature Flags

Superusers can enable or disable features (e.g. AI tools) for each surgery, while admins can toggle access for individual users. This provides flexible control over which capabilities are available to your team.

### 3.4 User Management Redesign

The user management interface has been modernised with:

- Cleaner layout with avatars and badges
- Compact action buttons for clarity
- Improved visual hierarchy and navigation

### 3.5 Clinical Review Workflow

The clinical review workflow remains unchanged in logic but has been visually improved for easier navigation and clearer status indicators.

---

## 4. How the Toolkit Works

### 4.1 Workflow Overview

1. A patient contacts the surgery (by phone or eConsult).  
2. The admin team identifies the symptom or reason for contact.  
3. They open the **Signposting Toolkit** and select the corresponding symptom from the Symptom Library.  
4. The toolkit provides:  
   - A **brief instruction** (one-line summary)  
   - **Detailed guidance** on what to ask and what action to take  
   - **Red flag warnings** (highlighted in red)  
   - **Age-specific guidance** (Under-5, Over-5, Adult)  
5. Based on the guidance, the admin decides whether to:  
   - Book a **routine**, **semi-urgent**, **urgent**, or **triage** slot  
   - **Signpost** the patient to a community service (e.g. Pharmacy First)  
   - Or **escalate** to a clinician if unsure or a red flag is present  

Admins and superusers can manage their Symptom Library directly from the Admin dashboard, enabling, disabling, or previewing symptoms as needed. The preview drawer allows users to view full guidance even for disabled symptoms before deciding to re-enable them.

The toolkit includes automatic highlighting for **Pharmacy First** and **Red Slot** keywords to assist with consistent routing.

### 4.2 Red Flag Pathways

Certain symptoms automatically link to specific triage screens:
- **Stroke** → opens a stroke assessment screen  
- **Sepsis** → opens sepsis risk indicators  

These screens prompt yes/no questions and provide clear instructions on when to escalate immediately.

---

## 5. Appointment Slot Types

| **Colour** | **Type** | **Purpose / Use** |
|-------------|-----------|------------------|
| 🟩 **Green** | Routine | Non-urgent issues, follow-ups, medication reviews, ongoing problems. |
| 🟥 **Red** | Urgent / Same-Day | For problems requiring prompt GP review (same-day triage). |
| 🟧 **Orange** | Semi-Urgent (Face-to-Face GP) | For issues requiring a face-to-face review within the next few days. Not immediately urgent but cannot wait more than 2–3 days. |
| 🩷 **Pink / Purple** | Triage (Within 48 Hours) | For problems requiring GP review or decision within 48 hours. Usually booked for GP assessment before confirming an appointment. **Do not promise a face-to-face unless instructed by the GP.** |

---

### How the Appointment System Operates at Ide Lane

Ide Lane Surgery operates a **mostly GP triage-based model**, where the majority of patient contacts are booked into a **telephone triage appointment (pink/purple slot)** before any face-to-face consultation is arranged.  
This means that approximately **70% of appointments visible on the system are pink or purple**.

We have a strong focus on **continuity of care**, so triage is undertaken by the **patient's own GP** wherever possible.  
Ide Lane does **not operate a duty doctor system**; instead, **red (urgent) appointments** are booked with the patient's own GP or, if they are unavailable, their **buddy GP**.  

Other practices with a duty system in place could **adapt the toolkit accordingly**, directing urgent or same-day requests to the duty clinician rather than to a named GP.

---

## 6. Customisation and Administration

Each practice can adapt the toolkit to reflect local policies and clinical preferences. The toolkit now provides enhanced administrative capabilities through the web interface.

### 6.1 Symptom Library Management

Admins and superusers can manage the symptom library directly from the Admin dashboard:

- **Enable or disable** symptoms for your surgery
- **Preview** symptoms before enabling (via the preview drawer)
- **Search and filter** the library for easy navigation
- **View usage statistics** to understand which symptoms are most commonly accessed

### 6.2 Add, Edit, Delete Functions

Administrators can:

- **Add** new symptoms specific to their surgery
- **Edit** existing symptoms (with confirmation prompts to prevent accidental changes)
- **Delete** symptoms (requires confirmation)

Practice admins can modify symptoms for their own surgery, while superusers can manage base symptoms and promote practice-specific ones to the shared library for use by other surgeries.

**Editable fields include:**
- Symptom name  
- Brief instruction (summary)  
- Highlighted text (warnings or alerts)  
- Detailed instructions (actions and questions to ask)  
- Links to other pages or resources  
- Age-specific guidance (Under-5, Over-5, Adult)

### 6.3 AI Permissions via Features Tab

Access to AI features is controlled through the Features tab, where:

- **Superusers** can enable or disable AI features for each surgery
- **Admins** can toggle AI access for individual users within their surgery
- All AI usage is tracked and visible to superusers for transparency

### 6.4 User and Surgery Management

The modernised user management interface provides:

- **User management** with avatars, badges, and clear role indicators
- **Surgery management** for multi-site organisations
- **Permission management** with granular control over features
- Compact action buttons for clarity and efficiency

Practices adopting the toolkit are strongly encouraged to review all wording for local accuracy, governance, and safety.

### 6.5 Onboarding a new surgery and using AI customisation

1. **Enable AI surgery-specific customisation**  
   - A superuser turns on the “AI surgery-specific customisation” feature for the surgery in the Features section.

2. **Complete the onboarding questionnaire**  
   - Go to the **Setup Checklist** tab and start the onboarding wizard.  
   - Fill in general surgery information, escalation preferences, local services, and appointment workflow description.

3. **Configure appointment types and naming (Step 2.5)**  
   - In the onboarding wizard, define the surgery’s appointment model (e.g. routine continuity GP appointments, GP triage within 48h, urgent same-day telephone/face-to-face, and any direct-booking routes such as First Contact Physio or clinical pharmacist).  
   - For each type, specify the local name, who usually delivers it, and when it should be used.

4. **Run AI customisation**  
   - From the **AI Setup** page, choose whether to customise all enabled symptoms or select a subset manually.  
   - The AI rewrites instructions using the onboarding profile and appointment model, and can add helpful icons for clarity.

5. **Review and approve changes**  
   - All AI-generated changes are marked **PENDING** and appear in the **Clinical Review** section.  
   - A clinician reviews differences, approves, or amends text. Only **APPROVED** instructions are shown to staff.

6. **Use the Setup Checklist as your “home base”**  
   - The Setup Checklist shows which steps are complete, how many symptoms still need review, and whether the surgery is “ready to go live”.  
   - Admins can return here anytime to edit onboarding details or re-run AI customisation.

---

## 7. AI Features

AI functionality is optional and controlled via the Features tab. When enabled for your surgery or user account, you have access to two powerful tools:

### 7.1 Generate Explanation

The Generate Explanation feature automatically produces a plain-English explanation for any symptom's guidance. This tool helps:

- Translate clinical text into patient-friendly language
- Create accessible explanations for complex medical concepts
- Support staff training and patient communication

**Important:** All AI-generated text must be reviewed by a clinician before inclusion in live symptom guidance.

### 7.2 Training Mode

Training Mode helps staff test their understanding through:

- Short practice questions based on symptom scenarios
- Simulated triage situations to reinforce learning
- Feedback on decision-making to improve confidence

This mode provides a safe environment for staff to practice without impacting real patient care.

### 7.3 Security and Privacy

- All AI actions run securely via Azure OpenAI
- No patient data is stored or transmitted to AI services
- Usage tracking is visible to superusers for transparency
- All AI-generated content requires clinical review before use

---

## 8. Governance and Safety

This toolkit was developed at **Ide Lane Surgery** as an internal administrative aid.  
It is **not an approved clinical triage or diagnostic system** and should not be used as such.

The toolkit is for **administrative use only**. All AI-generated text must be reviewed by a clinician before inclusion in live symptom guidance.

AI-generated content is never shown directly to staff. Every AI-generated instruction is saved as an override, marked as **PENDING** in the clinical review system, and must be reviewed and approved (or edited) by a clinician before it becomes active. The clinical review screen highlights what changed so reviewers can sign off safely and efficiently.

### 8.1 AI-Customised Instructions (Beta)

The AI customisation tool helps adapt symptom instructions to each surgery's local setup, using the information provided during the onboarding questionnaire and appointment model. It focuses on improving clarity, aligning language with local appointment types, and applying Pharmacy First and escalation rules consistently.

This is a **beta feature** and remains under active development.

Importantly, the AI does **not** automatically change which clinician a patient should be booked with. It will not, for example, convert a GP/Duty Team recommendation into an ANP, FCP, or pharmacist appointment by itself. Decisions about whether a symptom is appropriate for a Minor Illness Clinician, FCP, pharmacist or Duty Team remain clinical decisions made by humans.

All AI-generated instructions are saved as overrides, marked as **PENDING**, and must be reviewed and approved through the Clinical Review screen before they become visible to staff in the live signposting tool.

The AI is intended to support clearer, locally relevant instructions, not to replace clinical judgement or alter routing decisions without explicit human review.

Practices using or adapting this toolkit do so **at their own risk** and must ensure:

- Approval by a **Clinical Safety Officer** or equivalent lead  
- Review and sign-off by a **GP or senior clinician**  
- Compliance with local **Information Governance** and **Data Protection** standards  
- Regular review of content for accuracy and currency  

If in doubt, err on the side of escalation.

---

## 9. Clinical Review and Local Sign‑off

Each practice must review and approve its own symptom guidance. Until approved, staff will see a banner stating the content is awaiting local clinical review.

### 9.1 For Admins / Senior Clinicians

1. Open the Admin dashboard and select your surgery.
2. Click **Clinical Review** to see all symptoms for that surgery.
3. For each symptom, choose:
   - **Approved** – content is appropriate
   - **Needs Change** – content requires editing (use "View / Edit" to open the instruction page)
   - **Set Pending** – revert back to pending if needed
4. When no items are pending, click **Complete Review and Sign Off**.
5. To re‑inspect annually (or after substantive changes), click **Request Re‑review**. This resets all statuses to Pending and shows the staff banner again.

On each instruction page (when accessed from Clinical Review), you can also approve/mark needs‑change directly and navigate Previous/Next.

### 9.2 For Staff (Reception / Navigation)

- If a yellow banner appears, the content is awaiting your practice's clinical review. Use the guidance as an aid, but check with a clinician if unsure.
- Once signed off, the banner disappears. The instruction page will show who approved it and when.

---

## 10. Using the Toolkit (Step-by-Step)

1. **Open the web app** and log in (if required).  
2. **Select the symptom** that best matches the patient's presentation from the Symptom Library.  
3. **Read the brief instruction** to orient yourself.  
4. **Confirm the patient's age group** (Under-5, Over-5, Adult).  
5. Follow the **detailed instructions**, noting any highlighted red flags.  
6. Choose the **appropriate action**:
   - Self-care / community service  
   - Book appointment (Green / Orange / Red / Pink)  
   - Escalate to GP triage  
7. **Document** the contact according to practice policy (e.g. task note or call summary).  
8. **If unsure**, always seek advice from the on-call GP or duty doctor.

---

## 11. Key Features

- **Age Filters:** Toggle between Under-5 / Over-5 / Adult guidance.  
- **Linked Pages:** Some instructions include links to related pages (e.g. "Allergy" → "Anaphylaxis").  
- **Highlight Text:** Important warnings appear in **bold red text** for clarity.  
- **Automatic Highlighting:** Pharmacy First and Red Slot keywords are automatically highlighted.  
- **User Tracking:** The system logs which users and symptoms are accessed most frequently.  
- **Editable Content:** Admins with permission can add, edit, or remove symptoms.  
- **Symptom Library:** Intuitive management interface for enabling, disabling, and previewing symptoms.

---

## 12. Example Scenarios

### Example 1 – Sore Throat
- Select *Sore Throat* → toolkit shows pharmacy/self-care guidance.  
- If mild and under 7 days → signpost to **Pharmacy First**.  
- If systemic unwellness, swallowing difficulty, or prolonged duration → book **Green** or **Orange** slot.

### Example 2 – Rash with Fever
- Select *Rash* → toolkit highlights red flags (non-blanching rash, drowsiness, etc.).  
- If red flag present → **Red slot / immediate GP**.  
- If well, no fever → Pharmacy First or **Green** slot for review.

---

## 13. Support and Feedback

For issues, suggestions, or feedback:
- Use the **"Suggest a Change"** form within the app to submit your idea.  
- Include your name and description of the suggested improvement.  
- Feedback will be reviewed regularly by the admin team and clinical leads.

---

## 14. Donations and Support

The Signposting Toolkit is shared in good faith to help other surgeries improve patient access and workflow safety.  
It is self-funded and maintained voluntarily.  

The toolkit is now shared with other surgeries beyond Ide Lane, helping improve patient care across multiple practices.

If you find it valuable, please consider contributing to its ongoing development:  

👉 **[Support Development]** *(now available via Support Development link)*  

*(Voluntary donations help cover hosting and update costs.)*

---

## 15. Version Control and Updates

| **Date** | **Version** | **Changes** |
|-----------|--------------|--------------|
| Nov 2025 | 1.0 | Major update: web release with Symptom Library, AI features, and feature-flag system |
| Oct 2025 | 0.9 (Beta) | Initial web beta release |

---

> Developed by **Dr Daniel Webber-Rookes** and the team at Ide Lane Surgery, Exeter  
> © 2025 Signposting Toolkit – All rights reserved  
> Version 1.0 (Web Release, November 2025)

**If at any point you are worried about safety, or something does not fit one of the options given, stop and check with a clinician immediately rather than booking a routine slot.**
