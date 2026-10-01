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
| Cost | All tooling must be free/open-source; **no paid tiers, no trials that expire or auto-delete after a fixed period** |
| Runtime | Software must be capable of running on a VM (self-hostable in principle) — this is not a mandate to self-host; managed platforms (Render, Vercel, etc.) are fine as long as they don't violate the no-expiring-trial rule above |
| Team size | 6 |
| Timeline | 9-week MVP, as much as possible done before Thanksgiving |

**Corrected 2026-09-29:** the team had read "must be able to run on a Virtual Machine" (9/11 Q&A, Q9) as effectively banning managed hosting like Render/Vercel, and treated the fix as "get department VM access." Re-reading the actual source: that sentence is phrased permissively ("as long as it is free and can run on a VM, you can use it") and is about the *software* being self-hostable, not a requirement to personally provision infrastructure. The real, concrete conflict is narrower and comes from a different sentence entirely — the kickoff notes' "no paid tools, no 30-day trials," repeated in the same Q9 answer ("should not be a trial version... require the user to pay after it runs out"). **Render's free-tier Postgres databases are deleted after 30 days** unless upgraded to paid — that's the actual violation. Render's free web service (the API, not the DB) has no such expiry, and Vercel's free static hosting doesn't either. Fix: keep Render (API) and Vercel (frontend), swap only the database off Render's free Postgres onto a provider whose free tier doesn't time-box the database (see Hosting row in `CLAUDE.md`).

## 3. Personas / End Users

- **Faculty (professors)** — sign up for courses/observations, view their own evaluation history (given + received), fill out or receive observation forms.
- **AC (Assessment Committee) members** — approve finalized observer pairings (see §4.3), configure evaluation criteria/form templates/weights, view all dashboards and reports, can step in as an observer when no one else is available. AC members may themselves be professors and be observed as part of the normal evaluation cycle.
- **Department Head** — access granted through the committee when needed (facilitator-level, not a separate primary persona); view-only access to completed observation records.
- **Annual Review Committee** — new persona identified 2026-09-18; view-only access to completed observation records, alongside AC and Department Head. Not otherwise involved in the workflow.
- **Explicitly out of scope:** students. No student-facing auth or UI is required.

## 4. Functional Requirements

### 4.1 Evaluation Frequency (eligibility engine)
- **Corrected 2026-09-30 — resolved directly with the professor at the TA/professor meeting; the Process Explanation doc is treated as source of truth and overwrites the prior 9/11 understanding:** Assistant Professor is evaluated **once every calendar year**, satisfied by either Spring or Fall of that year. Example from the professor's own doc: last evaluation Spring 2025 → due again in Spring 2026 or Fall 2026. There is **no first-semester exemption and no twice-per-year (every Spring and every Fall) cadence** — that 9/11 framing is superseded, not just supplemented.
- Associate/Full Professor: every 2 years; **Summer terms are excluded** from that count. (Unchanged — this correction was scoped to the Assistant Professor cadence only.)
- Frequency must be **configurable per professor** (e.g., after a promotion or role change) — not a static lookup keyed only on rank.
- The system computes who is due each term from rank + last-evaluation-date + semester type.

