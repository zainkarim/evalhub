# Assessment Helper — 9-Week MVP Plan

**Team size:** 6 · **Constraint:** everything free/open-source, no trials · **Cadence:** weekly faculty check-in + 2-week sprints

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

## 3. MVP Scope Cut

**In scope (MVP):**
- Teacher profiles, course metadata, assessment workflow (sign-up → matching → confirmation → reporting)
- Auto-scheduling by hiring-level rules
- Focus-area observer matching (basic algorithm — doesn't need to be ML-driven)
- AC + teacher dashboards with core KPIs
- POC-level UTD Course Book API integration
- Basic role-based access (AC / faculty)

**Deferred to stretch (only if ahead of schedule):**
- Email notifications
- Calendar integration
- Workload analytics
- Exportable reports

---

## 4. Sprint Breakdown

### Week 0 — Setup & Design (not a sprint, but critical)
- Finalize requirements with Prof. Narayanasami
- Design DB schema (ERD): Teachers, Courses, Assessments, Observations, Users
- Set up repo, CI, hosting, project board
- Assign roles, agree on API contract (routes + payload shapes) so frontend/backend can work in parallel
- **Deliverable:** ERD, API spec doc, repo scaffolded

### Sprint 1 — Weeks 1–2: Core Data Layer
- Backend: DB models + migrations, CRUD APIs for Teachers & Courses, basic auth (login/JWT)
- Frontend: Login screen, teacher list/detail view, course list/detail view, connect to real API
- Integration: Auth middleware + role checks; scaffold UTD Course Book API client (mock data if API access is slow to obtain)
- **Deliverable:** Working login, teachers and courses viewable/editable end-to-end

### Sprint 2 — Weeks 3–4: Assessment Workflow Core
- Backend: Assessment sign-up API, matching algorithm v1 (focus-area based), observer confirmation endpoints
- Frontend: Sign-up flow UI, observer matching results view, confirmation UI
- Integration: Wire real UTD Course Book data in (historical instructor data) if available by now
- **Deliverable:** A teacher can be matched to observers and an observation can be confirmed, start to finish

### Sprint 3 — Weeks 5–6: Dashboards & KPIs
- Backend: KPI calculation endpoints (eligibility accuracy, overdue count, participation rate, match accuracy, etc.)
- Frontend: AC dashboard, teacher dashboard, charts (use a free lib like Recharts)
- PM/QA: Write test cases against KPI definitions from the deck; validate numbers by hand on sample data
- **Deliverable:** Both dashboards live with real (or seeded) data

### Sprint 4 — Weeks 7–8: Role-Based Access, Polish, Hardening
- Integration: Full role-based access control (AC vs faculty vs admin views)
- Backend: Edge cases — unmatched faculty report, outstanding observations report
- Frontend: UI polish, error states, loading states, responsive pass
- PM/QA: Full regression pass, bug triage
- **Deliverable:** Feature-complete MVP, role-gated

### Week 9 (–10 buffer) — Testing, Docs, Demo Prep
- Bug fixes from QA pass
- Seed realistic demo data
- Finalize documentation (setup instructions, architecture diagram, known limitations)
- Rehearse demo / prepare slides
- **Deliverable:** Deployed, demo-ready MVP

---

## 5. Weekly Rhythm

- **Weekly faculty meeting:** status, blockers, scope decisions
- **Internal standup (2x/week, async is fine):** what's done, what's next, blockers
- **Sprint boundary (every 2 weeks):** demo to each other, re-groom backlog, adjust scope if behind

---

## 6. Risk Watch

- **UTD Course Book API access** — request credentials/docs in Week 0; if delayed, build against mocked data so it doesn't block Sprint 1–2.
- **Matching algorithm complexity** — keep v1 rule-based (focus-area overlap + availability), not optimization-heavy. Don't over-engineer.
- **Scope creep from stretch goals** — hold the line until Week 8; only pull in stretch items if MVP is done early.
