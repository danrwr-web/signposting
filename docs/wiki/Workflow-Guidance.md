# Workflow Guidance

## Navigation

- [Home](Home)

- [Getting Started](Getting-Started)

- [User Guide](User-Guide)

- [Day-to-day use](Day-to-day-use)

- [Symptom Library](Symptom-Library)

- [Clinical Governance](Clinical-Governance)

- [AI Features](AI-Features)

- [Appointment Directory](Appointment-Directory)

- [Daily Dose](Daily-Dose)

- [Workflow Guidance](Workflow-Guidance)

- [High-Risk & Highlighting](High-Risk-&-Highlighting)

- [Multi-Surgery & RBAC](Multi-Surgery-&-RBAC)

- [Admin Guide](Admin-Guide)

- [Developer Guide](Developer-Guide)

---

## What is Workflow Guidance?

Workflow Guidance provides visual flow-diagram based guidance to support staff in handling common internal workflows such as discharge summaries, test requests, and GP review.

## How this differs from Signposting

Signposting focuses on where a patient should be directed.

Workflow Guidance focuses on how staff should process work internally once it arrives.

## Global Default and Surgery Workflows

Workflows are initially created as Global Default templates.

Surgeries can:
	•	Use Global Default workflows unchanged
	•	Create local overrides for surgery-specific processes
	•	Create entirely surgery-specific workflows

## Node Badges and Styling

Workflow nodes support visual badges and custom styling to help distinguish different types of steps:

### Badges

Nodes can display badges (e.g., "STAMP") as small pills in the top-right corner. Badges help quickly identify special requirements or categories.

### Node Styling

Nodes can be customised with:
- **Theme presets**: Default, Info (blue), Warning (amber), Success (green), Muted (gray), Panel (background)
- **Custom colours**: Background, text, and border colours
- **Visual properties**: Border width, border radius, font weight

### Panel Nodes

Panel nodes are background container nodes that can group related workflow steps. They render behind other nodes and can be resized and repositioned to create visual groupings.

## Draft and Approval States

All workflows operate within a draft-and-approve lifecycle to ensure clinical governance.

Draft workflows are visible only to admins.

Approved workflows are visible to staff.

## Governance and Audit

Every workflow records:
	•	Who approved it
	•	When it was approved
	•	Who last edited it
	•	When it was last edited

