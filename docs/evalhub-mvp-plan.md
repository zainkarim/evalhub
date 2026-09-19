# Assessment Helper — 9-Week MVP Plan

**Team size:** 6 · **Constraint:** everything free/open-source, no trials · **Cadence:** weekly faculty check-in + 2-week sprints · **Platform:** Web application (confirmed 2026-09-11; desktop wrapper is stretch-only, not the primary target)

---

## 1. Tech Stack (all free/OSS)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite, Tailwind CSS | Fast setup, huge OSS ecosystem |
| Backend | Node.js + Express (or Django if team knows Python better) | REST API, easy auth middleware |
| Database | PostgreSQL | Relational — fits teacher/course/assessment structure well |
| Auth | JWT + bcrypt (roll your own) or Auth.js | No paid identity providers needed |
| Hosting | Render / Railway free tier (backend+DB), Vercel/Netlify (frontend) | $0, good enough for a semester demo |
| Version control | GitHub (private repo, free for students) | |
| PM/tracking | GitHub Projects or Trello | Free kanban board |
| Docs | Markdown in repo + shared Google Doc | |

---

## 2. Team Roles (6 people)

| Role | People | Owns |
|---|---|---|
| **Backend/Data** | 2 | DB schema, models, core API (teachers, courses, assessments) |
| **Frontend** | 2 | React UI, dashboards, forms, state management |
| **Integration & Auth** | 1 | UTD Course Book API integration, JWT auth, role-based access |
| **PM / QA / Docs** | 1 | Requirements doc, sprint tracking, test cases, KPI calc logic, demo prep |

Everyone writes their own unit tests for what they build; PM/QA owns integration testing.

---

## 3. System Overview

### End Users
- **Professors** — sign up for courses, view observations given/received, access evaluation forms
- **AC (Assessment Committee) members** — review and approve observer lists, monitor dashboards, act as observers for new hires when needed

### Evaluation Frequency Rules (corrected 2026-09-11)
| Professor Rank | Required Frequency |
|---|---|
| Assistant Professor | Not evaluated their first semester; every Spring and every Fall after that |
| Associate Professor | Every 2 years, Summer excluded |
| Full Professor | Every 2 years, Summer excluded |

Frequency must be configurable per professor (e.g., after a promotion or role change), not a hardcoded lookup by rank alone. The system uses rank + last-evaluation-date + semester type to determine who is due each term.

### Observer Matching — by course level, not focus area (corrected 2026-09-11)
- Matching key is **course level** — the most-significant-digit (MSD) of the course number (1000-level, 2000-level, etc.) — not subject/focus area.
- A valid observer must (a) be from the **same school** as the requester and (b) have **taught that course level within the last 2 years**.
- Professors teaching different subjects can still match if their courses share a level (e.g., an ECS 1200 instructor can observe any ECS 1000-level course); cross-school matches are invalid even at the same level (an EPPS 1000-level instructor cannot observe an ECS 1000-level course).
- The system always returns **exactly 5 candidates**; if more than 5 qualify, pick 5 at random — no ranking/scoring algorithm needed.

### The Matching & Approval Workflow (Human-in-the-Loop)

This is **not** a fully automated assignment system. The correct flow is:

1. System generates a list of professors who are **due** for evaluation based on rank + last evaluation date
2. For each, system surfaces **~5 potential observer professors** per the course-level matching rule above who have signed up and are available
3. The requesting professor **contacts those candidates directly** and works out availability — this is a human decision, not an auto-assignment
4. The generated observer list is sent to the **AC for review and approval first** — it never goes directly to professors
5. Only after AC approval does an email/notification go out to professors (with reminders as needed)
6. **The system never auto-sends communications** — the AC is always the approval gate
7. Once an observer agrees, they attend the class on the scheduled date and give feedback; **both observer and observee sign off** afterward
8. If the observation doesn't happen (illness, conflict, etc.), retry within roughly 3–4 weeks
9. If it still doesn't happen, the requester notifies the system/AC — a committee member may step in as observer, or it gets postponed to the next semester

**Edge case — new hires:** If a new hire professor needs an evaluation and no same-school/same-level observer is available, an AC member may step in to conduct the evaluation themselves.

### Sign-Up & Visibility Rules
- Professors sign up for a course each semester and get access to observations tied to that course
- A professor can receive observations from another professor (e.g., Prof A observes Prof B) — **both professors** involved need visibility into that record
- Professors can sign up for multiple evaluations per semester across different topics/subjects
- Each professor can see:
  - Evaluations they have **given** (with attribution)
  - Evaluations they have **received** (with attribution)

### Evaluation Forms — four distinct forms (corrected 2026-09-11)
- **Sign-up form:** web form with SSO
- **Observation confirmation** (posted by the observee): web form with SSO
- **Observation form itself** (used by the observer during the observation): **DOCX file**, not a web form — the observer fills it out and submits the completed DOCX afterward. Not intended for data analysis/aggregation.
- **Process feedback form:** web form with SSO

### Evaluation Criteria (added 2026-09-11)
- Criteria, weights, scoring levels, and rating scales are **not fixed in code** — AC members must be able to add/edit them (a sample rubric to be provided by Prof. Narayanasami).
- Example criteria (not exhaustive): clarity, student engagement, preparedness, response to questions, academic rigor, pacing, organization, accessibility, learning-objective alignment, appropriate (not maximal) use of technology.
- Do not penalize for absence of lecture recording — it isn't a university requirement.

---

## 4. MVP Scope Cut