### 4.2 Observer Matching
- Matching key is **course level** — the most-significant-digit (MSD) of the course number (e.g., all 1000-level courses form one bucket) — **not** subject/focus area.
- A valid observer must:
  1. be from the **same school/department** as the requesting professor (the team treats "school" and "department" as interchangeable for this purpose — e.g. School of Engineering ≈ Department of Engineering — so this is one requirement, not two competing ones), and
  2. have **taught that course level** (recency window: 9/11 said "within the last 2 years"; 9/18 said a professor who once satisfied this doesn't need to re-satisfy it after a break or teaching another level, which reads as *not* time-boxed — **open question, see §8**).
- Professors teaching different subjects can still be matched if their courses share a level (an ECS 1200 instructor can observe any ECS 1000-level course); cross-department matches are invalid even at the same level (an EPPS 1000-level instructor cannot observe an ECS 1000-level course).
- **Course numbering continues into graduate levels** (5000, 6000, etc.) — confirmed 2026-09-18 Q&A; the same MSD matching logic applies at those levels, not just 1000–4000.
- **Observer Pool mechanic (confirmed 2026-09-18 Q&A):** a professor who signs up to be observed in a given cycle is automatically added to that cycle's pool of potential observers — there is no separate opt-in to become an observer. Candidate generation for a given sign-up draws from this pool.
- **Availability is computed from course schedules, not entered manually** — when a professor selects a course/section to be observed, the system finds eligible professors who are free (not teaching a conflicting section) at that class time.
- The system shows **up to 5 candidates**: if 5+ are eligible, pick 5 at random (no ranking/scoring algorithm); if fewer than 5 are eligible, show all of them; if zero are eligible, notify the AC via their dashboard (see §4.3 edge case).
- A previously-suggested/previous observer is not excluded from being suggested again in a later cycle — no forced rotation/diversity requirement.
- One observation per course/section per semester. A professor may be observed across multiple different courses in the same semester (each is a separate sign-up).
- **New-hire / zero-eligible edge case:** if no eligible observer is available, the AC is notified via its dashboard and an AC member may step in as observer.

### 4.3 Matching & Observer Selection Workflow (human-in-the-loop — do not automate)

**Corrected 2026-09-30 — second correction to this section today, supersedes the "AC approval gate at pairing-confirmation" reconciliation made earlier the same day:** the 2026-09-30 TA/professor meeting (frontend meeting notes, backend Jira task breakdown, and whiteboard notes — all three independently) states that **the AC does not approve observer pairings at all.** Remove any "Committee Approval" / "Awaiting AC Approval" wording or status from the system. AC's role is narrower than previously modeled: review sign-ups after the deadline, trigger candidate generation, and handle insufficient-candidate cases manually.

1. Observee signs up for the course/section they want to be observed in.
2. After the signup deadline, AC reviews all sign-ups (course, section, meeting days/times, observee info), then triggers a **"Start Observer Selection"** action to begin candidate generation for that cycle — candidate generation is no longer modeled as instant-on-signup.
3. System surfaces up to 5 observer candidates per §4.2. If a sign-up's eligible pool is insufficient/zero, the AC dashboard shows an alert and AC resolves it manually — the observee is not simply left without an update.
4. **Request mechanism (corrected 2026-09-30, replaces this morning's "multi-observer-confirm-then-manual-pick" correction, which is no longer current):** the observee selects **one** observer from the candidate list and offers **multiple possible observation dates (roughly 4–8)** before sending the request. Course-schedule availability is system-checked, but personal/Outlook-calendar availability isn't — the date options let the observer pick one that fits their own schedule. Selecting an observer does not immediately send anything; date selection happens first, then a single request goes out to that one observer.
5. The observer confirms one of the proposed dates. The system records the pairing and scheduled date/time. **No AC approval step follows this** — the pairing is final once the observer confirms a date.
6. **Open/BLOCKED (flagged by the team's own backend Jira breakdown, not yet answered by the TA/professor):** when AC manually assigns an observer (the insufficient-candidate case in step 3), must the pick come from the generated eligible pool, or can AC assign any faculty member regardless of eligibility? This blocks the backend "assign endpoint" ticket — do not build it against an assumed answer; wait for a direct answer.
7. Observer attends the class on the confirmed date and gives feedback; **both observer and observee sign off** afterward. The observee's sign-off confirms the observation *occurred* — it does not mean they agree with the observer's ratings/comments; the observee may attach a document giving their own perspective if needed.
8. **Never cancel or delete a sign-up/attempt that doesn't happen** (illness, scheduling conflict, etc.) — log the attempt (who, when, why) and mark it **"Postponed"**, preserving the record that the professor tried. Reschedule within the same semester where possible.
9. **Status model distinction (added 2026-09-30):** a confirmed date is "scheduled/confirmed," not "Completed." "Completed" means the full process finished — observation held *and* both sign-offs submitted. Do not conflate the two statuses.
10. **Once signed/submitted, a completed observation cannot be edited by anyone** — not the observer, observee, AC, Department Head, or Annual Review Committee. Those roles (plus other "relevant professors" as appropriate) get view-only access instead. The observee is notified and can view the record as soon as the observer uploads it.

### 4.4 Evaluation Criteria
- Criteria, weights, scoring levels, and rating scales are **configurable by AC members (add/edit/delete)**, not hardcoded. **Reconfirmed 2026-09-30** in the TA/professor meeting. A sample rubric is to be provided by Prof. Narayanasami.
- Example criteria discussed (not exhaustive, not fixed, not a final rubric): clarity of communication, preparation/organization, use of examples, handling of student questions, professional/patient interaction with students, clear transitions between concepts, student engagement, academic rigor, pacing, accessibility, learning-objective alignment, appropriate (not maximal) use of technology.
- **Not all criteria necessarily share one rating scale** (added 2026-09-30) — e.g. one criterion might use a 1-star scale, another a 5-star scale. This detail is still fuzzy — the team could not fully recall this part of the meeting — confirm with the TA/professor before locking a fixed scale into the schema.
- **Observer questionnaire mechanics (added 2026-09-30):** the observer completes a universal, AC-defined, multiple-choice ranking questionnaire about the observee's performance — one question per criterion. The observer can only answer; they cannot edit the questions themselves. Once submitted and signed by both parties, results are fully visible (read-only) to both observer and observee, and cannot be changed by anyone (ties into §4.3 step 10's immutability rule).
- Lecture recording is not a university requirement — do not penalize its absence in any criterion.

### 4.5 Forms & Templates
Four distinct forms, not one generic "form or upload" choice:

| Form | Type | Filled by |
|---|---|---|
| Sign-up | Web form | Requesting professor |
| Observation confirmation | Web form | Observee |
| Observation form (the actual evaluation) | **In-app copy of the Observation Template** — required for MVP | Observer, during/after the observation; signed in-app by both parties |
| Process feedback | Web form | Participant(s) |

**Auth clarification (2026-09-18):** actual UTD Single Sign-On is *not* required — demonstration accounts with role-based auth are sufficient. This resolves any earlier tension with the planned JWT + bcrypt stack; "web form with SSO" in the 9/11 notes should be read as "web form," full stop.

**Observation form details — corrected 2026-09-30 (supersedes 9/18 "printable PDF/DOCX is MVP, in-browser is stretch" framing):**
- The 9/18 Q&A originally answered this question with "printable page" / "PDF/Docx download, entry fields editable" / "in-browser view is stretch" — but that entire answer is struck through in the source doc, with a note to defer to the Process Explanation doc instead. The Process Explanation doc's actual (current) answer: *"we will let the Observer use a copy of the Observation Template and make notes directly in that copy. Then Both Observer & Observee can sign that copy."* It also lists **"Required: In-app view of copy of the Observation Template."**
- **Net effect: full in-browser completion is now MVP, not stretch.** The observer works from an in-app copy of the current template, enters notes/ratings directly in the app, and both observer and observee sign that same copy electronically within the app.
- A printable/downloadable version may still be offered as a convenience, but it is not the core submission path for MVP.
- In the in-app copy, observer entry fields are editable; criteria, rating ranges, and other template-defined content are **not** editable by the observer.
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

### 4.9 Notifications — corrected 2026-09-30 (moves part of this out of Deferred/Stretch, see §7)
`CLAUDE.md` and this doc previously listed "email/notification delivery" entirely under stretch goals, based on the 9/4–9/11 meetings. The Process Explanation doc (2026-09-18, direct from Prof. Narayanasami) describes several notification touchpoints as standard AC/system capabilities, not optional extras:
- AC can notify due/overdue professors, and communicate the signup deadline, observation-period deadline, and feedback/survey deadline.
- System/AC sends each observee a notification once their 5-candidate observer list is ready ("a Button to send notifications to each Observee that their list is ready").
- After the observation-period deadline, AC can notify all observees to complete the process-feedback survey.
- Observee is notified when the observer uploads the signed observation (already captured in §4.3 step 10).
- **Reconciliation:** treat the *capability* to notify users at these milestones (surfaced in-app at minimum — dashboard alerts, a notification/inbox view, "list ready" indicators) as **MVP**, not stretch. Actual outbound **email/SMTP delivery infrastructure** can remain a stretch/time-permitting item if the team is short on time.
- **Corrected 2026-09-30 (later same day):** since §4.3 no longer has an AC-approval step on the pairing at all, there is nothing left for an "AC approval gates this notification" rule to apply to — a confirmed date simply triggers normal in-app notifications like any other milestone.

## 5. Non-Functional Requirements
- Free/OSS stack only (see §2).
- Role-based access control gating every dashboard/report by persona (§3, §4.6).
- **Corrected 2026-09-30:** there is no AC-approval gate anywhere in the observer-matching workflow (§4.3) — all in-app notifications (deadlines, list-ready, request confirmations, pairing confirmed) fire on their normal triggers, none are withheld pending AC sign-off.

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
Do not build until the core MVP above is complete: desktop application wrapper, calendar integration, semester-based workload analytics, exportable reports.

**Corrected 2026-09-30:** "email/notification delivery" was removed from this list — see §4.9. In-app notifications at key milestones are MVP; only the outbound-email/SMTP delivery mechanism itself (as opposed to the in-app notification) may be deferred if time-constrained.

## 8. Open Questions
- **Recency window for "taught that course level":** is it strictly "within the last 2 years" (9/11) or does satisfying it once remove the time-box entirely (9/18 reads this way)? Unresolved — confirm with professor/TA before hardcoding either interpretation.
- Exact CourseBook API access path, and whether the "Nebula Labs API" mentioned 2026-09-18 is worth pursuing (team to research; not provided by faculty advisor).
- Sample evaluation rubric (to be provided by Prof. Narayanasami — not yet received as of 2026-09-20).
- Whether the structured "Weekly Team Report" PDF template (8 sections: completed work, hours, planned work, risks, decisions, minutes, evidence, AI use log) is actually required by the professor, or a template the team adopted informally — a couple of team members suspected (2026-09-18 Discord) it might not be mandatory. Worth confirming once a TA is assigned.
- **AC manual-assignment scope (added 2026-09-30, from the team's own backend Jira task breakdown — BLOCKED):** when AC manually assigns an observer (the insufficient-candidate case, §4.3 step 3), must the pick come from the generated eligible pool, or can AC assign any faculty member regardless of eligibility? Blocks the backend "assign endpoint" ticket — do not build it against an assumed answer.
- **Criteria rating-scale consistency (added 2026-09-30):** whether different criteria can use different rating scales (e.g. 1-star vs. 5-star) within the same template — mentioned in the 9/30 meeting but the team couldn't fully recall the detail. Confirm before locking a schema for it.

---

## Change Log

| Date | Change |
|---|---|
| 2026-09-04 | Initial kickoff requirements captured (desktop-first, focus-area matching, generic form-or-upload). |
| 2026-09-11 | Platform flipped to web app; matching changed from focus-area to course-level + same-school; evaluation form split into 4 distinct forms (3 web + 1 DOCX); evaluation criteria made AC-configurable; frequency rules refined (Assistant-Prof first-semester exemption, Summer excluded for Associate/Full); personas clarified (no student access; Dept. Head via committee). |
| 2026-09-17 | This document written, consolidating the above into a single requirements definition, in response to reviewer feedback that the sprint plan was built without one. |
| 2026-09-18 | Meeting notes added significant detail: availability computed from course schedules, observer "request" mechanics (48h expiry, auto-cancel), completed-observation immutability, new Annual Review Committee persona, AC-only template editing, no real SSO required (demo accounts suffice), CourseBook API not required (real course data OK, only professor names must be fictional), professors can self-update rank. Also introduced two apparent conflicts with earlier decisions (same-department vs. same-school; whether the AC approval gate still applies to the candidate list). |
| 2026-09-20 | Team resolved both 9/18 conflicts: (1) "school" and "department" are being used interchangeably by the team for this requirement, not treated as different scopes; (2) the AC-approval gate is preserved by moving it to the pairing-confirmation step rather than the candidate-list step, so both meetings' descriptions are accommodated (see §4.3). The course-level recency window question remains open. |
| 2026-09-30 (morning) | Added `docs/process-explanation.pdf` and `docs/q_and_a_9_18_*.pdf` (direct answers from Prof. Narayanasami, 2026-09-18) to the repo. Reconciled three points where these superseded earlier answers: (1) observation form is now an in-app signed copy of the template, required for MVP — not a printable PDF/DOCX with in-browser completion as stretch (§4.5); (2) in-app notifications at key milestones (deadlines, list-ready, request confirmations) are MVP, not stretch — only outbound email/SMTP delivery may remain stretch (§4.9, §7); (3) observer acceptance is multi-confirm-then-manual-pick, not auto-cancel-on-first-accept (§4.3 step 3, superseded again later the same day — see below). Also added: course numbering extends to graduate levels, and the "Observer Pool" auto-enrollment mechanic (§4.2). Reconfirmed §4.4 (AC-configurable criteria) at the TA/professor meeting. Also resolved at that meeting, overwriting prior understanding per the professor's direct guidance: Assistant Professor evaluation cadence is **once per calendar year** (either Spring or Fall), not the 9/11 "no first semester, then every Spring and every Fall" framing — §4.1 updated accordingly, closing the open question previously tracked here. |
| 2026-09-30 (evening) | Added `docs/notes/meeting4/` (whiteboard screenshot, frontend meeting notes, backend Jira task breakdown from the 9/30 TA/professor meeting). **Second reversal of the matching workflow in one day:** the AC does not approve observer pairings at all — removes the "AC approval gate at pairing-confirmation" fix made that same morning (§4.3). Request mechanism changed again: observee selects one observer and offers 4–8 possible dates, replacing the morning's multi-observer-confirm-then-manual-pick model. Sign-ups are never cancelled/deleted, only marked "Postponed" with the attempt logged (§4.3 step 8); added the "scheduled/confirmed" vs. "Completed" status distinction (§4.3 step 9). Added observer-questionnaire mechanics and the possible per-criterion rating-scale variance to §4.4. Two new open questions added to §8, both genuinely unresolved (not decided unilaterally): AC's manual-assignment scope, and per-criterion scale consistency. Also noted: a rough draft of the project proposal is due 2026-10-02, ahead of the Oct 9 final (which needs Dr. Razo's format per the 9/18 Q&A). |
