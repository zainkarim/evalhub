# EvalHub (Assessment Helper) — Requirements Definition

**Sources:** Kickoff meeting with Prof. Priya Narayanasami (2026-09-04), follow-up Q&A / meeting summary (2026-09-11), and meeting notes (2026-09-18). Later meetings generally supersede earlier ones — several decisions changed week to week (see Change Log at the bottom). Where a conflict was genuinely ambiguous, the resolution and who made the call is noted inline.

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
- **AC (Assessment Committee) members** — approve finalized observer pairings (see §4.3), configure evaluation criteria/form templates/weights, view all dashboards and reports, can step in as an observer when no one else is available. AC members may themselves be professors and be observed as part of the normal evaluation cycle.
- **Department Head** — access granted through the committee when needed (facilitator-level, not a separate primary persona); view-only access to completed observation records.
- **Annual Review Committee** — new persona identified 2026-09-18; view-only access to completed observation records, alongside AC and Department Head. Not otherwise involved in the workflow.
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
  1. be from the **same school/department** as the requesting professor (the team treats "school" and "department" as interchangeable for this purpose — e.g. School of Engineering ≈ Department of Engineering — so this is one requirement, not two competing ones), and
  2. have **taught that course level** (recency window: 9/11 said "within the last 2 years"; 9/18 said a professor who once satisfied this doesn't need to re-satisfy it after a break or teaching another level, which reads as *not* time-boxed — **open question, see §8**).
- Professors teaching different subjects can still be matched if their courses share a level (an ECS 1200 instructor can observe any ECS 1000-level course); cross-department matches are invalid even at the same level (an EPPS 1000-level instructor cannot observe an ECS 1000-level course).
- **Availability is computed from course schedules, not entered manually** — when a professor selects a course/section to be observed, the system finds eligible professors who are free (not teaching a conflicting section) at that class time.
- The system shows **up to 5 candidates**: if 5+ are eligible, pick 5 at random (no ranking/scoring algorithm); if fewer than 5 are eligible, show all of them; if zero are eligible, notify the AC via their dashboard (see §4.3 edge case).
- A previously-suggested/previous observer is not excluded from being suggested again in a later cycle — no forced rotation/diversity requirement.
- One observation per course/section per semester. A professor may be observed across multiple different courses in the same semester (each is a separate sign-up).
- **New-hire / zero-eligible edge case:** if no eligible observer is available, the AC is notified via its dashboard and an AC member may step in as observer.

### 4.3 Matching & Approval Workflow (human-in-the-loop — do not automate)

**Reconciled 2026-09-20:** the 2026-09-04 kickoff said the candidate list must go to the AC *before* any professor sees it. The 2026-09-11 and 2026-09-18 meetings instead describe the system presenting candidates directly to the requesting professor, with no AC step on that specific list. Per team decision, the system accommodates both: candidates go straight to the requesting professor (so the human-to-human matching step isn't bottlenecked on committee review), but the **resulting pairing still requires AC approval before it's treated as official/final** — preserving kickoff's "AC is always the approval gate" rule at the confirmation step instead of the candidate-list step. Revisit this if the professor/TA clarifies otherwise.

1. System generates the list of professors due for evaluation this term.
2. System surfaces up to 5 observer candidates per §4.2, presented directly to the requesting professor (the observee).
3. The observee sends system-generated **"requests"** (not "invitations") to one, several, or all of the listed candidates — cannot request anyone outside the generated list. Each request expires after 48 hours. If multiple requests are outstanding and one observer accepts, the system auto-cancels the rest and notifies those candidates.
4. Once an observer accepts, the system records the observer-observee pairing and the scheduled observation date/time.
5. **Before the pairing is treated as final/official, it goes to the AC for approval** — this is the accommodation described above; the AC is always the approval gate before anything is treated as confirmed, even though it's no longer gating the initial candidate list.
6. **The system never auto-sends outbound notifications without this AC step.**
7. Once approved, the observer attends the class on the scheduled date and gives feedback; **both observer and observee sign off** afterward. The observee's sign-off confirms the observation *occurred* — it does not mean they agree with the observer's ratings/comments; the observee may attach a document giving their own perspective if needed.
8. If the observation doesn't happen (illness, scheduling conflict, etc.), it should be **rescheduled** and completed within the same semester where possible.
9. If it still can't happen, the requester notifies the system/AC — a committee member may step in as observer, or the observation is postponed to the next semester.
10. **Once signed/submitted, a completed observation cannot be edited by anyone** — not the observer, observee, AC, Department Head, or Annual Review Committee. Those roles (plus other "relevant professors" as appropriate) get view-only access instead. The observee is notified and can view the record as soon as the observer uploads it.

### 4.4 Evaluation Criteria
- Criteria, weights, scoring levels, and rating scales are **configurable by AC members**, not hardcoded. A sample rubric is to be provided by Prof. Narayanasami.
- Example criteria discussed (not exhaustive, not fixed): clarity, student engagement, preparedness, response to questions, academic rigor, pacing, organization, accessibility, learning-objective alignment, appropriate (not maximal) use of technology.
- Lecture recording is not a university requirement — do not penalize its absence in any criterion.

### 4.5 Forms & Templates
Four distinct forms, not one generic "form or upload" choice:

| Form | Type | Filled by |
|---|---|---|
| Sign-up | Web form | Requesting professor |
| Observation confirmation | Web form | Observee |
| Observation form (the actual evaluation) | **Printable PDF/DOCX** — important for MVP | Observer, during/after the observation |
| Process feedback | Web form | Participant(s) |

**Auth clarification (2026-09-18):** actual UTD Single Sign-On is *not* required — demonstration accounts with role-based auth are sufficient. This resolves any earlier tension with the planned JWT + bcrypt stack; "web form with SSO" in the 9/11 notes should be read as "web form," full stop.

**Observation form details (2026-09-18):**
- Professors can print the form, take notes during the observation, sign it, and upload the completed document. Full in-browser completion is a stretch goal, not MVP.
- In the downloadable PDF/DOCX, observer entry fields are editable; criteria, rating ranges, and other template-defined content are **not** editable by the observer.
- Only the AC can modify the observation form **template** itself — criteria, rating ranges, question types, required questions, weights, and wording. Template changes apply to future observations only; they never retroactively modify a completed observation.
- The observation record is not intended for data analysis/aggregation — it's a record, not a structured dataset.

### 4.6 Visibility & Access Control
- Both observer and observee have visibility into their shared observation record, with full attribution both directions.
- Professors see all evaluations they've given and all they've received.
- AC members have facilitator-level access to everything; a Department Head and the Annual Review Committee can be granted view-only access to completed records when needed.
- Observation information is **not** available to everyone by default — access must be gated by role.
- Once signed/submitted, a completed observation is immutable — see §4.3 step 10.

### 4.7 Data Sourcing (for POC/testing)
- Do not contact other faculty to ask how their evaluations are currently handled (explicitly out of bounds).
- An official UTD CourseBook API is **not** required for MVP — a one-time import of sample/anonymized data is acceptable. Real course names, course numbers, section info, and class meeting times may be used. A "Nebula Labs API" was mentioned (2026-09-18) as a possible data source if useful.
- **Professor names must always be fictional** (Professor A, Professor B, Professor C, etc.) regardless of data source — this is the one thing that must never be real.

### 4.8 Roles & Permissions (added 2026-09-18)
- Professors may update their own rank/status after a promotion (ties into the configurable-frequency requirement in §4.1).
- Only AC members can modify evaluation cycles or observation form templates.
- Nobody — including the AC — can edit a completed observation (§4.3 step 10).
- Relevant professors, AC members, Department Heads, and Annual Review Committee members receive view-only access to completed records as appropriate; no one outside those roles has access.

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
- **Recency window for "taught that course level":** is it strictly "within the last 2 years" (9/11) or does satisfying it once remove the time-box entirely (9/18 reads this way)? Unresolved — confirm with professor/TA before hardcoding either interpretation.
- Exact CourseBook API access path, and whether the "Nebula Labs API" mentioned 2026-09-18 is worth pursuing (team to research; not provided by faculty advisor).
- Sample evaluation rubric (to be provided by Prof. Narayanasami — not yet received as of 2026-09-20).
- Whether the AC-approval-at-confirmation reconciliation in §4.3 matches what the professor actually intends, versus AC approval being dropped from this workflow entirely — flag for the TA once assigned.
- Whether the structured "Weekly Team Report" PDF template (8 sections: completed work, hours, planned work, risks, decisions, minutes, evidence, AI use log) is actually required by the professor, or a template the team adopted informally — a couple of team members suspected (2026-09-18 Discord) it might not be mandatory. Worth confirming once a TA is assigned.

---

## Change Log

| Date | Change |
|---|---|
| 2026-09-04 | Initial kickoff requirements captured (desktop-first, focus-area matching, generic form-or-upload). |
| 2026-09-11 | Platform flipped to web app; matching changed from focus-area to course-level + same-school; evaluation form split into 4 distinct forms (3 web + 1 DOCX); evaluation criteria made AC-configurable; frequency rules refined (Assistant-Prof first-semester exemption, Summer excluded for Associate/Full); personas clarified (no student access; Dept. Head via committee). |
| 2026-09-17 | This document written, consolidating the above into a single requirements definition, in response to reviewer feedback that the sprint plan was built without one. |
| 2026-09-18 | Meeting notes added significant detail: availability computed from course schedules, observer "request" mechanics (48h expiry, auto-cancel), completed-observation immutability, new Annual Review Committee persona, AC-only template editing, no real SSO required (demo accounts suffice), CourseBook API not required (real course data OK, only professor names must be fictional), professors can self-update rank. Also introduced two apparent conflicts with earlier decisions (same-department vs. same-school; whether the AC approval gate still applies to the candidate list). |
| 2026-09-20 | Team resolved both 9/18 conflicts: (1) "school" and "department" are being used interchangeably by the team for this requirement, not treated as different scopes; (2) the AC-approval gate is preserved by moving it to the pairing-confirmation step rather than the candidate-list step, so both meetings' descriptions are accommodated (see §4.3). The course-level recency window question remains open. |