**In scope (MVP):**
- Teacher profiles with rank, school, course levels taught, and evaluation cycle
- Course metadata (sections, schedule, historical instructors)
- Assessment workflow: sign-up → AC-approved observer list → confirmation → reporting
- Evaluation frequency scheduling based on rank rules (see above)
- Course-level observer matching (~5 candidates surfaced; human decision follows)
- AC approval gate before any observer list is communicated
- Evaluation form (built-in) + document upload option
- Professor dashboard: evaluations given, evaluations received, attribution visible for both
- AC dashboard with core KPIs (see §6)
- POC-level UTD Course Book API integration
- Dummy/sample professor accounts for testing and demo
- Basic role-based access (AC / faculty)

**Deferred to stretch (only if ahead of schedule):**
- Desktop application wrapper
- Email/notification delivery (AC-approval step exists; actual sending is stretch)
- Calendar integration
- Semester-based workload analytics
- Exportable evaluation and observation reports

---

## 5. Sprint Breakdown

### Week 0 — Setup & Design (not a sprint, but critical)
- Finalize requirements with Prof. Narayanasami (confirm weekly report day — likely Fridays)
- Design DB schema (ERD): Professors (with rank), Courses, Assessments, Observations, ObserverCandidates, Users, Roles
- Set up repo, CI, hosting, project board
- Assign roles, agree on API contract (routes + payload shapes) so frontend/backend can work in parallel
- Seed initial dummy professor accounts in schema design
- **Deliverable:** ERD, API spec doc, repo scaffolded

### Sprint 1 — Weeks 1–2: Core Data Layer
- Backend: DB models + migrations, CRUD APIs for Professors & Courses, basic auth (login/JWT), role-based middleware (AC vs. faculty)
- Frontend: Login screen, professor list/detail view, course list/detail view, connect to real API
- Integration: Auth middleware + role checks; scaffold UTD Course Book API client (mock data if access is slow to obtain)
- **Deliverable:** Working login, professors and courses viewable/editable end-to-end

### Sprint 2 — Weeks 3–4: Assessment Workflow Core
- Backend: Evaluation eligibility engine (rank-based frequency rules), sign-up API, observer candidate generation (~5 per course level + school), AC approval queue endpoints, observer confirmation endpoints
- Frontend: Sign-up flow UI, observer candidate list view (surfaced to AC, not professors directly), AC approval UI, confirmation UI
- Integration: Wire real UTD Course Book data if available; otherwise continue with mocks
- **Deliverable:** A professor can be matched to observer candidates, the list goes to AC for approval, and an observation can be confirmed — start to finish, with no auto-communication bypassing AC

### Sprint 3 — Weeks 5–6: Dashboards, KPIs & Evaluation Forms
- Backend: KPI calculation endpoints (eligibility accuracy, overdue count, participation rate, match accuracy, survey/observation completion); evaluation form submission API; document upload endpoint
- Frontend: AC dashboard, professor dashboard (evaluations given + received with attribution), charts (Recharts or similar free lib), built-in evaluation form UI, file upload UI
- PM/QA: Write test cases against KPI definitions from the deck; validate numbers by hand on sample data
- **Deliverable:** Both dashboards live with real (or seeded) data; evaluation form and upload both functional

### Sprint 4 — Weeks 7–8: Role-Based Access, Polish, Hardening
- Integration: Full role-based access control (AC vs. faculty views fully gated)
- Backend: Edge cases — unmatched faculty report, new-hire AC-observer fallback, outstanding observations report
- Frontend: UI polish, error states, loading states, responsive pass
- PM/QA: Full regression pass, bug triage, seed realistic demo data including dummy professor accounts
- **Deliverable:** Feature-complete MVP, role-gated, demo data loaded

### Week 9 (–10 buffer) — Testing, Docs, Demo Prep
- Bug fixes from QA pass
- Finalize documentation (setup instructions, architecture diagram, known limitations)
- Confirm weekly report format / submission process with Prof. Narayanasami if not already locked
- Rehearse demo / prepare slides
- **Deliverable:** Deployed, demo-ready MVP

---

## 6. KPI Checklist (Dashboard Must-Haves)

Treat these as a feature checklist — every KPI must be surfaced somewhere in the AC or professor dashboard.

**Faculty Evaluation KPIs**
- Evaluation Eligibility Accuracy
- Overdue Evaluation Count
- Faculty due for evaluation — breakdown by hire level

**Assessment Participation KPIs**
- Assessment Participation Rate
- Observer Utilization Rate
- Average observations per observer

**Recommendation Engine KPIs**
- Course-level match accuracy
- List sufficiency rate

**Survey & Observation Completion KPIs**
- Survey Completion Rate
- Missing Observation Count

**Executive / AC Reports**
- Unmatched faculty report
- Outstanding Observation Report

---

## 7. Weekly Rhythm

- **Weekly faculty report:** due Fridays (confirm exact format/submission method with Prof. Narayanasami in Week 0)
- **Internal standup (2x/week, async is fine):** what's done, what's next, blockers
- **In-person meetings:** 1–2 times for the semester per faculty schedule; otherwise virtual via MS Teams
- **Sprint boundary (every 2 weeks):** demo to each other, re-groom backlog, adjust scope if behind

---

## 8. Risk Watch

- **UTD Course Book API access** — request credentials/docs in Week 0; if delayed, build against mocked data so it doesn't block Sprint 1–2.
- **Matching workflow misunderstood** — the system surfaces candidates, humans decide; do not build auto-assignment. AC approval gate must exist before any list reaches professors.
- **Evaluation form + upload scope** — both pathways (built-in form and document upload) are MVP; don't defer the upload path.
- **Matching algorithm complexity** — keep v1 rule-based (course-level + same-school overlap, taught within last 2 years), not optimization-heavy. Don't over-engineer.
- **Scope creep from stretch goals** — hold the line until Week 8; only pull in stretch items (desktop wrapper, email delivery, exports) if MVP is done early.
