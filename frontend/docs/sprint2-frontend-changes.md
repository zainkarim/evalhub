# Sprint 2 frontend — changes, how to view them, how they work

Scope: sign-up flow UI, observer candidate list view, AC approval UI, confirmation
UI, with clearly different faculty and Assessment Committee (AC) views. Frontend
only — `backend/` is untouched. Built on the `origin/frontend` branch version
of `frontend/` (your sign-up page, course data hookup and role-based pages).

## How to view it

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 — runs on the built-in mock API
```

No backend needed. Sign in from the login page's demo buttons (password
`ChangeMe-Dev-123!`). **Reset demo data** on the login page restores the seed.
Everything is stored in the browser, so to see both sides of a hand-off, sign
out and sign in as the other person in the same browser window.

### Click-through (about 5 minutes)

1. **Faculty · `faculty@example.edu`** (Professor C) — lands on *Observations*.
   *Request Observation* → Fall 2026 → CS 2305 → Section 001: the section
   details appear → submit. (CS 1337 shows "already signed up".)
2. *Choose an observer* → **Find observer candidates** → Professor G is listed
   (only one eligible, so the page says so) → tick → **Send request**.
   Also do this for the CS 1337 sign-up (candidate: Professor H).
3. **`professor.g@example.edu`** — *Observations* shows the request (nav badge 1)
   → **Accept…** → pick a class date → Confirm. Repeat as `professor.h@example.edu`,
   choosing **today** (so sign-off is open later).
4. **AC · `ac@example.edu`** (Professor B) — lands on *Approvals*: three
   pairings waiting (one is pre-seeded). Approve two; **Reject…** the third
   (the button stays disabled until you type a reason). *Needs committee
   attention* lists Professor I (no eligible observer) → **Open** → assign
   Professor B as step-in with a class date.
5. **`admin@example.edu`** — approves that step-in (Professor B can't approve a
   pairing they're in — the page says so).
6. **`professor.h@example.edu`** → *Observations* → **Confirm** → tick → **Sign off**.
   Then **`faculty@example.edu`** does the same and can add "Your perspective".
   The record becomes **Completed — view-only**: no sign-off, reschedule or
   report buttons remain for anyone.
7. **`professor.g@example.edu`** → the future-dated record: sign-off is locked
   until the date; **It didn't happen** → reason → the committee's attention list
   shows it; Professor C can send new requests.
8. **`professor.e@example.edu`** — sign up CS 3354 → candidate list shows
   "6 eligible · 5 shown".
9. As faculty, open `/approvals` or `/professors` directly: "limited to the
   Assessment Committee".

## What changed

### New pages

| Route | File | Who | Purpose |
|---|---|---|---|
| `/assessments/:id` | `pages/AssessmentDetail.jsx` | owner, AC | One sign-up end to end: progress bar, section details, pairing, **observer candidate list**, committee actions |
| `/records/:id` | `pages/ObservationRecord.jsx` | observer, observee, AC (view-only) | **Confirmation UI**: who/when, committee review, both sign-offs, reschedule, "it didn't happen", locked once completed |
| `/approvals` | `pages/Approvals.jsx` | AC/admin only | **AC approval UI**: pairings to approve/reject, needs-attention queue, awaiting sign-off |

### Rewritten pages

| File | Change |
|---|---|
| `pages/ObservationSignup.jsx` | Was saving requests to `localStorage` (invisible to the AC and lost on another browser). Now calls `POST /assessments/sign-up`. Section details appear on selection, past/Summer terms hidden, duplicates blocked, success screen leads to the candidate step. AC gets a *Professor* picker to sign someone up on their behalf. |
| `pages/Observations.jsx` | Faculty: *My sign-ups* with next step, *Requests to observe a colleague* (accept with class date / decline), *Observations I'm giving*, *I'm receiving* (both names visible). AC: *All sign-ups* table (search, status filter, attention flag) plus a *My observations* tab when they teach. |
| `pages/Courses.jsx` | Sign-up status per section from the API instead of `localStorage`; AC sees instructor + status column, faculty only their sections; term filter built from data (was hard-coded). |
| `pages/ProfessorDetail.jsx` | "Last evaluated" was always "Never" (field doesn't exist on teachers) — now derived from completed sign-ups; lists the professor's sign-ups; readable rank. |
| `pages/Login.jsx` | Lands on each role's home page; admin + mock-only demo accounts; "Reset demo data". |

### New components and helpers

`components/`: `StatusBadge`, `SectionInfo`, `Stepper`, `CandidatePanel`,
`PairingPanel`, `CommitteeActions`, `ReviewControls`, `IncomingRequest`.
`lib/`: `roles.js`, `format.js`, `workflow.js`, `mockServer.js`; `mockData.js`
rewritten to mirror `backend/db/seeds/dev_seed.sql` (same personas/ids/terms/
courses/sections) plus a few mock-only rows.

### Modified

| File | Change |
|---|---|
| `App.jsx` | New routes; committee routes use `ProtectedRoute roles`; `/` redirects AC → Approvals, faculty → Observations. |
| `components/Layout.jsx` | Nav differs by role (Professors + Approvals are AC-only) with live counters (AC: approvals + needs attention; faculty: pending requests). Admin previously lost the *Professors* link. |
| `lib/api.js` | All workflow calls; reads the backend's `{ error: { message } }` (was `data.message`, so every server error showed a generic text); a wrong password on login no longer says "session ended"; `pageSize=100` (backend default is 25, so lists were silently truncated). |
| `.env.example` | Port 4000 → 3000 (backend default). |
| `README.md` | Run/demo accounts/structure/who-sees-what. |

## How it works

**Roles.** `faculty` and `ac_member`/`admin` get different navigation, landing
page, tables and actions (see the README table). AC members who teach also
take part as professors; on their own sign-up they act as the professor and
another committee member handles approval.

**Flow** (requirements §4.3, as reconciled 2026-09-20):

1. Professor signs up for a section → `signed_up`.
2. *Find observer candidates* → up to 5 of the eligible pool (same school,
   same course level, taught within 2 years, not teaching at the same time).
   Fewer than 5 → everyone shown; none → the committee is alerted and steps in.
3. The professor sends requests to any of the listed people (expire in 48 h;
   one acceptance cancels the rest). The observer accepts with a class date.
4. The pairing goes to the AC (`pending_ac_approval`); nothing is final and
   nothing is sent without approval. Reject needs a reason and sends the
   professor back to step 3.
5. After the class date, observer and observee each confirm. The observee's
   confirmation says it doesn't mean agreement and allows an optional
   perspective note. Both done → **Completed**, locked for everyone.
6. If it doesn't happen: reschedule within the term, or report it — the
   committee can step in or postpone; the professor can re-request after ~3 weeks.

**Decision to confirm.** The sprint plan says the candidate list is "surfaced to
AC, not professors directly", but the requirements (§4.3, reconciled
2026-09-20) show it to the requesting professor and move the AC gate to the
pairing. I built the reconciled version: the professor picks from the list, and
the AC sees the same list (read-only) on every sign-up and approves the pairing.

**Added rules** (not stated anywhere, easy to remove — `mockServer.js`):
summer/past-term sections can't be signed up; a committee member can't review a
pairing they're part of; rejecting needs a note; sign-off only opens on the class
date; step-in observers must be AC members.

**Mock vs real API.** `VITE_API_URL` unset → mock. Set → the same calls go to the
backend. Routes the backend lacks will return 404 until added; the exact list,
shapes and the backend bugs found while testing are in
[`api-expectations.md`](api-expectations.md).

## Verified

`npm run build` and `oxlint src` are clean. A headless-browser run covered sign-up
(including duplicate block), candidates (1-of-1 and 5-of-6), requests,
accept/decline/expiry, AC approve/reject/step-in, admin approval, both sign-offs
and the locked record, reschedule-free "didn't happen", role gating and a
390 px-wide layout check — no JS errors.

## Not included

View-only roles for Department Head / Annual Review Committee (schema has no such
role), the observation-form DOCX/upload, process-feedback form, rank-based
eligibility engine, KPI dashboards, email delivery — later sprints per the plan.
