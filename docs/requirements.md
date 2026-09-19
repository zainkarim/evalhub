# EvalHub (Assessment Helper) — Requirements Definition

**Sources:** Kickoff meeting with Prof. Priya Narayanasami (2026-09-04) and follow-up Q&A / meeting summary (2026-09-11). Where the two conflict, the 2026-09-11 meeting supersedes kickoff — several decisions changed a week in (see Change Log at the bottom).

This document exists because the sprint plan was drafted before a standalone requirements definition was written down. It captures what the team has confirmed with the faculty advisor, organized by requirement type, so future sprint planning and feature work can be checked against it directly.

---

## 1. Problem Statement

Replace a manual, spreadsheet/email-based process for scheduling and tracking peer observations of ~100 CS faculty at UTD. The system must manage who is due for evaluation, surface eligible observers, route approval through a human committee, and give both faculty and the committee visibility into the process.

## 2. Platform & Constraints

| Requirement | Value |
|---|---|
| Platform | Web application (confirmed 2026-09-11; desktop wrapper is stretch-only) |
| Cost | All tooling must be free/open-source; no paid tiers, no trials that expire |
| Runtime | Must be able to run on a virtual machine |
| Team size | 6 |
| Timeline | 9-week MVP, as much as possible done before Thanksgiving |

## 3. Personas / End Users

- **Faculty (professors)** — sign up for courses/observations, view their own evaluation history (given + received), fill out or receive observation forms.
- **AC (Assessment Committee) members** — approve observer candidate lists before any communication goes out, configure evaluation criteria/weights, view all dashboards and reports, can step in as an observer when no one else is available.
- **Department Head** — access granted through the committee when needed (facilitator-level, not a separate primary persona).
- **Explicitly out of scope:** students. No student-facing auth or UI is required.

## 4. Functional Requirements

### 4.1 Evaluation Frequency (eligibility engine)
- Assistant Professor: **not** evaluated in their first semester; evaluated every Spring and every Fall after that.
- Associate/Full Professor: every 2 years; **Summer terms are excluded** from that count.
- Frequency must be **configurable per professor** (e.g., after a promotion or role change) — not a static lookup keyed only on rank.
- The system computes who is due each term from rank + last-evaluation-date + semester type.

### 4.2 Observer Matching
- Matching key is **course level** — the most-significant-digit (MSD) of the course number (e.g., all 1000-level courses form one bucket) — **not** subject/focus area.
- A valid observer must:
  1. be from the **same school** as the requesting professor, and
  2. have **taught that course level within the last 2 years**.
- Professors teaching different subjects can still be matched if their courses share a level (an ECS 1200 instructor can observe any ECS 1000-level course); cross-school matches are invalid even at the same level (an EPPS 1000-level instructor cannot observe an ECS 1000-level course).
- The system returns **exactly 5 candidates**; if more than 5 qualify, pick 5 at random. No ranking/scoring algorithm is required for v1.
- One observation per course/section per semester. A professor may be observed across multiple different courses in the same semester (each is a separate sign-up).
- **New-hire edge case:** if no same-school/same-level observer is available, an AC member may step in as observer.

### 4.3 Matching & Approval Workflow (human-in-the-loop — do not automate)
1. System generates the list of professors due for evaluation this term.
2. System surfaces ~5 observer candidates per §4.2 who have signed up and are available.
3. The requesting professor contacts those candidates directly and finds one who agrees — a human decision, not an auto-assignment.
4. The resulting observer/observation record goes to the **AC for approval first** — never directly to professors.
5. Only after AC approval does any communication go out to professors (with reminders as needed).
6. **The system never auto-sends notifications** — the AC is always the approval gate in between.
7. Once an observer agrees, they attend the class on the scheduled date and give feedback; **both observer and observee sign off** afterward.
8. If the observation doesn't happen (illness, scheduling conflict, etc.), the pair retries within roughly 3–4 weeks.
9. If it still doesn't happen, the requester notifies the system/AC — a committee member may step in as observer, or the observation is postponed to the next semester.

### 4.4 Evaluation Criteria
- Criteria, weights, scoring levels, and rating scales are **configurable by AC members**, not hardcoded. A sample rubric is to be provided by Prof. Narayanasami.
- Example criteria discussed (not exhaustive, not fixed): clarity, student engagement, preparedness, response to questions, academic rigor, pacing, organization, accessibility, learning-objective alignment, appropriate (not maximal) use of technology.
- Lecture recording is not a university requirement — do not penalize its absence in any criterion.

### 4.5 Forms
Four distinct forms, not one generic "form or upload" choice:

| Form | Type | Filled by |
|---|---|---|
| Sign-up | Web form, SSO | Requesting professor |
| Observation confirmation | Web form, SSO | Observee |
| Observation form (the actual evaluation) | **DOCX file** (not a web form) | Observer, during/after the observation |
| Process feedback | Web form, SSO | Participant(s) |

The observation DOCX is not intended for data analysis/aggregation — it's a record, not a structured dataset.

### 4.6 Visibility & Access Control
- Both observer and observee have visibility into their shared observation record, with full attribution both directions.
- Professors see all evaluations they've given and all they've received.
- AC members have facilitator-level access to everything; a Department Head can be granted access through the committee when needed.
- Observation information is **not** available to everyone by default — access must be gated by role.

### 4.7 Data Sourcing (for POC/testing)
- Do not contact other faculty to ask how their evaluations are currently handled (explicitly out of bounds).
- Course data may be downloaded manually from the UTD Course Book / catalog (catalog.utdallas.edu) rather than requiring a live CourseBook API integration for the POC. API credentials/access are left to the team to research if pursued further.
- Use fake personas (Professor A, Professor B, Professor C) in all seed/demo data — never real professor names.

## 5. Non-Functional Requirements
- Free/OSS stack only (see §2).
- Role-based access control gating every dashboard/report by persona (§3, §4.6).
- System must not send outbound communications without a prior AC approval step (§4.3).

## 6. KPI / Dashboard Requirements
Every item below must be surfaced somewhere in the AC or professor dashboard:
- Evaluation Eligibility Accuracy
- Overdue Evaluation Count
- Faculty due for evaluation, by hire level
- Assessment Participation Rate
- Observer Utilization Rate
- Average observations per observer
- Course-level match accuracy
- List sufficiency rate (are 5 candidates consistently found?)
- Survey Completion Rate
- Missing Observation Count
- Unmatched faculty report
- Outstanding Observation Report

## 7. Out of Scope for MVP (Stretch Only)
Do not build until the core MVP above is complete: desktop application wrapper, email/notification delivery, calendar integration, semester-based workload analytics, exportable reports.

## 8. Open Questions
- Exact CourseBook API access path (team to research; not provided by faculty advisor).
- Sample evaluation rubric (to be provided by Prof. Narayanasami — not yet received as of 2026-09-17).
- TA assignment and cadence details were still pending confirmation as of 2026-09-11.

---

## Change Log

| Date | Change |
|---|---|
| 2026-09-04 | Initial kickoff requirements captured (desktop-first, focus-area matching, generic form-or-upload). |
| 2026-09-11 | Platform flipped to web app; matching changed from focus-area to course-level + same-school; evaluation form split into 4 distinct forms (3 web + 1 DOCX); evaluation criteria made AC-configurable; frequency rules refined (Assistant-Prof first-semester exemption, Summer excluded for Associate/Full); personas clarified (no student access; Dept. Head via committee). |
| 2026-09-17 | This document written, consolidating the above into a single requirements definition, in response to reviewer feedback that the sprint plan was built without one. |
